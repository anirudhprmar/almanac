import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RawFile } from "./raw-scan";
import { stateKeyFor } from "./raw-scan";

const STATE_VERSION = 1;

export type CompileStateEntry = {
	hash: string;
	size: number;
	mtimeMs: number;
	source: string;
};

export type CompileState = {
	version: number;
	updatedAt: string;
	files: Record<string, CompileStateEntry>;
};

export function statePathForRoot(root: string): string {
	return join(root, ".almanac", "compile-state.json");
}

export function emptyState(): CompileState {
	return {
		version: STATE_VERSION,
		updatedAt: new Date(0).toISOString(),
		files: {},
	};
}

export async function loadCompileState(root: string): Promise<CompileState> {
	const path = statePathForRoot(root);
	try {
		const raw = await readFile(path, "utf-8");
		const parsed = JSON.parse(raw) as Partial<CompileState>;
		if (
			!parsed ||
			typeof parsed !== "object" ||
			parsed.version !== STATE_VERSION ||
			!parsed.files ||
			typeof parsed.files !== "object"
		) {
			return emptyState();
		}
		return parsed as CompileState;
	} catch {
		return emptyState();
	}
}

export async function saveCompileState(
	root: string,
	state: CompileState,
): Promise<string> {
	state.updatedAt = new Date().toISOString();
	state.version = STATE_VERSION;
	const path = statePathForRoot(root);
	await mkdir(join(root, ".almanac"), { recursive: true });
	await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
	return path;
}

export type ChangeSelection = {
	changed: RawFile[];
	unchanged: RawFile[];
};

export function selectChangedFiles(
	files: RawFile[],
	state: CompileState,
	hashes: Map<string, string>,
): ChangeSelection {
	const changed: RawFile[] = [];
	const unchanged: RawFile[] = [];
	for (const file of files) {
		const key = stateKeyFor(file);
		const known = state.files[key];
		const hash = hashes.get(key);
		if (!known || !hash || known.hash !== hash) {
			changed.push(file);
		} else {
			unchanged.push(file);
		}
	}
	return { changed, unchanged };
}

export function markProcessed(
	state: CompileState,
	files: RawFile[],
	hashes: Map<string, string>,
): void {
	for (const file of files) {
		const key = stateKeyFor(file);
		const hash = hashes.get(key);
		if (!hash) continue;
		state.files[key] = {
			hash,
			size: file.size,
			mtimeMs: file.mtimeMs,
			source: file.source,
		};
	}
}

export function pruneState(state: CompileState, liveKeys: Set<string>): number {
	let removed = 0;
	for (const key of Object.keys(state.files)) {
		if (!liveKeys.has(key)) {
			delete state.files[key];
			removed++;
		}
	}
	return removed;
}
