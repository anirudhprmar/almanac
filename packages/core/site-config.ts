import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const CONFIG_FILENAMES = [
	"almanac.config.json",
	"almanac.config.ts",
	"almanac.config.js",
	"almanac.config.mjs",
] as const;

function nameFromJsonFile(
	path: string,
	read: (path: string) => Promise<string>,
): Promise<string | null> {
	return read(path)
		.then((raw) => {
			try {
				const parsed = JSON.parse(raw) as { name?: unknown };
				return typeof parsed.name === "string" && parsed.name.trim()
					? parsed.name.trim()
					: null;
			} catch {
				return null;
			}
		})
		.catch(() => null);
}

function nameFromTsFile(
	path: string,
	read: (path: string) => Promise<string>,
): Promise<string | null> {
	return read(path)
		.then((raw) => {
			const m = /(?:^|[\s{,;])name\s*:\s*["']([^"']+)["']/.exec(raw);
			const found = m?.[1]?.trim();
			return found || null;
		})
		.catch(() => null);
}

export async function readSiteName(root: string): Promise<string | null> {
	for (const scope of ["config", "."]) {
		for (const file of CONFIG_FILENAMES) {
			const path = resolve(root, scope, file);
			if (!existsSync(path)) continue;
			const found = file.endsWith(".json")
				? await nameFromJsonFile(path, (p) => readFile(p, "utf-8"))
				: await nameFromTsFile(path, (p) => readFile(p, "utf-8"));
			if (found) return found;
		}
	}
	return null;
}

export function findSiteRoot(startDir: string, maxDepth = 5): string | null {
	let current = resolve(startDir);
	for (let i = 0; i <= maxDepth; i++) {
		if (existsSync(join(current, "wiki"))) return current;
		for (const scope of ["config", "."]) {
			for (const file of CONFIG_FILENAMES) {
				if (existsSync(join(current, scope, file))) return current;
			}
		}
		const parent = dirname(current);
		if (parent === current) return null;
		current = parent;
	}
	return null;
}
