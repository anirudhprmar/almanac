import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CONFIG_FILENAMES } from "./find-root.ts";

export type AlmanacConfig = {
	/** Human-readable vault name (set by `almanac init --name`). */
	name?: string;
	/** Markdown vault dir, relative to root. Defaults to "wiki". */
	contentDir?: string;
	/** Raw imports dir, relative to root. Defaults to "raw". */
	rawDir?: string;
	/** Drafts dir, relative to root. Defaults to "drafts". */
	draftsDir?: string;
	/** Build output dir, relative to root. Defaults to "outputs". */
	outputDir?: string;
	/** Next.js frontend port. Defaults to 3001. */
	webPort?: number;
	/** Hono server port. Defaults to 3000. */
	serverPort?: number;
	/** Compile defaults (LLM + source scanning). All optional. */
	compile?: {
		provider?: string;
		model?: string;
		baseUrl?: string;
		includeDrafts?: boolean;
		includeOutputs?: boolean;
		maxCharsPerFile?: number;
	};
};

export type ResolvedAlmanacConfig = {
	name: string;
	/** Absolute content dir. */
	contentDir: string;
	/** Absolute raw dir. */
	rawDir: string;
	/** Absolute drafts dir. */
	draftsDir: string;
	/** Absolute output dir. */
	outputDir: string;
	webPort: number;
	serverPort: number;
	/** Resolved compile defaults (flags override these). */
	compile: {
		provider?: string;
		model?: string;
		baseUrl?: string;
		includeDrafts: boolean;
		includeOutputs: boolean;
		maxCharsPerFile: number;
	};
};

export type LoadedConfig = {
	root: string;
	config: ResolvedAlmanacConfig;
	/** Absolute config path, or null when falling back to defaults. */
	configPath: string | null;
};

const DEFAULTS = {
	name: "My Almanac",
	contentDir: "wiki",
	rawDir: "raw",
	draftsDir: "drafts",
	outputDir: "outputs",
	webPort: 3001,
	serverPort: 3000,
} as const;

/** Candidate config paths: config/almanac.config.* first, then root-level. */
export function configCandidates(root: string): string[] {
	const out: string[] = [];
	for (const scope of ["config", "."]) {
		for (const file of CONFIG_FILENAMES) {
			out.push(resolve(root, scope, file));
		}
	}
	return out;
}

function asString(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value : null;
}

function asPort(value: unknown): number | null {
	const n = typeof value === "string" ? Number.parseInt(value, 10) : value;
	return typeof n === "number" && Number.isFinite(n) && n > 0 && n < 65536
		? n
		: null;
}

function asMaxChars(value: unknown): number | null {
	const n = typeof value === "string" ? Number.parseInt(value, 10) : value;
	return typeof n === "number" &&
		Number.isFinite(n) &&
		n >= 1000 &&
		n <= 200_000
		? n
		: null;
}

function asBool(value: unknown): boolean | null {
	return typeof value === "boolean" ? value : null;
}

function resolveConfig(
	root: string,
	raw: AlmanacConfig | null,
): ResolvedAlmanacConfig {
	const contentDir = asString(raw?.contentDir) ?? DEFAULTS.contentDir;
	const rawDir = asString(raw?.rawDir) ?? DEFAULTS.rawDir;
	const draftsDir = asString(raw?.draftsDir) ?? DEFAULTS.draftsDir;
	const outputDir = asString(raw?.outputDir) ?? DEFAULTS.outputDir;
	return {
		name: asString(raw?.name) ?? DEFAULTS.name,
		contentDir: resolve(root, contentDir),
		rawDir: resolve(root, rawDir),
		draftsDir: resolve(root, draftsDir),
		outputDir: resolve(root, outputDir),
		webPort: asPort(raw?.webPort) ?? DEFAULTS.webPort,
		serverPort: asPort(raw?.serverPort) ?? DEFAULTS.serverPort,
		compile: {
			provider: asString(raw?.compile?.provider) ?? undefined,
			model: asString(raw?.compile?.model) ?? undefined,
			baseUrl: asString(raw?.compile?.baseUrl) ?? undefined,
			includeDrafts: asBool(raw?.compile?.includeDrafts) ?? true,
			includeOutputs: asBool(raw?.compile?.includeOutputs) ?? false,
			maxCharsPerFile: asMaxChars(raw?.compile?.maxCharsPerFile) ?? 24_000,
		},
	};
}

async function readConfigFile(path: string): Promise<AlmanacConfig | null> {
	if (path.endsWith(".json")) {
		try {
			return JSON.parse(await readFile(path, "utf-8")) as AlmanacConfig;
		} catch {
			return null;
		}
	}
	// .ts/.js/.mjs — dynamic import (works under Bun; falls back to null).
	try {
		const mod = (await import(pathToFileURL(path).href)) as unknown;
		const exported =
			mod !== null &&
			typeof mod === "object" &&
			"default" in mod &&
			(mod as { default: unknown }).default !== undefined
				? (mod as { default: unknown }).default
				: mod;
		if (typeof exported === "function") {
			const called = (exported as () => unknown)();
			return (
				(called !== null && typeof called === "object"
					? (called as AlmanacConfig)
					: null) ?? null
			);
		}
		return exported !== null && typeof exported === "object"
			? (exported as AlmanacConfig)
			: null;
	} catch {
		return null;
	}
}

/**
 * Load the Almanac config for `root`. Missing/unreadable configs fall back
 * to defaults with `configPath: null` — never throws for a missing file.
 */
export async function loadAlmanacConfig(root: string): Promise<LoadedConfig> {
	const absolute = resolve(root);
	for (const candidate of configCandidates(absolute)) {
		if (!existsSync(candidate)) continue;
		const raw = await readConfigFile(candidate);
		return {
			root: absolute,
			config: resolveConfig(absolute, raw),
			configPath: candidate,
		};
	}
	return {
		root: absolute,
		config: resolveConfig(absolute, null),
		configPath: null,
	};
}

/** Absolute content dir, honoring an explicit `--dir` override. */
export function contentDirFromRoot(
	config: ResolvedAlmanacConfig,
	explicitDir?: string,
): string {
	const fromFlag = explicitDir?.trim();
	if (fromFlag) return resolve(fromFlag);
	const fromEnv = process.env.CONTENT_DIR?.trim();
	if (fromEnv) return resolve(fromEnv);
	return config.contentDir;
}
