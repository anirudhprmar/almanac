import { loadArticles } from "@almanac/core/article-loader";
import { buildBacklinkMap } from "@almanac/core/backlinks";
import { slugify } from "@almanac/core/markdown-parser";
import { defineCommand } from "citty";
import { dirArg, jsonArg } from "../utils/args.ts";
import { resolveContentDir } from "../utils/content-dir.ts";
import { printJson } from "../utils/output.ts";

export default defineCommand({
	meta: {
		name: "show",
		description: "Show an article with its backlinks",
	},
	args: {
		slug: {
			type: "positional",
			description: "Article slug (or title)",
			required: true,
			valueHint: "slug",
		},
		dir: dirArg,
		json: jsonArg,
	},
	async run({ args }) {
		const raw = args as Record<string, unknown>;
		const slugInput = String(raw.slug ?? "");
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

		const key = slugify(slugInput);
		const article =
			articles.find((a) => a.slug === key || slugify(a.title) === key) ?? null;
		if (!article) {
			console.error(`almanac: article not found: ${slugInput}`);
			process.exit(1);
		}

		const backlinks = buildBacklinkMap(articles).get(article.slug) ?? [];

		if (asJson) {
			printJson({
				article: {
					...article,
					lastModified: article.lastModified.toISOString(),
				},
				backlinks: backlinks.map((b) => ({
					slug: b.slug,
					title: b.title,
					description: b.description ?? null,
				})),
			});
			return;
		}

		console.log(`# ${article.title}`);
		console.log(`slug: ${article.slug}`);
		if (article.description) console.log(`description: ${article.description}`);
		console.log(`path: ${article.path}`);
		console.log(`updated: ${article.lastModified.toISOString()}`);
		console.log("");
		console.log(article.content);
		console.log("");
		if (backlinks.length === 0) {
			console.log("No backlinks.");
		} else {
			console.log(`Backlinks (${backlinks.length}):`);
			for (const b of backlinks) console.log(`- ${b.slug}\t${b.title}`);
		}
	},
});
