import { createHash } from "node:crypto";
import type { Dirent, Stats } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

export type RawSource = "raw" | "drafts" | "outputs";

export type RawFile = {
	/** Absolute path on disk. */
	absPath: string;
	/** Path relative to its source dir (posix-style). */
	relPath: string;
	source: RawSource;
	ext: string;
	size: number;
	mtimeMs: number;
	/** Text content (truncated to maxBytesPerFile when needed). */
	text: string;
	/** True when the file was cut off at maxBytesPerFile. */
	truncated: boolean;
	/** True for binary/media files — content is not readable, metadata only. */
	binary: boolean;
	/** Human-readable reason when binary/skipped. */
	skipReason?: string;
};

export type ScanOptions = {
	rawDir: string;
	draftsDir: string;
	outputDir: string;
	includeDrafts?: boolean;
	includeOutputs?: boolean;
	/** Max chars read per text file. Defaults to 24_000. */
	maxCharsPerFile?: number;
};

const TEXT_EXTS = new Set([
	".md",
	".markdown",
	".txt",
	".json",
	".jsonl",
	".csv",
	".tsv",
	".yaml",
	".yml",
	".html",
	".htm",
]);

const BINARY_EXTS = new Set([
	".pdf",
	".png",
	".jpg",
	".jpeg",
	".gif",
	".bmp",
	".webp",
	".svg",
	".mp4",
	".webm",
	".mov",
	".mkv",
	".avi",
	".mp3",
	".wav",
	".ogg",
	".flac",
	".zip",
	".canvas",
	".base",
]);

const IGNORED_NAMES = new Set([".gitkeep", ".DS_Store", "Thumbs.db"]);

function extOf(name: string): string {
	const i = name.lastIndexOf(".");
	return i === -1 ? "" : name.slice(i).toLowerCase();
}

function toPosix(p: string): string {
	return p.split("\\").join("/");
}

async function collectFiles(dir: string): Promise<string[]> {
	const out: string[] = [];
	async function walk(current: string): Promise<void> {
		let entries: Dirent[];
		try {
			entries = await readdir(current, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			if (entry.name.startsWith(".")) continue;
			if (entry.name === "node_modules") continue;
			if (IGNORED_NAMES.has(entry.name)) continue;
			const full = join(current, entry.name);
			if (entry.isDirectory()) {
				await walk(full);
			} else if (entry.isFile()) {
				out.push(full);
			}
		}
	}
	await walk(dir);
	out.sort();
	return out;
}

/** sha256 hex of a string (used for incremental change detection). */
export function hashContent(text: string): string {
	return createHash("sha256").update(text, "utf-8").digest("hex");
}

async function toRawFile(
	absPath: string,
	baseDir: string,
	source: RawSource,
	maxChars: number,
): Promise<RawFile | null> {
	let st: Stats | undefined;
	try {
		st = await stat(absPath);
	} catch {
		return null;
	}
	if (!st.isFile()) return null;
	const relPath = toPosix(relative(baseDir, absPath));
	const ext = extOf(absPath);
	const size = st.size;
	const mtimeMs = st.mtimeMs;

	if (BINARY_EXTS.has(ext)) {
		return {
			absPath,
			relPath,
			source,
			ext,
			size,
			mtimeMs,
			text: "",
			truncated: false,
			binary: true,
			skipReason: `Binary ${ext || "file"} — needs OCR/vision extraction (recorded as metadata only)`,
		};
	}

	// Unknown extensions without a text signal: treat small files as text,
	// large/extensionless binaries as metadata-only.
	if (ext && !TEXT_EXTS.has(ext)) {
		// Still try to read: chat exports and notes come in many extensions.
		// Fall through to the text read; unreadable bytes become skipReason.
	}

	try {
		const raw = await readFile(absPath, "utf-8");
		const truncated = raw.length > maxChars;
		return {
			absPath,
			relPath,
			source,
			ext,
			size,
			mtimeMs,
			text: truncated ? raw.slice(0, maxChars) : raw,
			truncated,
			binary: false,
		};
	} catch {
		return {
			absPath,
			relPath,
			source,
			ext,
			size,
			mtimeMs,
			text: "",
			truncated: false,
			binary: true,
			skipReason: "Unreadable as UTF-8 text (recorded as metadata only)",
		};
	}
}

/**
 * Scan raw/drafts/outputs for candidate source material.
 * Missing dirs scan as empty — never throws for absent folders.
 */
export async function scanRawInputs(opts: ScanOptions): Promise<RawFile[]> {
	const maxChars = Math.max(
		1000,
		Math.min(opts.maxCharsPerFile ?? 24_000, 200_000),
	);
	const includeDrafts = opts.includeDrafts ?? true;
	const includeOutputs = opts.includeOutputs ?? false;

	const jobs: [string, RawSource][] = [[opts.rawDir, "raw"]];
	if (includeDrafts) jobs.push([opts.draftsDir, "drafts"]);
	if (includeOutputs) jobs.push([opts.outputDir, "outputs"]);

	const out: RawFile[] = [];
	for (const [dir, source] of jobs) {
		const files = await collectFiles(dir);
		for (const abs of files) {
			const rf = await toRawFile(abs, dir, source, maxChars);
			if (rf) out.push(rf);
		}
	}
	return out;
}

/** Stable key for state tracking: `source:relPath`. */
export function stateKeyFor(file: Pick<RawFile, "source" | "relPath">): string {
	return `${file.source}:${file.relPath}`;
}

/** Content fingerprint used for change detection. */
export function fingerprintFor(file: RawFile): string {
	if (file.binary)
		return hashContent(`${file.relPath}|${file.size}|${file.mtimeMs}`);
	return hashContent(file.text);
}
