import { getArticles } from "@almanac/core/article-loader";
import {
	configureCache,
	disconnectCache,
	ensureCacheConnected,
	getCachedData,
	getCacheProvider,
	invalidateCache,
	isCacheReady,
	pingCache,
} from "@almanac/core/cache";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import {
	contentDir,
	getArticleDetail,
	getGraphData,
	getLocalGraphData,
	getSearchIndexJson,
	searchContent,
} from "./content";
import { ENV } from "./env.server";
import { startContentWatcher } from "./watcher";

// Configure cache provider
// Local clone: CACHE_PROVIDER=memory (default, in-memory Map, no docker/redis needed)
// Docker: set CACHE_PROVIDER=redis (or USE_REDIS=true) + REDIS_URL=redis://redis:6379
configureCache({ url: ENV.REDIS_URL, provider: ENV.CACHE_PROVIDER });

if (getCacheProvider() === "redis") {
	ensureCacheConnected().catch((err) =>
		console.warn("Redis initial connect failed - will retry lazily", err),
	);
}

const app = new Hono();

app.use(logger());
app.use(
	"/*",
	cors({
		origin: ENV.CORS_ORIGIN,
		allowMethods: ["GET", "POST", "OPTIONS"],
	}),
);

app.get("/", (c) => {
	return c.text("OK");
});

app.get("/health", async (c) => {
	const started = Date.now();
	const provider = getCacheProvider();
	let cache: "up" | "down" = "down";
	let latencyMs: number | null = null;
	let error: string | null = null;

	try {
		const pong = await pingCache();
		cache = pong === "PONG" ? "up" : "down";
		latencyMs = Date.now() - started;
	} catch (err) {
		error = err instanceof Error ? err.message : String(err);
	}

	const ready = await isCacheReady().catch(() => false);

	return c.json({
		status: cache === "up" ? "ok" : "degraded",
		cache: { provider, status: cache, ready, latencyMs, error },
		// keep redis key for backwards compat if provider is redis
		redis: { provider, status: cache, ready, latencyMs, error },
		env: ENV.NODE_ENV,
	});
});

// Demo: cache-aside example (shows getCachedData wiring)
// GET /cache/demo -> caches timestamp for 60s (memory locally, redis in docker)
app.get("/cache/demo", async (c) => {
	const data = await getCachedData(
		"demo:timestamp",
		async () => ({
			timestamp: new Date().toISOString(),
			generatedAt: Date.now(),
		}),
		60,
	);
	return c.json({ ...data, _cacheProvider: getCacheProvider() });
});

// POST /cache/invalidate/:key -> invalidate pattern
app.post("/cache/invalidate/:key", async (c) => {
	const key = c.req.param("key");
	await invalidateCache(key);
	return c.json({ invalidated: key, provider: getCacheProvider() });
});

// --- Wiki API (articles, backlinks, graph) ---

// GET /api/articles -> all articles (newest first)
app.get("/api/articles", async (c) => {
	try {
		return c.json(await getArticles(contentDir()));
	} catch (err) {
		return c.json(
			{ error: err instanceof Error ? err.message : "Failed to load articles" },
			500,
		);
	}
});

// GET /api/articles/:slug -> article + backlinks
app.get("/api/articles/:slug", async (c) => {
	try {
		const detail = await getArticleDetail(c.req.param("slug"));
		if (!detail) return c.json({ error: "Article not found" }, 404);
		return c.json(detail);
	} catch (err) {
		return c.json(
			{ error: err instanceof Error ? err.message : "Failed to load article" },
			500,
		);
	}
});

// GET /api/search/index -> serialized MiniSearch index for client-side search
// NOTE: register before /api/search/:slug-style routes; kept above /api/search
// for clarity even though there is no conflicting param route today.
app.get("/api/search/index", async (c) => {
	const json = await getSearchIndexJson();
	return c.json(JSON.parse(json));
});

// GET /api/search?q=...&limit=10 -> ranked full-text hits { slug, title, description, score, excerpt }
app.get("/api/search", async (c) => {
	const q = (c.req.query("q") ?? "").trim().slice(0, 200);
	const limit = Math.min(
		Math.max(Number.parseInt(c.req.query("limit") ?? "10", 10) || 10, 1),
		50,
	);
	if (!q) return c.json([]);
	return c.json(await searchContent(q, limit));
});

// GET /api/graph -> global wiki graph { nodes, links }
app.get("/api/graph", async (c) => {
	return c.json(await getGraphData());
});

// GET /api/graph/:slug?depth=1 -> local graph around one article
app.get("/api/graph/:slug", async (c) => {
	const depth = Math.min(
		Math.max(Number.parseInt(c.req.query("depth") ?? "1", 10) || 1, 1),
		3,
	);
	const graph = await getLocalGraphData(c.req.param("slug"), depth);
	if (graph.nodes.length === 0) {
		return c.json({ error: "Article not found" }, 404);
	}
	return c.json(graph);
});

// Keep API in sync with /wiki: on add/change/unlink, invalidate + rebuild caches.
const contentWatcher = startContentWatcher();

// Graceful shutdown
const shutdown = async () => {
	console.log("Shutting down: closing watcher, disconnecting cache...");
	await contentWatcher
		?.close()
		.catch((err) => console.error("Watcher close error on shutdown", err));
	await disconnectCache().catch((err) =>
		console.error("Cache disconnect error on shutdown", err),
	);
};

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

export default app;
