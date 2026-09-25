import type { Article } from "@almanac/core/article-loader";
import { resolveSlug } from "@almanac/core/backlinks";
import { slugify } from "@almanac/core/markdown-parser";
import { ENV } from "@/env";

import { wikiHref } from "./wiki-href";

export { wikiHref };

/** Article as returned by the API (dates serialize to ISO strings). */
type ApiArticle = Omit<Article, "lastModified"> & { lastModified: string };

export type ArticleDetail = {
	article: Article;
	backlinks: Article[];
};

export function serverUrl(): string {
	return (ENV.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3000").replace(
		/\/$/,
		"",
	);
}

function revive(a: ApiArticle): Article {
	return { ...a, lastModified: new Date(a.lastModified) };
}

async function api<T>(path: string): Promise<T> {
	const res = await fetch(`${serverUrl()}${path}`, { cache: "no-store" });
	if (!res.ok) {
		const err = new Error(`API ${path} returned ${res.status}`) as Error & {
			status: number;
		};
		err.status = res.status;
		throw err;
	}
	return res.json() as Promise<T>;
}

function isNotFound(err: unknown): boolean {
	return (
		err instanceof Error && (err as Error & { status?: number }).status === 404
	);
}

/** All articles, newest first. Empty list when the server is unreachable. */
export async function getArticles(): Promise<Article[]> {
	try {
		const articles = await api<ApiArticle[]>("/api/articles");
		return articles.map(revive);
	} catch {
		return [];
	}
}

/** Article + backlinks, or null when missing. */
export async function getArticleDetail(
	slug: string,
): Promise<ArticleDetail | null> {
	try {
		const detail = await api<{
			article: ApiArticle;
			backlinks: ApiArticle[];
		}>(`/api/articles/${encodeURIComponent(slug)}`);
		return {
			article: revive(detail.article),
			backlinks: detail.backlinks.map(revive),
		};
	} catch (err) {
		if (isNotFound(err)) return null;
		throw err;
	}
}

const WIKI_RE = /!?\[\[([^[\]|#]+)?(#[^[\]|]+)?(\|[^[\]]+)?\]\]/g;
const CODE_RE = /(```[\s\S]*?```|`[^`\n]*`)/g;

/**
 * Rewrite Obsidian wikilinks to standard markdown links for react-markdown.
 * `[[Page|Alias]]` -> `[Alias](/wiki/page)`, `[[Page#H]]` keeps `#h` anchor,
 * `![[embed]]` and broken links degrade to plain text. Code spans untouched.
 */
export function resolveWikilinks(content: string, articles: Article[]): string {
	const parts = content.split(CODE_RE);
	for (let i = 0; i < parts.length; i += 2) {
		parts[i] = parts[i].replace(
			WIKI_RE,
			(match, rawPath?: string, rawAnchor?: string, rawAlias?: string) => {
				if (match.startsWith("!")) return (rawPath ?? "").trim();
				const target = (rawPath ?? "").trim();
				const anchor = (rawAnchor ?? "").trim().replace(/^#+/, "");
				const alias = (rawAlias ?? "").replace(/^\|/, "").trim();
				const display =
					alias ||
					(target && anchor ? `${target} › ${anchor}` : target || anchor);

				// Same-page anchor: [[#Heading]]
				if (!target && anchor) return `[${display}](#${slugify(anchor)})`;

				const slug = target ? resolveSlug(target, articles) : null;
				if (!slug) return display;
				const href = anchor
					? `/wiki/${slug}#${slugify(anchor)}`
					: `/wiki/${slug}`;
				// Escape brackets in display text so md parsing stays intact
				const safeDisplay = display.replace(/[[\]]/g, "");
				return `[${safeDisplay}](${href})`;
			},
		);
	}
	return parts.join("");
}
