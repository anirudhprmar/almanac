import { loadArticles } from "@almanac/core/article-loader";
import { defineCommand } from "citty";
import { dirArg, jsonArg } from "../utils/args.ts";
import { resolveContentDir } from "../utils/content-dir.ts";
import { printJson } from "../utils/output.ts";

export default defineCommand({
	meta: {
		name: "list",
		description: "List all articles in the vault (newest first)",
	},
	args: {
		dir: dirArg,
		json: jsonArg,
		limit: {
			type: "string",
			description: "Max articles to show",
			valueHint: "n",
		},
	},
	async run({ args }) {
		const raw = args as Record<string, unknown>;
		const dir = resolveContentDir(
			typeof raw.dir === "string" ? raw.dir : undefined,
		);
		const limitRaw = typeof raw.limit === "string" ? raw.limit : undefined;
		const limit = limitRaw ? Number.parseInt(limitRaw, 10) : Number.NaN;
		const asJson = raw.json === true;

		const articles = await loadArticles(dir).catch((err: unknown) => {
			console.error(
				`almanac: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
		});

		const rows = (
			Number.isFinite(limit) && (limit as number) > 0
				? articles.slice(0, limit as number)
				: articles
		).map((a) => ({
			slug: a.slug,
			title: a.title,
			description: a.description ?? null,
			lastModified: a.lastModified.toISOString(),
			path: a.path,
		}));

		if (asJson) {
			printJson(rows);
			return;
		}

		if (rows.length === 0) {
			console.log(`No articles found in ${dir}`);
			return;
		}

		for (const row of rows) {
			const desc = row.description ? ` — ${row.description}` : "";
			console.log(`${row.slug}\t${row.title}${desc}`);
		}
		console.log(`\n${rows.length} article(s) from ${dir}`);
	},
});
