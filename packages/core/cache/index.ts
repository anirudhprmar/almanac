import * as memoryCache from "./memory-cache";
import * as redisCache from "./redis-client";

function isRedisConfigured(): boolean {
  const raw =
    process.env.CACHE_PROVIDER ??
    process.env.CACHE_DRIVER ??
    process.env.CACHE ??
    "";
  const normalized = raw.toString().trim().toLowerCase();
  if (normalized === "memory" || normalized === "map" || normalized === "inmemory") return false;
  if (normalized === "redis") return true;
  if (process.env.USE_REDIS === "true" || process.env.REDIS_ENABLED === "true") return true;

  // Auto-detect: if REDIS_URL is set (covers docker redis://redis:6379 and local)
  // Even local redis://localhost:6379 counts as configured - we will probe availability
  const redisUrl = (process.env.REDIS_URL ?? "").trim();
  return redisUrl.length > 0;
}

// Circuit breaker to avoid hammering unavailable Redis
let redisUnavailableUntil = 0;
const REDIS_COOLDOWN_MS = 5000;

async function isRedisAvailable(): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  if (Date.now() < redisUnavailableUntil) return false;
  try {
    const ok = await redisCache.isRedisReady();
    if (!ok) throw new Error("Redis not ready");
    return true;
  } catch {
    redisUnavailableUntil = Date.now() + REDIS_COOLDOWN_MS;
    return false;
  }
}

function markRedisDown(): void {
  redisUnavailableUntil = Date.now() + REDIS_COOLDOWN_MS;
}

export function getCacheProvider(): "memory" | "redis" {
  // Synchronous best-effort - if configured but in cooldown, report memory (silent fallback)
  if (!isRedisConfigured()) return "memory";
  if (Date.now() < redisUnavailableUntil) return "memory";
  // If we haven't probed yet, optimistically report redis when configured
  return "redis";
}

export function isRedisEnabled(): boolean {
  return isRedisConfigured();
}

export function configureCache(opts: { url?: string; provider?: string }): void {
  if (opts.provider) process.env.CACHE_PROVIDER = opts.provider;
  if (opts.url) redisCache.configureRedis({ url: opts.url });
}

export async function ensureCacheConnected(): Promise<void> {
  if (!isRedisConfigured()) {
    await memoryCache.ensureMemoryConnected();
    return;
  }
  try {
    await redisCache.ensureRedisConnected();
    redisUnavailableUntil = 0;
  } catch {
    markRedisDown();
    await memoryCache.ensureMemoryConnected();
  }
}

export async function disconnectCache(): Promise<void> {
  await Promise.all([redisCache.disconnectRedis().catch(() => { }), memoryCache.disconnectMemory().catch(() => { })]);
  redisUnavailableUntil = 0;
}

export async function isCacheReady(): Promise<boolean> {
  if (await isRedisAvailable()) return true;
  return memoryCache.isMemoryReady();
}

export async function pingCache(): Promise<string> {
  if (await isRedisAvailable()) {
    try {
      const pong = await redisCache.pingRedis();
      redisUnavailableUntil = 0;
      return pong;
    } catch {
      markRedisDown();
    }
  }
  return memoryCache.pingMemory();
}

export async function getCachedData<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds = 300,
): Promise<T> {
  // If Redis is configured + available, try it as shared cache; on any failure silently fallback to memory
  if (isRedisConfigured() && (await isRedisAvailable())) {
    try {
      const result = await redisCache.getCachedData(key, fetchFn, ttlSeconds);
      // If we got here, Redis was reachable - reset cooldown
      redisUnavailableUntil = 0;
      return result;
    } catch {
      markRedisDown();
      // silent fallback
    }
  }
  return memoryCache.getCachedData(key, fetchFn, ttlSeconds);
}

export async function invalidateCache(keyOrPattern: string): Promise<void> {
  // Invalidate both to keep them in sync when fallback was used
  if (isRedisConfigured()) {
    try {
      if (await isRedisAvailable()) {
        await redisCache.invalidateCache(keyOrPattern);
      }
    } catch {
      markRedisDown();
    }
  }
  await memoryCache.invalidateCache(keyOrPattern);
}

export { memoryCache, redisCache };

export const cacheClient = {
  get provider() {
    return getCacheProvider();
  },
};
