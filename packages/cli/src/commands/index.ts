import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadArticles } from "@almanac/core/article-loader";
import { buildSearchIndexJson } from "@almanac/core/search";
import { defineCommand } from "citty";
import { dirArg } from "../utils/args.ts";
import { resolveContentDir } from "../utils/content-dir.ts";

export default defineCommand({
	meta: {
		name: "index",
		description: "Build a serialized MiniSearch index (for client-side search)",
	},
	args: {
		dir: dirArg,
		output: {
			type: "string",
			description: "Write index JSON to file instead of stdout",
			alias: "o",
			valueHint: "file",
		},
		pretty: {
			type: "boolean",
			description: "Pretty-print JSON",
			default: false,
		},
	},
	async run({ args }) {
		const raw = args as Record<string, unknown>;
		const dir = resolveContentDir(
			typeof raw.dir === "string" ? raw.dir : undefined,
		);
		const output =
			typeof raw.output === "string" && raw.output.length > 0
				? raw.output
				: undefined;
		const pretty = raw.pretty === true;

		const articles = await loadArticles(dir).catch((err: unknown) => {
			console.error(
				`almanac: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
		});

		const compact = buildSearchIndexJson(articles);
		const text = pretty
			? JSON.stringify(JSON.parse(compact), null, 2)
			: compact;

		if (output) {
			const outPath = resolve(output);
			await writeFile(outPath, `${text}\n`, "utf-8");
			console.log(`Indexed ${articles.length} article(s) to ${outPath}`);
		} else {
			console.log(text);
		}
	},
});
