import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { getArticleBySlug, getArticles, loadArticles } from "./article-loader";
import { type AskOptions, type AskResult, askAlmanac } from "./ask";
import {
	buildBacklinkMap,
	buildOutgoingMap,
	extractOutgoingSlugs,
} from "./backlinks";
import type { LlmOverrides } from "./compile-llm";
import { buildGraphData, type GraphData, getLocalGraph } from "./graph";
import { slugify } from "./markdown-parser";
import { type SearchHit, searchArticles } from "./search";
import { loadPreferencesText } from "./wiki-writer";

export type VaultRef = {
	contentDir: string;

	root?: string;
};

function rootOf(ref: VaultRef): string {
	return ref.root ?? resolve(ref.contentDir, "..");
}

function rawDirOf(ref: VaultRef): string {
	return join(rootOf(ref), "raw");
}

function draftsDirOf(ref: VaultRef): string {
	return join(rootOf(ref), "drafts");
}

export async function resolveSlug(
	dir: string,
	input: string,
): Promise<string | null> {
	const key = slugify(input);
	if (!key) return null;
	const articles = await getArticles(dir);
	const found = articles.find(
		(a) =>
			a.slug === key ||
			slugify(a.title) === key ||
			(Array.isArray(a.frontmatter?.aliases) &&
				(a.frontmatter.aliases as unknown[]).some(
					(al) => slugify(String(al)) === key,
				)),
	);
	return found?.slug ?? null;
}

export async function searchVault(
	dir: string,
	query: string,
	limit = 8,
): Promise<{ hits: SearchHit[]; articlesCount: number }> {
	const q = query.trim().slice(0, 200);
	if (!q) return { hits: [], articlesCount: 0 };
	const articles = await getArticles(dir);
	const capped = Math.min(Math.max(limit, 1), 20);
	return {
		hits: searchArticles(articles, q, capped),
		articlesCount: articles.length,
	};
}

export type ArticleDetail = {
	slug: string;
	title: string;
	description?: string;
	content: string;
	path: string;
	lastModified: string;
	categories: string[];
	outgoing: string[];
	backlinks: { slug: string; title: string; description?: string }[];
};

export async function getArticleDetailBySlug(
	dir: string,
	slugInput: string,
	maxChars = 12_000,
): Promise<ArticleDetail | null> {
	const canonical = await resolveSlug(dir, slugInput);
	if (!canonical) return null;
	const articles = await getArticles(dir);
	const article = articles.find((a) => a.slug === canonical) ?? null;
	if (!article) return null;
	const backlinks = buildBacklinkMap(articles).get(article.slug) ?? [];
	const outgoing = buildOutgoingMap(articles).get(article.slug) ?? [];
	const rawCats = article.frontmatter?.categories;
	const categories = Array.isArray(rawCats)
		? rawCats.map((c) => String(c)).filter(Boolean)
		: typeof rawCats === "string" && rawCats.trim()
			? [rawCats.trim()]
			: [];
	return {
		slug: article.slug,
		title: article.title,
		description: article.description,
		content: article.content.slice(
			0,
			Math.min(Math.max(maxChars, 500), 50_000),
		),
		path: article.path,
		lastModified: article.lastModified.toISOString(),
		categories,
		outgoing,
		backlinks: backlinks.map((b) => ({
			slug: b.slug,
			title: b.title,
			description: b.description,
		})),
	};
}

export async function getBacklinksBySlug(
	dir: string,
	slugInput: string,
): Promise<{
	slug: string;
	backlinks: { slug: string; title: string; description?: string }[];
} | null> {
	const canonical = await resolveSlug(dir, slugInput);
	if (!canonical) return null;
	const articles = await getArticles(dir);
	const backlinks = buildBacklinkMap(articles).get(canonical) ?? [];
	return {
		slug: canonical,
		backlinks: backlinks.map((b) => ({
			slug: b.slug,
			title: b.title,
			description: b.description,
		})),
	};
}

