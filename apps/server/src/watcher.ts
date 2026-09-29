import { existsSync } from "node:fs";
import chokidar, { type FSWatcher } from "chokidar";
import { contentDir, refreshContentCache } from "./content";

export type ContentWatcher = {
	watcher: FSWatcher;
	close: () => Promise<void>;
};

export type StartContentWatcherOptions = {
	dir?: string;

	debounceMs?: number;

	onRefresh?: (info: { dir: string; paths: string[] }) => void;
};

function isWatcherDisabled(): boolean {
	const raw = (
		process.env.DISABLE_FILE_WATCHER ??
		process.env.DISABLE_WATCHER ??
		""
	)
		.trim()
		.toLowerCase();
	if (raw === "1" || raw === "true" || raw === "yes") return true;

	if (process.env.NODE_ENV === "test" || process.env.BUN_TEST === "1")
		return true;
	return false;
}

export function startContentWatcher(
	opts: StartContentWatcherOptions = {},
): ContentWatcher | null {
	const dir = opts.dir ?? contentDir();
	const debounceMs = opts.debounceMs ?? 250;

	if (isWatcherDisabled()) {
		console.log("[watcher] file watcher disabled, skipping");
		return null;
	}

	if (!existsSync(dir)) {
		console.warn(`[watcher] content dir missing, skipping watch: ${dir}`);
		return null;
	}

	const watcher = chokidar.watch(dir, {
		ignoreInitial: true,
		ignored: [/(^|[/\\])\../, "**/node_modules/**"],
		awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
	});

	let timer: ReturnType<typeof setTimeout> | null = null;
	let pendingPaths: string[] = [];
	let refreshing = false;
	let queuedWhileRefreshing = false;

	const flush = async () => {
		timer = null;
		if (refreshing) {
			queuedWhileRefreshing = true;
			return;
		}
		const paths = pendingPaths;
		pendingPaths = [];
		if (paths.length === 0) return;
		refreshing = true;
		try {
			console.log(
				`[watcher] content changed (${paths.length} file(s)), refreshing cache...`,
			);
			await refreshContentCache();
			opts.onRefresh?.({ dir, paths });
		} catch (err) {
			console.warn(
				"[watcher] refresh failed:",
				err instanceof Error ? err.message : String(err),
			);
		} finally {
			refreshing = false;
			if (queuedWhileRefreshing) {
				queuedWhileRefreshing = false;
				if (pendingPaths.length > 0) {
					timer = setTimeout(() => void flush(), debounceMs);
				}
			}
		}
	};

	const schedule = (path: string) => {
		pendingPaths.push(path);
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => void flush(), debounceMs);
	};

	const isMarkdownPath = (path: string) => path.toLowerCase().endsWith(".md");

	watcher
		.on("add", (path) => {
			if (!isMarkdownPath(path)) return;
			console.log(`[watcher] file added: ${path}`);
			schedule(path);
		})
		.on("change", (path) => {
			if (!isMarkdownPath(path)) return;
			console.log(`[watcher] file changed: ${path}`);
			schedule(path);
		})
		.on("unlink", (path) => {
			if (!isMarkdownPath(path)) return;
			console.log(`[watcher] file removed: ${path}`);
			schedule(path);
		})
		.on("addDir", (path) => {
			console.log(`[watcher] dir added: ${path}`);
			schedule(path);
		})
		.on("unlinkDir", (path) => {
			console.log(`[watcher] dir removed: ${path}`);
			schedule(path);
		})
		.on("error", (err) => {
			console.error(
				"[watcher] error:",
				err instanceof Error ? err.message : String(err),
			);
		})
		.on("ready", () => {
			console.log(`[watcher] watching ${dir} for markdown changes`);
		});

	const close = async () => {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		pendingPaths = [];
		await watcher.close();
		console.log("[watcher] closed");
	};

	return { watcher, close };
}
