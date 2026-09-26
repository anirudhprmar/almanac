import { loadArticles } from "@almanac/core/article-loader";
import { buildOutgoingMap } from "@almanac/core/backlinks";
import { slugify } from "@almanac/core/markdown-parser";
import { defineCommand } from "citty";
import { dirArg, jsonArg } from "../utils/args.ts";
import { resolveContentDir } from "../utils/content-dir.ts";
import { printJson } from "../utils/output.ts";

export default defineCommand({
	meta: {
		name: "links",
		description: "List outgoing links from the given article",
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
		const canonical =
			articles.find((a) => a.slug === key || slugify(a.title) === key)?.slug ??
			key;
		const outgoing = buildOutgoingMap(articles).get(canonical) ?? [];
		const bySlug = new Map(articles.map((a) => [a.slug, a]));

		if (asJson) {
			printJson(
				outgoing.map((slug) => ({
					slug,
					title: bySlug.get(slug)?.title ?? slug,
				})),
			);
			return;
		}

		if (outgoing.length === 0) {
			console.log(`No outgoing links from "${canonical}"`);
			return;
		}
		for (const slug of outgoing) {
			console.log(`${slug}\t${bySlug.get(slug)?.title ?? ""}`);
		}
	},
});
