import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { getArticles } from "@almanac/core/article-loader";
import { buildBacklinkMap } from "@almanac/core/backlinks";
import { getCachedData } from "@almanac/core/cache";
import { buildGraphData, getLocalGraph } from "@almanac/core/graph";

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

export async function getArticleDetail(slug: string) {
	const dir = contentDir();
	const articles = await getArticles(dir);
	const article = articles.find((a) => a.slug === slug) ?? null;
	if (!article) return null;
	const backlinks = buildBacklinkMap(articles).get(article.slug) ?? [];
	return { article, backlinks };
}
