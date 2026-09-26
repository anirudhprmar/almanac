import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tryFindAlmanacRoot } from "./find-root.ts";

/**
 * Resolve the markdown vault directory.
 *
 * Precedence: `--dir` flag > `CONTENT_DIR` env > `contentDir` from the
 * project config (when readable as JSON) > `wiki/` under the Almanac
 * root found by {@link tryFindAlmanacRoot} > nearest `wiki/` walking up
 * from cwd > `<cwd>/wiki`.
 */
export function resolveContentDir(explicitDir?: string): string {
	const fromFlag = explicitDir?.trim();
	if (fromFlag) return resolve(fromFlag);

	const fromEnv = process.env.CONTENT_DIR?.trim();
	if (fromEnv) return resolve(fromEnv);

	// Anchor on the project root so vault commands work from any subdir.
	try {
		const root = tryFindAlmanacRoot();
		if (root) {
			const fromJsonConfig = readJsonContentDir(root);
			if (fromJsonConfig) return fromJsonConfig;
			const vault = join(root, "wiki");
			if (existsSync(vault)) return vault;
		}
	} catch {
		// Fall through to the directory walk below.
	}

	let current = resolve(process.cwd());
	for (let i = 0; i < 6; i++) {
		const candidate = resolve(current, "wiki");
		if (existsSync(candidate)) return candidate;
		const parent = resolve(current, "..");
		if (parent === current) break;
		current = parent;
	}

	return resolve(process.cwd(), "wiki");
}

/** Sync-readable contentDir: only JSON configs (TS needs a runtime import). */
function readJsonContentDir(root: string): string | null {
	for (const candidate of [
		join(root, "config", "almanac.config.json"),
		join(root, "almanac.config.json"),
	]) {
		try {
			const raw = JSON.parse(readFileSync(candidate, "utf-8")) as {
				contentDir?: unknown;
			};
			if (typeof raw.contentDir === "string" && raw.contentDir.trim()) {
				return resolve(root, raw.contentDir.trim());
			}
		} catch {
			// Missing or unparsable — try the next candidate.
		}
	}
	return null;
}
