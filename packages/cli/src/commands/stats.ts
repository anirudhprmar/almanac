import { loadArticles } from "@almanac/core/article-loader";
import { buildBacklinkMap } from "@almanac/core/backlinks";
import { buildGraphData } from "@almanac/core/graph";
import { defineCommand } from "citty";
import { dirArg, jsonArg } from "../utils/args.ts";
import { resolveContentDir } from "../utils/content-dir.ts";
import { printJson } from "../utils/output.ts";

export default defineCommand({
	meta: {
		name: "stats",
		description: "Show vault statistics (articles, links, orphans)",
	},
	args: {
		dir: dirArg,
		json: jsonArg,
	},
	async run({ args }) {
		const raw = args as Record<string, unknown>;
		const dir = resolveContentDir(
			typeof raw.dir === "string" ? raw.dir : undefined,
		);
		const asJson = raw.json === true;

		const articles = await loadArticles(dir).catch((err: unknown) => {
			console.error(
				`almanac: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
		});

		const graph = buildGraphData(articles);
		const backlinks = buildBacklinkMap(articles);
		const orphans = graph.nodes.filter((n) => n.degree === 0);
		const mostLinked = [...graph.nodes]
			.sort((a, b) => b.degree - a.degree)
			.slice(0, 5)
			.map((n) => ({
				slug: n.id,
				title: n.title,
				degree: n.degree,
				backlinks: backlinks.get(n.id)?.length ?? 0,
			}));

		const stats = {
			dir,
			articles: articles.length,
			links: graph.links.length,
			orphans: orphans.length,
			avgDegree:
				graph.nodes.length === 0
					? 0
					: Number(
							(graph.links.length / Math.max(1, graph.nodes.length)).toFixed(2),
						),
			mostConnected: mostLinked,
		};

		if (asJson) {
			printJson(stats);
			return;
		}

		console.log(`Vault: ${dir}`);
		console.log(`Articles: ${stats.articles}`);
		console.log(`Links: ${stats.links}`);
		console.log(`Orphans: ${stats.orphans}`);
		console.log(`Avg links/article: ${stats.avgDegree}`);
		if (mostLinked.length > 0) {
			console.log("\nMost connected:");
			for (const n of mostLinked) {
				console.log(`- ${n.slug}\t${n.title} (degree ${n.degree})`);
			}
		}
		if (orphans.length > 0) {
			console.log("\nOrphans:");
			for (const o of orphans.slice(0, 20)) {
				console.log(`- ${o.id}\t${o.title}`);
			}
			if (orphans.length > 20) {
				console.log(`…and ${orphans.length - 20} more`);
			}
		}
	},
});
