import IORedis from "ioredis";

type RedisClient = IORedis;

let client: RedisClient | null = null;
let connecting: Promise<RedisClient> | null = null;
let customUrl: string | null = null;

export function configureRedis(opts: { url: string }): void {
	customUrl = opts.url;
	if (client) {
		void disconnectRedis();
	}
}

function getRedisUrl(): string {
	if (customUrl) return customUrl;
	return process.env.REDIS_URL ?? "redis://localhost:6379";
}

export function getRedisClient(): RedisClient {
	if (client) return client;

	const url = getRedisUrl();

	client = new IORedis(url, {
		lazyConnect: true,
		enableOfflineQueue: false,
		maxRetriesPerRequest: 2,
		enableReadyCheck: true,
		connectTimeout: 1500,
		retryStrategy: (times: number) => {
			if (times > 2) return null;
			return Math.min(times * 200, 500);
		},
	});

	client.on("error", (err: unknown) =>
		console.error("Redis Client Error", err),
	);
	client.on("connect", () => console.log(`Redis connecting to ${url}...`));
	client.on("ready", () => console.log("Redis ready"));
	client.on("close", () => console.log("Redis connection closed"));
	client.on("reconnecting", () => console.log("Redis reconnecting..."));

	return client;
}

function withTimeout<T>(
	promise: Promise<T>,
	ms: number,
	label: string,
): Promise<T> {
	let timeout: ReturnType<typeof setTimeout>;
	return Promise.race([
		promise,
		new Promise<never>((_, reject) => {
			timeout = setTimeout(
				() => reject(new Error(`${label} timed out after ${ms}ms`)),
				ms,
			);
		}),
	]).finally(() => clearTimeout(timeout));
}

export async function ensureRedisConnected(): Promise<RedisClient> {
	const c = getRedisClient();
	if (c.status === "ready") return c;
	if (connecting) return connecting;

	connecting = withTimeout(
		c.connect().then(() => c),
		2000,
		"Redis connect",
	)
		.then((connected) => {
			connecting = null;
			return connected;
		})
		.catch((err: unknown) => {
			connecting = null;
			try {
				c.disconnect();
			} catch {}
			client = null;
			console.warn("Redis connect failed", err);
			throw err;
		});

	return connecting;
}

export async function disconnectRedis(): Promise<void> {
	connecting = null;
	if (client) {
		try {
			const c = client;
			client = null;
			if (
				c.status === "ready" ||
				c.status === "connect" ||
				c.status === "connecting"
			) {
				await c.quit().catch(() => c.disconnect());
			} else {
				c.disconnect();
			}
		} catch (err) {
			console.warn("Redis disconnect error", err);
		} finally {
			client = null;
		}
	}
}

export async function isRedisReady(): Promise<boolean> {
	try {
		const c = getRedisClient();
		if (c.status !== "ready") return false;
		const pong = await withTimeout(c.ping(), 1000, "Redis ping");
		return pong === "PONG";
	} catch {
		return false;
	}
}

export async function pingRedis(): Promise<string> {
	const c = await ensureRedisConnected();
	return withTimeout(c.ping(), 1000, "Redis ping");
}

export const redisClient = getRedisClient();

export async function getCachedData<T>(
	key: string,
	fetchFn: () => Promise<T>,
	ttlSeconds = 300,
): Promise<T> {
	// 1. Try cache
	try {
		const c = await ensureRedisConnected();
		const cached = await withTimeout(c.get(key), 1000, `Redis get ${key}`);
		if (cached !== null) {
			try {
				return JSON.parse(cached) as T;
			} catch (parseErr) {
				console.warn(
					`Redis cache parse failed for key "${key}", refetching`,
					parseErr,
				);
				await c.del(key).catch(() => {});
			}
		}
	} catch (err) {
		console.warn(`Redis get failed for key "${key}" - bypassing cache`, err);
	}

	// 2. Fetch fresh
	const freshData = await fetchFn();

	// 3. Populate cache (best-effort)
	if (freshData !== null && freshData !== undefined) {
		try {
			const c = await ensureRedisConnected();
			await withTimeout(
				c.set(key, JSON.stringify(freshData), "EX", ttlSeconds),
				1000,
				`Redis set ${key}`,
			);
		} catch (err) {
			console.warn(`Redis set failed for key "${key}"`, err);
		}
	}

	return freshData;
}

export async function invalidateCache(keyOrPattern: string): Promise<void> {
	const c = await ensureRedisConnected();
	if (!keyOrPattern.includes("*") && !keyOrPattern.includes("?")) {
		await c.del(keyOrPattern);
		return;
	}

	let cursor = "0";
	do {
		const [nextCursor, keys] = await c.scan(
			cursor,
			"MATCH",
			keyOrPattern,
			"COUNT",
			"100",
		);
		cursor = nextCursor;
		if (keys.length > 0) {
			await c.del(...keys);
		}
	} while (cursor !== "0");
}

if (typeof process !== "undefined" && typeof process.on === "function") {
	const shutdown = () => {
		void disconnectRedis();
	};
	process.once("SIGINT", shutdown);
	process.once("SIGTERM", shutdown);
}
