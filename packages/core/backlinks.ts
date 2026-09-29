import { type Article, loadArticles } from "./article-loader";
import { slugify } from "./markdown-parser";

const WIKI_RE = /!?\[\[([^[\]|#]+)?(#[^[\]|]+)?(\|[^[\]]+)?\]\]/g;

const MD_RE = /(?<!!)\[[^\]]+\]\(([^)\s#]+)(#[^)]+)?\)/g;
const CODE_FENCE_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`[^`]*`/g;

const MEDIA_EXT =
	/\.(png|jpe?g|gif|bmp|webp|svg|mp4|webm|ogv|mov|mkv|avi|mp3|wav|ogg|flac|pdf|canvas|base)$/i;

function stripCode(content: string): string {
	return content.replace(CODE_FENCE_RE, "").replace(INLINE_CODE_RE, "");
}

export function normalizeLinkTarget(raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;
	if (/^(https?:)?\/\//i.test(trimmed)) return null;
	if (trimmed.startsWith("obsidian://") || trimmed.startsWith("#")) return null;
	if (MEDIA_EXT.test(trimmed.split("#")[0] ?? "")) return null;
	const base = (trimmed.split("#")[0] ?? "").split("/").pop() ?? "";
	const withoutExt = base.replace(/\.md$/i, "");
	const slug = slugify(withoutExt);
	return slug || null;
}

export function extractOutgoingSlugs(content: string): string[] {
	const clean = stripCode(content);
	const out = new Set<string>();

	for (const m of clean.matchAll(WIKI_RE)) {
		if (m[0].startsWith("!")) continue;
		const slug = normalizeLinkTarget(m[1] ?? "");
		if (slug) out.add(slug);
	}
	for (const m of clean.matchAll(MD_RE)) {
		const slug = normalizeLinkTarget(m[1] ?? "");
		if (slug) out.add(slug);
	}
	return [...out];
}

function buildSlugIndex(articles: Article[]): Map<string, Article> {
	const index = new Map<string, Article>();
	for (const a of articles) {
		index.set(a.slug, a);

		const titleSlug = slugify(a.title);
		if (!index.has(titleSlug)) index.set(titleSlug, a);
		const aliases = a.frontmatter?.aliases;
		if (Array.isArray(aliases)) {
			for (const alias of aliases) {
				const s = slugify(String(alias));
				if (s && !index.has(s)) index.set(s, a);
			}
		}
	}
	return index;
}

export function resolveSlug(
	rawTarget: string,
	articles: Article[],
): string | null {
	const normalized = normalizeLinkTarget(rawTarget);
	if (!normalized) return null;
	return buildSlugIndex(articles).get(normalized)?.slug ?? null;
}

export function buildOutgoingMap(articles: Article[]): Map<string, string[]> {
	const index = buildSlugIndex(articles);
	const map = new Map<string, string[]>();
	for (const article of articles) {
		const resolved = extractOutgoingSlugs(article.content)
			.map((t) => index.get(t)?.slug)
			.filter((s): s is string => !!s && s !== article.slug);
		map.set(article.slug, [...new Set(resolved)]);
	}
	return map;
}

export function buildBacklinkMap(articles: Article[]): Map<string, Article[]> {
	const index = buildSlugIndex(articles);
	const bySlug = new Map(articles.map((a) => [a.slug, a]));
	const backlinks = new Map<string, Article[]>();
	for (const a of articles) backlinks.set(a.slug, []);

	const outgoing = buildOutgoingMap(articles);
	for (const article of articles) {
		for (const target of outgoing.get(article.slug) ?? []) {
			const dest = bySlug.get(target) ?? index.get(target);
			if (dest) backlinks.get(dest.slug)?.push(article);
		}
	}
	return backlinks;
}

export async function buildBacklinks(
	dirPath: string,
): Promise<Map<string, Article[]>> {
	const articles = await loadArticles(dirPath);
	return buildBacklinkMap(articles);
}

export async function getBacklinks(
	dirPath: string,
	slug: string,
): Promise<Article[]> {
	const key = slugify(slug);
	const map = await buildBacklinks(dirPath);

	return map.get(key) ?? [];
}

export async function getOutgoingLinks(
	dirPath: string,
	slug: string,
): Promise<string[]> {
	const articles = await loadArticles(dirPath);
	const index = buildSlugIndex(articles);
	const canonical = index.get(slugify(slug))?.slug ?? slugify(slug);
	return buildOutgoingMap(articles).get(canonical) ?? [];
}

export const checkForLinks = extractOutgoingSlugs;
