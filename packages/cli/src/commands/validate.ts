import { loadArticles } from "@almanac/core/article-loader";
import { extractOutgoingSlugs } from "@almanac/core/backlinks";
import { buildGraphData } from "@almanac/core/graph";
import { slugify } from "@almanac/core/markdown-parser";
import { defineCommand } from "citty";
import { dirArg, jsonArg } from "../utils/args.ts";
import { resolveContentDir } from "../utils/content-dir.ts";
import { printJson } from "../utils/output.ts";

type Issue = {
	kind: "duplicate-slug" | "broken-link" | "orphan";
	slug: string;
	detail: string;
};

export default defineCommand({
	meta: {
		name: "validate",
		description: "Validate the vault (duplicate slugs, broken links, orphans)",
	},
	args: {
		dir: dirArg,
		json: jsonArg,
		strict: {
			type: "boolean",
			description: "Exit non-zero when any issue is found",
			default: false,
		},
	},
	async run({ args }) {
		const raw = args as Record<string, unknown>;
		const dir = resolveContentDir(
			typeof raw.dir === "string" ? raw.dir : undefined,
		);
		const asJson = raw.json === true;
		const strict = raw.strict === true;

		const articles = await loadArticles(dir).catch((err: unknown) => {
			console.error(
				`almanac: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
		});

		const issues: Issue[] = [];

		// Duplicate slugs (same canonical slug from different paths/titles)
		const seen = new Map<string, string>();
		for (const a of articles) {
			const first = seen.get(a.slug);
			if (first && first !== a.path) {
				issues.push({
					kind: "duplicate-slug",
					slug: a.slug,
					detail: `${first} <-> ${a.path}`,
				});
			} else {
				seen.set(a.slug, a.path);
			}
		}

		// Known slugs: canonical + title slugs + aliases
		const known = new Set<string>();
		for (const a of articles) {
			known.add(a.slug);
			known.add(slugify(a.title));
			const aliases = a.frontmatter?.aliases;
			if (Array.isArray(aliases)) {
				for (const alias of aliases) {
					const s = slugify(String(alias));
					if (s) known.add(s);
				}
			}
		}

		// Broken links: outgoing targets with no known article
		for (const a of articles) {
			for (const target of extractOutgoingSlugs(a.content)) {
				if (!known.has(target)) {
					issues.push({
						kind: "broken-link",
						slug: a.slug,
						detail: `links to missing "[[${target}]]"`,
					});
				}
			}
		}

		// Orphans (no in/out links)
		const graph = buildGraphData(articles);
		for (const n of graph.nodes) {
			if (n.degree === 0) {
				issues.push({
					kind: "orphan",
					slug: n.id,
					detail: n.title,
				});
			}
		}

		const summary = {
			dir,
			articles: articles.length,
			issues: issues.length,
			duplicates: issues.filter((i) => i.kind === "duplicate-slug").length,
			brokenLinks: issues.filter((i) => i.kind === "broken-link").length,
			orphans: issues.filter((i) => i.kind === "orphan").length,
			issuesList: issues,
		};

		if (asJson) {
			printJson(summary);
		} else if (issues.length === 0) {
			console.log(`✓ ${articles.length} article(s) in ${dir} — no issues`);
		} else {
			console.log(
				`${articles.length} article(s), ${issues.length} issue(s) in ${dir}:`,
			);
			for (const i of issues) {
				console.log(`[${i.kind}] ${i.slug}: ${i.detail}`);
			}
		}

		if (strict && issues.length > 0) process.exit(1);
	},
});
