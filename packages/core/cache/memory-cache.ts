type Entry = {
	value: string;
	expiresAt: number;
};

const store = new Map<string, Entry>();

function isExpired(entry: Entry): boolean {
	return Date.now() > entry.expiresAt;
}

function globToRegExp(pattern: string): RegExp {
	const escaped = pattern.replace(/[-[\]{}()+.,\\^$|#\s]/g, "\\$&");
	const reStr = `^${escaped.replace(/\*/g, ".*").replace(/\?/g, ".")}$`;
	return new RegExp(reStr);
}

export function configureMemoryCache(): void {}

export async function ensureMemoryConnected(): Promise<void> {}

export async function disconnectMemory(): Promise<void> {
	store.clear();
}

export async function isMemoryReady(): Promise<boolean> {
	return true;
}

export async function pingMemory(): Promise<string> {
	return "PONG";
}

export async function getCachedData<T>(
	key: string,
	fetchFn: () => Promise<T>,
	ttlSeconds = 300,
): Promise<T> {
	const entry = store.get(key);
	if (entry && !isExpired(entry)) {
		try {
			return JSON.parse(entry.value) as T;
		} catch {
			store.delete(key);
		}
	} else if (entry) {
		store.delete(key);
	}

	const fresh = await fetchFn();
	if (fresh !== null && fresh !== undefined) {
		store.set(key, {
			value: JSON.stringify(fresh),
			expiresAt: Date.now() + ttlSeconds * 1000,
		});
	}
	return fresh;
}

export async function invalidateCache(keyOrPattern: string): Promise<void> {
	if (!keyOrPattern.includes("*") && !keyOrPattern.includes("?")) {
		store.delete(keyOrPattern);
		return;
	}
	const re = globToRegExp(keyOrPattern);
	for (const key of store.keys()) {
		if (re.test(key)) store.delete(key);
	}
}

export const getMemoryClient = () => store;
export const memoryClient = store;
