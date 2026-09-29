import { createHash } from "node:crypto";
import type { Dirent, Stats } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

export type RawSource = "raw" | "drafts" | "outputs";

export type RawFile = {
	absPath: string;

	relPath: string;
	source: RawSource;
	ext: string;
	size: number;
	mtimeMs: number;

	text: string;

	truncated: boolean;

	binary: boolean;

	skipReason?: string;
};

export type ScanOptions = {
	rawDir: string;
	draftsDir: string;
	outputDir: string;
	includeDrafts?: boolean;
	includeOutputs?: boolean;

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

	if (ext && !TEXT_EXTS.has(ext)) {
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

export function stateKeyFor(file: Pick<RawFile, "source" | "relPath">): string {
	return `${file.source}:${file.relPath}`;
}

export function fingerprintFor(file: RawFile): string {
	if (file.binary)
		return hashContent(`${file.relPath}|${file.size}|${file.mtimeMs}`);
	return hashContent(file.text);
}
