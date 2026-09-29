import type { Article } from "./article-loader";
import { buildOutgoingMap } from "./backlinks";

export type GraphNode = {
	id: string;
	title: string;
	description?: string;

	degree: number;

	isCurrent?: boolean;
};

export type GraphLink = {
	source: string;
	target: string;
};

export type GraphData = {
	nodes: GraphNode[];
	links: GraphLink[];
};

export function buildGraphData(articles: Article[]): GraphData {
	const outgoing = buildOutgoingMap(articles);
	const bySlug = new Map(articles.map((a) => [a.slug, a]));

	const degree = new Map<string, number>();
	for (const a of articles) degree.set(a.slug, 0);

	const links: GraphLink[] = [];
	const seen = new Set<string>();
	for (const [source, targets] of outgoing) {
		for (const target of targets) {
			if (!bySlug.has(target)) continue;
			const key = `${source}->${target}`;
			if (seen.has(key)) continue;
			seen.add(key);
			links.push({ source, target });
			degree.set(source, (degree.get(source) ?? 0) + 1);
			degree.set(target, (degree.get(target) ?? 0) + 1);
		}
	}

	const nodes: GraphNode[] = articles.map((a) => ({
		id: a.slug,
		title: a.title,
		description: a.description,
		degree: degree.get(a.slug) ?? 0,
	}));

	nodes.sort((x, y) => y.degree - x.degree);

	return { nodes, links };
}

export function getLocalGraph(
	all: GraphData,
	slug: string,
	depth = 1,
): GraphData {
	if (!all.nodes.some((n) => n.id === slug)) return { nodes: [], links: [] };

	const adjacency = new Map<string, Set<string>>();
	for (const n of all.nodes) adjacency.set(n.id, new Set());
	for (const l of all.links) {
		adjacency.get(l.source)?.add(l.target);
		adjacency.get(l.target)?.add(l.source);
	}

	const visited = new Set<string>([slug]);
	let frontier = [slug];
	for (let d = 0; d < depth; d++) {
		const next: string[] = [];
		for (const id of frontier) {
			for (const neighbor of adjacency.get(id) ?? []) {
				if (!visited.has(neighbor)) {
					visited.add(neighbor);
					next.push(neighbor);
				}
			}
		}
		frontier = next;
		if (frontier.length === 0) break;
	}

	const nodes = all.nodes
		.filter((n) => visited.has(n.id))
		.map((n) => ({ ...n, isCurrent: n.id === slug }));
	const inSet = new Set(visited);
	const links = all.links.filter(
		(l) => inSet.has(l.source) && inSet.has(l.target),
	);

	return { nodes, links };
}
