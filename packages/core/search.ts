import MiniSearch, { type Options } from "minisearch";
import type { Article } from "./article-loader";

export type SearchableDoc = {
	id: string;
	title: string;
	description: string;
	content: string;
};

export type SearchHit = {
	slug: string;
	title: string;
	description?: string;
	score: number;
	/** ~160-char window around the first query-term match in content. */
	excerpt: string | null;
};

const MINI_OPTIONS = {
	fields: ["title", "description", "content"],
	storeFields: ["title", "description"],
	searchOptions: {
		boost: { title: 3, description: 2, content: 1 },
		prefix: true,
		fuzzy: 0.2,
	},
} satisfies Options<SearchableDoc>;

function toDoc(a: Article): SearchableDoc {
	return {
		id: a.slug,
		title: a.title,
		description: a.description ?? "",
		content: a.content,
	};
}

/**
 * Build an in-memory MiniSearch index over articles.
 * Pure function — safe to call from Hono handlers or the browser.
 */
export function buildSearchIndex(
	articles: Article[],
): MiniSearch<SearchableDoc> {
	const index = new MiniSearch<SearchableDoc>(MINI_OPTIONS);
	index.addAll(articles.map(toDoc));
	return index;
}

/**
 * Serialize an index to plain JSON.
 * Ship this to the browser for instant client-side search
 * (Obsidian/Quartz-style): `MiniSearch.loadJSON(json, options)`.
 */
export function serializeSearchIndex(index: MiniSearch<SearchableDoc>): string {
	return JSON.stringify(index.toJSON());
}

/** Serialize a fresh index built from articles. */
export function buildSearchIndexJson(articles: Article[]): string {
	return serializeSearchIndex(buildSearchIndex(articles));
}

/** Restore an index previously created with `serializeSearchIndex`. */
export function loadSearchIndex(
	json: string | object,
): MiniSearch<SearchableDoc> {
	const data = typeof json === "string" ? JSON.parse(json) : json;
	return MiniSearch.loadJSON<SearchableDoc>(JSON.stringify(data), MINI_OPTIONS);
}

function buildExcerpt(
	content: string,
	query: string,
	windowSize = 160,
): string | null {
	const terms = query
		.toLowerCase()
		.split(/\s+/)
		.map((t) => t.trim())
		.filter((t) => t.length > 1);
	if (terms.length === 0) return null;
	const lower = content.toLowerCase();
	let first = -1;
	let matchedTerm = "";
	for (const term of terms) {
		const idx = lower.indexOf(term);
		if (idx !== -1 && (first === -1 || idx < first)) {
			first = idx;
			matchedTerm = term;
		}
	}
	if (first === -1) return null;
	const half = Math.floor(windowSize / 2);
	const start = Math.max(0, first - half);
	const end = Math.min(content.length, first + matchedTerm.length + half);
	let snippet = content.slice(start, end).replace(/\s+/g, " ").trim();
	if (start > 0) snippet = `…${snippet}`;
	if (end < content.length) snippet = `${snippet}…`;
	return snippet || null;
}

/**
 * Search articles with a prebuilt index.
 * Returns scored hits with excerpts, highest score first.
 */
export function searchWithIndex(
	index: MiniSearch<SearchableDoc>,
	articles: Article[],
	query: string,
	limit = 10,
): SearchHit[] {
	const q = query.trim();
	if (!q) return [];
	const bySlug = new Map(articles.map((a) => [a.slug, a]));
	const results = index.search(q, { prefix: true, fuzzy: 0.2 });
	return results.slice(0, Math.max(1, limit)).map((r) => {
		const article = bySlug.get(r.id);
		return {
			slug: r.id,
			title: (r.title as string) ?? article?.title ?? r.id,
			description:
				(r.description as string) || article?.description || undefined,
			score: r.score,
			excerpt: article ? buildExcerpt(article.content, q) : null,
		};
	});
}

/** Build an index and search in one shot (basic usage, small vaults). */
export function searchArticles(
	articles: Article[],
	query: string,
	limit = 10,
): SearchHit[] {
	if (!query.trim()) return [];
	return searchWithIndex(buildSearchIndex(articles), articles, query, limit);
}
