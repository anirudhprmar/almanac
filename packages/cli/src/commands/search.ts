import { loadArticles } from "@almanac/core/article-loader";
import { searchArticles } from "@almanac/core/search";
import { defineCommand } from "citty";
import { dirArg, jsonArg } from "../utils/args.ts";
import { resolveContentDir } from "../utils/content-dir.ts";
import { printJson } from "../utils/output.ts";

export default defineCommand({
	meta: {
		name: "search",
		description: "Full-text search across the vault",
	},
	args: {
		query: {
			type: "positional",
			description: "Search query",
			required: true,
			valueHint: "query",
		},
		dir: dirArg,
		json: jsonArg,
		limit: {
			type: "string",
			description: "Max results (1-50)",
			default: "10",
			valueHint: "n",
		},
	},
	async run({ args }) {
		const raw = args as Record<string, unknown>;
		const query = String(raw.query ?? "");
		const dir = resolveContentDir(
			typeof raw.dir === "string" ? raw.dir : undefined,
		);
		const asJson = raw.json === true;
		const limitRaw = typeof raw.limit === "string" ? raw.limit : "10";
		const limit = Math.min(
			Math.max(Number.parseInt(limitRaw, 10) || 10, 1),
			50,
		);

		const articles = await loadArticles(dir).catch((err: unknown) => {
			console.error(
				`almanac: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
		});

		const hits = searchArticles(articles, query, limit);

		if (asJson) {
			printJson(hits);
			return;
		}

		if (hits.length === 0) {
			console.log(`No results for "${query}" in ${dir}`);
			return;
		}

		for (const hit of hits) {
			console.log(`${hit.score.toFixed(3)}\t${hit.slug}\t${hit.title}`);
			if (hit.excerpt) console.log(`  ${hit.excerpt}`);
		}
	},
});