export async function getNeighborhoodBySlug(
	dir: string,
	slugInput: string,
	depth = 1,
): Promise<(GraphData & { slug: string }) | null> {
	const canonical = await resolveSlug(dir, slugInput);
	if (!canonical) return null;
	const articles = await getArticles(dir);
	const full = buildGraphData(articles);
	const capped = Math.min(Math.max(depth, 1), 3);
	const local = getLocalGraph(full, canonical, capped);
	if (local.nodes.length === 0) return null;
	return { slug: canonical, ...local };
}

export async function getVaultPreferences(dir: string): Promise<{
	text: string;
	chars: number;
	present: boolean;
}> {
	const text = await loadPreferencesText(dir);
	return { text, chars: text.length, present: text.length > 0 };
}

export async function askVault(
	ref: VaultRef,
	question: string,
	opts?: { limit?: number; llm?: LlmOverrides },
): Promise<AskResult> {
	const args: AskOptions = {
		dir: ref.contentDir,
		limit: opts?.limit,
		llm: opts?.llm,
	};
	return askAlmanac(question, args);
}

export type ImportFileInput = {
	filename: string;

	content?: string;

	sourcePath?: string;

	subdir?: "raw" | "drafts";

	overwrite?: boolean;
};

export type ImportFileResult = {
	path: string;
	relPath: string;
	bytes: number;
	subdir: "raw" | "drafts";
	next: string;
};

function sanitizeFilename(input: string): string {
	const base = basename(input.trim()).replace(/[^a-zA-Z0-9._-]+/g, "-");
	const cleaned =
		base.replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "") || "note.md";
	return /\.[a-z0-9]+$/i.test(cleaned) ? cleaned : `${cleaned}.md`;
}

export async function importFileToVault(
	ref: VaultRef,
	input: ImportFileInput,
): Promise<ImportFileResult> {
	const subdir = input.subdir === "drafts" ? "drafts" : "raw";
	const destDir = subdir === "drafts" ? draftsDirOf(ref) : rawDirOf(ref);
	const filename = sanitizeFilename(input.filename);

	let text: string | null = null;
	if (typeof input.content === "string" && input.content.length > 0) {
		text = input.content;
	} else if (input.sourcePath?.trim()) {
		const abs = resolve(input.sourcePath.trim());
		text = await readFile(abs, "utf-8").catch(() => null);
		if (text === null) {
			throw new Error(`Source file not readable as UTF-8 text: ${abs}`);
		}
	} else {
		throw new Error("Provide either `content` or `sourcePath`.");
	}

	if (text.length > 200_000) {
		throw new Error(
			`Content too large (${text.length} chars, max 200000). Split it and import in parts.`,
		);
	}

	await mkdir(destDir, { recursive: true });
	const dest = join(destDir, filename);
	if (!input.overwrite) {
		try {
			await readFile(dest, "utf-8");
			throw new Error(
				`Destination already exists: ${dest} (pass overwrite: true to replace it).`,
			);
		} catch (err) {
			if (
				err instanceof Error &&
				err.message.startsWith("Destination already exists")
			) {
				throw err;
			}
		}
	}
	await writeFile(dest, text, "utf-8");
	const relPath = `${subdir}/${filename}`;
	return {
		path: dest,
		relPath,
		bytes: Buffer.byteLength(text, "utf-8"),
		subdir,
		next: `Run \`almanac compile\` to fold ${relPath} into wiki/ (or \`almanac compile --dry-run\` to preview).`,
	};
}

export async function getArticleRaw(
	dir: string,
	slugInput: string,
): Promise<{ slug: string; title: string; content: string } | null> {
	const canonical = await resolveSlug(dir, slugInput);
	if (!canonical) return null;
	const article = await getArticleBySlug(dir, canonical);
	if (!article) return null;
	return { slug: article.slug, title: article.title, content: article.content };
}

export { extractOutgoingSlugs, loadArticles };
