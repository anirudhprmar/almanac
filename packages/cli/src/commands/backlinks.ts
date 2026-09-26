import { loadArticles } from "@almanac/core/article-loader";
import { buildBacklinkMap } from "@almanac/core/backlinks";
import { slugify } from "@almanac/core/markdown-parser";
import { defineCommand } from "citty";
import { dirArg, jsonArg } from "../utils/args.ts";
import { resolveContentDir } from "../utils/content-dir.ts";
import { printJson } from "../utils/output.ts";

export default defineCommand({
	meta: {
		name: "backlinks",
		description: "List articles linking to the given slug",
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
		const backlinks = buildBacklinkMap(articles).get(canonical) ?? [];

		if (asJson) {
			printJson(
				backlinks.map((b) => ({
					slug: b.slug,
					title: b.title,
					description: b.description ?? null,
				})),
			);
			return;
		}

		if (backlinks.length === 0) {
			console.log(`No backlinks to "${canonical}"`);
			return;
		}
		for (const b of backlinks) console.log(`${b.slug}\t${b.title}`);
	},
});
