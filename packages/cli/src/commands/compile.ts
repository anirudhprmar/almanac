import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadArticles } from "@almanac/core/article-loader";
import { buildGraphData } from "@almanac/core/graph";
import { buildSearchIndexJson } from "@almanac/core/search";
import { defineCommand } from "citty";
import { dirArg, jsonArg } from "../utils/args.ts";
import { contentDirFromRoot, loadAlmanacConfig } from "../utils/config.ts";
import { findAlmanacRoot } from "../utils/find-root.ts";
import { printJson } from "../utils/output.ts";

export default defineCommand({
	meta: {
		name: "compile",
		description: "Compile the vault to static JSON artifacts",
	},
	args: {
		dir: dirArg,
		json: jsonArg,
		out: {
			type: "string",
			description: "Output directory (defaults to config outputDir)",
			alias: "o",
			valueHint: "dir",
		},
		pretty: {
			type: "boolean",
			description: "Pretty-print the JSON artifacts",
			default: false,
		},
	},
	async run({ args }) {
		const raw = args as Record<string, unknown>;
		let root: string;
		try {
			root = findAlmanacRoot();
		} catch (err) {
			console.error(err instanceof Error ? err.message : String(err));
			process.exit(1);
		}

		const { config } = await loadAlmanacConfig(root);
		const dir = contentDirFromRoot(
			config,
			typeof raw.dir === "string" ? raw.dir : undefined,
		);
		const outDir = resolve(
			typeof raw.out === "string" && raw.out ? raw.out : config.outputDir,
		);
		const asJson = raw.json === true;
		const pretty = raw.pretty === true;

		const articles = await loadArticles(dir).catch((err: unknown) => {
			console.error(
				`almanac: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
		});

		const graph = buildGraphData(articles);
		const indexRaw = buildSearchIndexJson(articles);
		const format = (value: unknown): string =>
			pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);

		await mkdir(outDir, { recursive: true });
		const files: [string, string][] = [
			[
				"articles.json",
				format(
					articles.map((a) => ({
						slug: a.slug,
						title: a.title,
						description: a.description ?? null,
						path: a.path,
						lastModified: a.lastModified.toISOString(),
					})),
				),
			],
			["graph.json", format(graph)],
			[
				"search-index.json",
				pretty ? JSON.stringify(JSON.parse(indexRaw), null, 2) : indexRaw,
			],
		];
		for (const [name, text] of files) {
			await writeFile(join(outDir, name), `${text}\n`, "utf-8");
		}

		const summary = {
			root,
			dir,
			outDir,
			articles: articles.length,
			links: graph.links.length,
			files: files.map(([name]) => join(outDir, name)),
		};

		if (asJson) {
			printJson(summary);
			return;
		}
		console.log(
			`Compiled ${summary.articles} article(s), ${summary.links} link(s) to ${outDir}`,
		);
		for (const file of summary.files) console.log(`  ${file}`);
	},
});
