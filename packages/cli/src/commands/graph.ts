import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadArticles } from "@almanac/core/article-loader";
import { buildGraphData, getLocalGraph } from "@almanac/core/graph";
import { defineCommand } from "citty";
import { dirArg } from "../utils/args.ts";
import { resolveContentDir } from "../utils/content-dir.ts";

function toDot(
	nodes: { id: string; title: string }[],
	links: { source: string; target: string }[],
): string {
	const lines = ["digraph almanac {"];
	for (const n of nodes) {
		lines.push(`  "${n.id}" [label="${n.title.replace(/"/g, "'")}"];`);
	}
	for (const l of links) {
		lines.push(`  "${l.source}" -> "${l.target}";`);
	}
	lines.push("}");
	return `${lines.join("\n")}\n`;
}

export default defineCommand({
	meta: {
		name: "graph",
		description: "Dump the wiki link graph (global or local to a slug)",
	},
	args: {
		slug: {
			type: "positional",
			description: "Optional article slug for a local graph",
			required: false,
			valueHint: "slug",
		},
		dir: dirArg,
		depth: {
			type: "string",
			description: "Local graph depth 1-3 (only with <slug>)",
			default: "1",
			valueHint: "n",
		},
		format: {
			type: "string",
			description: "Output format: json or dot",
			default: "json",
			valueHint: "json|dot",
		},
		output: {
			type: "string",
			description: "Write to file instead of stdout",
			alias: "o",
			valueHint: "file",
		},
	},
	async run({ args }) {
		const raw = args as Record<string, unknown>;
		const slugInput =
			typeof raw.slug === "string" && raw.slug.length > 0
				? raw.slug
				: undefined;
		const dir = resolveContentDir(
			typeof raw.dir === "string" ? raw.dir : undefined,
		);
		const depthRaw = typeof raw.depth === "string" ? raw.depth : "1";
		const formatRaw =
			typeof raw.format === "string" ? raw.format.toLowerCase() : "json";
		const output =
			typeof raw.output === "string" && raw.output.length > 0
				? raw.output
				: undefined;

		if (formatRaw !== "json" && formatRaw !== "dot") {
			console.error('almanac: --format must be "json" or "dot"');
			process.exit(1);
		}

		const articles = await loadArticles(dir).catch((err: unknown) => {
			console.error(
				`almanac: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
		});

		const full = buildGraphData(articles);
		const data = slugInput
			? getLocalGraph(
					full,
					slugInput,
					Math.min(Math.max(Number.parseInt(depthRaw, 10) || 1, 1), 3),
				)
			: full;

		if (slugInput && data.nodes.length === 0) {
			console.error(`almanac: article not found: ${slugInput}`);
			process.exit(1);
		}

		const text =
			formatRaw === "dot"
				? toDot(data.nodes, data.links)
				: JSON.stringify(data, null, 2);

		if (output) {
			const outPath = resolve(output);
			await writeFile(outPath, text, "utf-8");
			console.log(
				`Wrote ${data.nodes.length} nodes, ${data.links.length} links to ${outPath}`,
			);
		} else {
			console.log(text);
		}
	},
});
