import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const CONFIG_FILENAMES = [
	"almanac.config.ts",
	"almanac.config.js",
	"almanac.config.mjs",
	"almanac.config.json",
] as const;

export function isAlmanacRoot(dir: string): boolean {
	let packageName: string | null = null;
	try {
		const raw = readFileSync(join(dir, "package.json"), "utf-8");
		packageName = (JSON.parse(raw) as { name?: unknown }).name as string;
	} catch {}

	for (const file of CONFIG_FILENAMES) {
		if (existsSync(join(dir, file))) return true;
		if (existsSync(join(dir, "config", file))) return true;
	}

	if (packageName === "almanac") return true;

	if (existsSync(join(dir, "wiki"))) return true;

	return false;
}

export function tryFindAlmanacRoot(startDir?: string): string | null {
	let current = resolve(startDir ?? process.cwd());
	for (;;) {
		if (isAlmanacRoot(current)) return current;
		const parent = dirname(current);
		if (parent === current) return null;
		current = parent;
	}
}

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
