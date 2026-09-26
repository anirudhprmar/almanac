import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** Config filenames recognized as an Almanac project marker. */
export const CONFIG_FILENAMES = [
	"almanac.config.ts",
	"almanac.config.js",
	"almanac.config.mjs",
	"almanac.config.json",
] as const;

/** True when `dir` looks like an Almanac project root. */
export function isAlmanacRoot(dir: string): boolean {
	let packageName: string | null = null;
	try {
		const raw = readFileSync(join(dir, "package.json"), "utf-8");
		packageName = (JSON.parse(raw) as { name?: unknown }).name as string;
	} catch {
		// Missing or unparsable package.json — not a name signal.
	}

	// Strongest signal: explicit config file, at the root or under config/.
	for (const file of CONFIG_FILENAMES) {
		if (existsSync(join(dir, file))) return true;
		if (existsSync(join(dir, "config", file))) return true;
	}

	// The monorepo root is named "almanac".
	if (packageName === "almanac") return true;

	// Content vault: a wiki/ dir. Combined with monorepo markers
	// (turbo.json / apps/) this is unambiguous; a bare wiki/ dir
	// also counts so standalone vaults work.
	if (existsSync(join(dir, "wiki"))) return true;

	return false;
}

/** Walk up from `startDir` (default cwd), returning the root or null. */
export function tryFindAlmanacRoot(startDir?: string): string | null {
	let current = resolve(startDir ?? process.cwd());
	for (;;) {
		if (isAlmanacRoot(current)) return current;
		const parent = dirname(current);
		if (parent === current) return null;
		current = parent;
	}
}

/**
 * Reliable project-root lookup. Starts from `process.cwd()` (or `startDir`)
 * and walks up looking for Almanac markers (almanac.config.*, package.json
 * named "almanac", wiki/ folder). Returns the absolute root path.
 *
 * @throws with a clear error (and an `almanac init` hint) when none is found.
 */
export function findAlmanacRoot(startDir?: string): string {
	const start = resolve(startDir ?? process.cwd());
	const root = tryFindAlmanacRoot(start);
	if (!root) {
		throw new Error(
			`almanac: could not find Almanac project root starting from ${start} ` +
				`(looked for ${CONFIG_FILENAMES.join(", ")}, a package.json named "almanac", or a wiki/ folder). ` +
				`Run "almanac init" to bootstrap a new Almanac here.`,
		);
	}
	return root;
}
