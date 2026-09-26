import type { Article } from "@almanac/core/article-loader";
import { slugify } from "@almanac/core/markdown-parser";

export type TocEntry = { id: string; text: string; level: number };

const HEADING_RE = /^(#{1,4})\s+(.+?)\s*#?\s*$/;
const CODE_FENCE_RE = /^```/;

/** Extract ## / ### headings from raw markdown for the Contents box. */
export function buildToc(content: string): TocEntry[] {
	const entries: TocEntry[] = [];
	let inCode = false;
	for (const line of content.split("\n")) {
		if (CODE_FENCE_RE.test(line.trim())) {
			inCode = !inCode;
			continue;
		}
		if (inCode) continue;
		const m = HEADING_RE.exec(line);
		if (!m) continue;
		const level = m[1].length;
		if (level < 2) continue; // h1 is the article title itself
		const text = m[2].replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
		if (!text) continue;
		entries.push({ id: slugify(text), text, level });
	}
	return entries.slice(0, 40);
}

const WIKILINK_RE = /\[\[([^[\]|#]+)?(#[^[\]|]+)?(\|[^[\]]+)?\]\]/g;

/** Outgoing [[wikilink]] targets, resolved to slugs when possible. */
export function extractOutgoing(content: string, articles: Article[]) {
	const byTitle = new Map(articles.map((a) => [a.title.toLowerCase(), a]));
	const bySlug = new Map(articles.map((a) => [a.slug, a]));
	const seen = new Map<string, Article>();
	for (;;) {
		const match = WIKILINK_RE.exec(content);
		if (match === null) break;
		const raw = (match[1] ?? "").trim();
		if (!raw) continue;
		const key = raw.toLowerCase();
		const hit =
			byTitle.get(key) ?? bySlug.get(key) ?? bySlug.get(slugify(raw)) ?? null;
		if (hit && !seen.has(hit.slug)) seen.set(hit.slug, hit);
	}
	return [...seen.values()].sort((a, b) => a.title.localeCompare(b.title));
}

/** Plain-text excerpt for featured-article boxes and search fallbacks. */
export function excerpt(content: string, maxLen = 320): string {
	const plain = content
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`([^`]*)`/g, "$1")
		.replace(/!\[\[.*?\]\]/g, " ")
		.replace(/\[\[([^|\]]+)(\|([^[\]]+))?\]\]/g, "$3$1")
		.replace(/!?\[[^\]]*\]\([^)]*\)/g, " ")
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/[*_~>#|-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (plain.length <= maxLen) return plain;
	return `${plain.slice(0, maxLen).trimEnd()}…`;
}

export function wordCount(content: string): number {
	return content.trim() ? content.trim().split(/\s+/).length : 0;
}

export function formatWikiDate(d: Date | string): string {
	const date = d instanceof Date ? d : new Date(d);
	if (Number.isNaN(date.getTime())) return "unknown date";
	return date.toLocaleDateString("en-US", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

const CATEGORY_KEYS = ["categories", "category", "tags", "tag"];

/** Categories from frontmatter (`categories` / `tags`), else empty. */
export function articleCategories(article: Article): string[] {
	const out: string[] = [];
	for (const key of CATEGORY_KEYS) {
		const v = (article.frontmatter as Record<string, unknown>)[key];
		if (typeof v === "string" && v.trim()) out.push(v.trim());
		else if (Array.isArray(v))
			for (const item of v)
				if (typeof item === "string" && item.trim()) out.push(item.trim());
	}
	return [...new Set(out)];
}

/** Scalar frontmatter rows worth showing in the infobox. */
export function infoboxRows(
	article: Article,
): { label: string; value: string }[] {
	const skip = new Set(["title", "slug", "description", ...CATEGORY_KEYS]);
	const rows: { label: string; value: string }[] = [];
	for (const [k, v] of Object.entries(article.frontmatter ?? {})) {
		if (skip.has(k)) continue;
		if (
			typeof v === "string" ||
			typeof v === "number" ||
			typeof v === "boolean"
		) {
			const value = String(v).trim();
			if (!value) continue;
			rows.push({ label: wikiLabel(k), value });
		}
	}
	return rows.slice(0, 12);
}

function wikiLabel(key: string): string {
	return key
		.replace(/[_-]+/g, " ")
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/\b\w/g, (c) => c.toUpperCase());
}
