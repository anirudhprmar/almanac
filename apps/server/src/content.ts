import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { getArticles } from "@almanac/core/article-loader";
import { buildBacklinkMap } from "@almanac/core/backlinks";
import { getCachedData, invalidateCache } from "@almanac/core/cache";
import { buildGraphData, getLocalGraph } from "@almanac/core/graph";
import {
	buildSearchIndexJson,
	type SearchHit,
	searchArticles,
} from "@almanac/core/search";
import { brandOf, DEFAULT_SITE_NAME } from "@almanac/core/site-brand";
import { findSiteRoot, readSiteName } from "@almanac/core/site-config";

import { ENV } from "./env.server";

/** Resolve the markdown content dir: CONTENT_DIR env, else <repo>/wiki. */
export function contentDir(): string {
	const fromEnv = ENV.CONTENT_DIR?.trim();
	if (fromEnv) return resolve(fromEnv);
	// Works whether cwd is apps/server (bun dev) or the repo root (turbo/docker)
	for (const candidate of [
		resolve(process.cwd(), "../../wiki"),
		resolve(process.cwd(), "wiki"),
	]) {
		if (existsSync(candidate)) return candidate;
	}
	return resolve(process.cwd(), "../../wiki");
}

const GRAPH_TTL_SECONDS = 300;

/**
 * Encyclopedia brand for the frontend: `{ name, pedia }`, e.g.
 * `{ name: "Anirudh", pedia: "Anirudhpedia" }`.
 * Source order: SITE_NAME env override -> almanac.config.* name -> default.
 */
export async function getSiteBrand(): Promise<{ name: string; pedia: string }> {
	const fromEnv = process.env.SITE_NAME?.trim();
	if (fromEnv) return brandOf(fromEnv);
	try {
		const root = findSiteRoot(contentDir()) ?? contentDir();
		const fromConfig = await readSiteName(root);
		return brandOf(fromConfig ?? DEFAULT_SITE_NAME);
	} catch {
		return brandOf(DEFAULT_SITE_NAME);
	}
}

export async function getGraphData() {
	const dir = contentDir();
	try {
		return await getCachedData(
			`graph:${dir}`,
			async () => buildGraphData(await getArticles(dir)),
			GRAPH_TTL_SECONDS,
		);
	} catch {
		return { nodes: [], links: [] };
	}
}

export async function getLocalGraphData(slug: string, depth: number) {
	return getLocalGraph(await getGraphData(), slug, depth);
}

const SEARCH_INDEX_TTL_SECONDS = 300;

export async function searchContent(
	query: string,
	limit = 10,
): Promise<SearchHit[]> {
	const q = query.trim().slice(0, 200);
	if (!q) return [];
	const dir = contentDir();
	try {
		const articles = await getArticles(dir);
		return searchArticles(articles, q, limit);
	} catch {
		return [];
	}
}

/**
 * Serialized MiniSearch index JSON for the whole vault.
 * Fetch once from the browser for instant client-side search
 * (Obsidian/Quartz-style) via `loadSearchIndex` in `@almanac/core/search`.
 */
export async function getSearchIndexJson(): Promise<string> {
	const dir = contentDir();
	try {
		return await getCachedData(
			`search-index:${dir}`,
			async () => buildSearchIndexJson(await getArticles(dir)),
			SEARCH_INDEX_TTL_SECONDS,
		);
	} catch {
		return buildSearchIndexJson([]);
	}
}

export async function getArticleDetail(slug: string) {
	const dir = contentDir();
	const articles = await getArticles(dir);
	const article = articles.find((a) => a.slug === slug) ?? null;
	if (!article) return null;
	const backlinks = buildBacklinkMap(articles).get(article.slug) ?? [];
	return { article, backlinks };
}

/**
 * Invalidate all wiki-derived caches (articles, graph, search index).
 * Called by the file watcher when markdown under CONTENT_DIR changes,
 * and available to API consumers (e.g. POST /cache/invalidate/*).
 */
export async function invalidateContentCache(): Promise<void> {
	await Promise.all([
		invalidateCache("articles:*"),
		invalidateCache("graph:*"),
		invalidateCache("search-index:*"),
	]);
}

/**
 * Warm the caches after an invalidation so the next API request is fast.
 * Best-effort: logs and swallows errors so watcher callbacks never crash.
 */
export async function rebuildContentCache(): Promise<void> {
	const dir = contentDir();
	try {
		const articles = await getArticles(dir);
		await Promise.all([getGraphData(), getSearchIndexJson()]);
		console.log(
			`[content] rebuilt cache: ${articles.length} articles from ${dir}`,
		);
	} catch (err) {
		console.warn(
			"[content] cache rebuild failed:",
			err instanceof Error ? err.message : String(err),
		);
	}
}

/** Invalidate + rebuild in one step (file-watcher path). */
export async function refreshContentCache(): Promise<void> {
	await invalidateContentCache();
	await rebuildContentCache();
}
