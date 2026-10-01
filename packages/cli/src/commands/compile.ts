import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { loadArticles } from "@almanac/core/article-loader";
import { buildBacklinkMap, buildOutgoingMap } from "@almanac/core/backlinks";
import {
	callLlm,
	canCallLlm,
	describeLlmConfig,
	parseLlmJson,
	resolveLlmConfig,
} from "@almanac/core/compile-llm";
import {
	batchRawFiles,
	buildBatchPrompt,
	buildCatalog,
	buildSystemPrompt,
	type CompilePlan,
	findRelevantArticles,
	type PlannedArticle,
} from "@almanac/core/compile-prompt";
import {
	loadCompileState,
	markProcessed,
	pruneState,
	saveCompileState,
	selectChangedFiles,
} from "@almanac/core/compile-state";
import { buildGraphData } from "@almanac/core/graph";
import {
	fingerprintFor,
	type RawFile,
	scanRawInputs,
	stateKeyFor,
} from "@almanac/core/raw-scan";
import { buildSearchIndexJson } from "@almanac/core/search";
import {
	lintArticles,
	loadPreferencesText,
	rebuildIndexPage,
	type WriteResult,
	writePlannedArticles,
} from "@almanac/core/wiki-writer";
import { defineCommand } from "citty";
import { dirArg, jsonArg } from "../utils/args.ts";
import { contentDirFromRoot, loadAlmanacConfig } from "../utils/config.ts";
import { findAlmanacRoot } from "../utils/find-root.ts";
import { printJson } from "../utils/output.ts";

const OWN_ARTIFACTS = new Set([
	"articles.json",
	"graph.json",
	"search-index.json",
]);

function strFlag(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isValidPlan(value: unknown): value is CompilePlan {
	if (!value || typeof value !== "object") return false;
	const articles = (value as { articles?: unknown }).articles;
	return Array.isArray(articles);
}

function normalizePlans(value: CompilePlan): PlannedArticle[] {
	return value.articles
		.filter(
			(a): a is PlannedArticle =>
				!!a &&
				typeof a === "object" &&
				typeof (a as PlannedArticle).body === "string",
		)
		.map(
			(a): PlannedArticle => ({
				slug: String(a.slug ?? "").trim(),
				title: String(a.title ?? "").trim(),
				description:
					typeof a.description === "string" ? a.description.trim() : undefined,
				categories: Array.isArray(a.categories)
					? a.categories.map((c) => String(c)).filter(Boolean)
					: [],
				action: a.action === "update" ? "update" : "create",
				body: a.body,
			}),
		)
		.filter((a) => a.slug && a.title && a.body.trim());
}

export default defineCommand({
	meta: {
		name: "compile",
		description:
			"Compile raw material into the wiki (incremental by default, --full to re-process everything)",
	},
	args: {
		dir: dirArg,
		json: jsonArg,
		out: {
			type: "string",
			description: "Output directory (defaults to config outputDir)",
			alias: "o",
			valueHint: "dir",
		},
		pretty: {
			type: "boolean",
			description: "Pretty-print the JSON artifacts",
			default: false,
		},
		full: {
			type: "boolean",
			description: "Re-process everything (ignore incremental state)",
			default: false,
		},
		"dry-run": {
			type: "boolean",
			description:
				"Show what would happen without calling the LLM or writing files",
			default: false,
		},
		"artifacts-only": {
			type: "boolean",
			description: "Skip the LLM: only rebuild JSON artifacts, index, and lint",
			default: false,
		},
		model: {
			type: "string",
			description: "LLM model override (else config/env ALMANAC_LLM_MODEL)",
			valueHint: "model",
		},
		provider: {
			type: "string",
			description:
				"LLM provider override: openai (default), anthropic, or opencode",
			valueHint: "provider",
		},
		"base-url": {
			type: "string",
			description: "LLM base URL override (OpenAI-compatible or Anthropic)",
			valueHint: "url",
		},
		agent: {
			type: "string",
			description:
				"OpenCode agent override, e.g. a lean no-tools agent (opencode provider only)",
			valueHint: "agent",
		},
		attach: {
			type: "string",
			description:
				"Attach to a warm opencode server (e.g. http://localhost:4096) to skip cold boot per batch",
			valueHint: "url",
		},
		drafts: {
			type: "boolean",
			description:
				"Also scan drafts/ for source material (disable with --no-drafts)",
			default: true,
		},
		outputs: {
			type: "boolean",
			description: "Also scan outputs/ for source material",
			default: false,
		},
		archive: {
			type: "boolean",
			description: "Move processed raw/* files to raw/.processed/",
			default: false,
		},
		"update-index": {
			type: "boolean",
			description:
				"Regenerate wiki/index.md catalog (disable with --no-update-index)",
			default: true,
		},
		"max-chars": {
			type: "string",
			description: "Max chars read per raw file (1000-200000)",
			valueHint: "n",
		},
	},
	async run({ args }) {
		const raw = args as Record<string, unknown>;
		let root: string;
		try {
			root = findAlmanacRoot();
		} catch (err) {
			console.error(err instanceof Error ? err.message : String(err));
			process.exit(1);
		}

		const { config } = await loadAlmanacConfig(root);
		const dir = contentDirFromRoot(
			config,
			typeof raw.dir === "string" ? raw.dir : undefined,
		);
		const outDir = resolve(
			typeof raw.out === "string" && raw.out ? raw.out : config.outputDir,
		);
		const asJson = raw.json === true;
		const pretty = raw.pretty === true;
		const full = raw.full === true;
		const dryRun = raw["dry-run"] === true;
		const artifactsOnly = raw["artifacts-only"] === true;
		const doArchive = raw.archive === true;
		const updateIndex = raw["update-index"] !== false;
		const maxCharsRaw = strFlag(raw["max-chars"]);
		const maxCharsParsed = maxCharsRaw
			? Number.parseInt(maxCharsRaw, 10)
			: Number.NaN;
		const maxCharsPerFile =
			Number.isFinite(maxCharsParsed) &&
			maxCharsParsed >= 1000 &&
			maxCharsParsed <= 200_000
				? maxCharsParsed
				: config.compile.maxCharsPerFile;

		const includeDrafts =
			typeof raw.drafts === "boolean"
				? raw.drafts
				: config.compile.includeDrafts;
		const includeOutputs =
			typeof raw.outputs === "boolean"
				? raw.outputs
				: config.compile.includeOutputs;

		const log = (...parts: unknown[]): void => {
			const msg = parts.map((p) => String(p)).join(" ");
			if (asJson) console.error(msg);
			else console.log(msg);
		};

		const articles = await loadArticles(dir).catch((err: unknown) => {
			console.error(
				`almanac: ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
		});
		const outgoing = buildOutgoingMap(articles);
		const backlinks = buildBacklinkMap(articles);
		const catalog = buildCatalog(articles, outgoing, backlinks);
		const preferences = await loadPreferencesText(dir);

		const scanned = await scanRawInputs({
			rawDir: config.rawDir,
			draftsDir: config.draftsDir,
			outputDir: config.outputDir,
			includeDrafts,
			includeOutputs,
			maxCharsPerFile,
		});
		const inputs: RawFile[] = scanned.filter(
			(f) => !(f.source === "outputs" && OWN_ARTIFACTS.has(f.relPath)),
		);

		const hashes = new Map<string, string>();
		for (const f of inputs) hashes.set(stateKeyFor(f), fingerprintFor(f));
		const state = await loadCompileState(root);
		const selection = full
			? { changed: inputs, unchanged: [] as RawFile[] }
			: selectChangedFiles(inputs, state, hashes);
		const binaries = selection.changed.filter((f) => f.binary);
		const processable = selection.changed.filter((f) => !f.binary);

		const llmConfig = resolveLlmConfig({
			provider: strFlag(raw.provider) ?? config.compile.provider,
			model: strFlag(raw.model) ?? config.compile.model,
			baseUrl: strFlag(raw["base-url"]) ?? config.compile.baseUrl,
			workdir: root,
			agent: strFlag(raw.agent),
			server: strFlag(raw.attach),
		});
		const llmAvailable = canCallLlm(llmConfig);
		const willCallLlm =
			!dryRun && !artifactsOnly && processable.length > 0 && llmAvailable;

		if (dryRun) {
			const plan = {
				root,
				dir,
				outDir,
				full,
				dryRun: true,
				llm: describeLlmConfig(llmConfig),
				preferences: preferences ? `${preferences.length} chars` : "none",
				wiki: {
					articles: articles.length,
					links: buildGraphData(articles).links.length,
				},
				scanned: inputs.length,
				changed: selection.changed.map((f) => `${f.source}:${f.relPath}`),
				unchanged: selection.unchanged.length,
				processable: processable.map((f) => `${f.source}:${f.relPath}`),
				skippedBinaries: binaries.map(
					(f) => `${f.source}:${f.relPath} (${f.skipReason ?? "binary"})`,
				),
				batches: Math.ceil(
					processable.reduce((n, f) => n + Math.max(200, f.text.length), 0) /
						20_000,
				),
				note: willCallLlm
					? undefined
					: processable.length === 0
						? "Nothing to compile — no new/changed text sources."
						: artifactsOnly
							? "LLM step disabled by --artifacts-only."
							: "No LLM key — run with a key, or use --artifacts-only for indexes alone.",
			};
			if (asJson) {
				printJson(plan);
				return;
			}
			log(
				`[dry-run] ${inputs.length} source(s) scanned, ${selection.changed.length} new/changed ` +
					`(${processable.length} text, ${binaries.length} binary), ${selection.unchanged.length} unchanged.`,
			);
			for (const f of processable) log(`  process ${f.source}:${f.relPath}`);
			for (const f of binaries) log(`  skip (binary) ${f.source}:${f.relPath}`);
			if (processable.length > 0 && !llmAvailable && !artifactsOnly) {
				log(
					`LLM: ${describeLlmConfig(llmConfig)} — configure an LLM to compile.`,
				);
			}
			return;
		}

		const writes: WriteResult[] = [];
		const batchNotes: string[] = [];
		let llmUsed = false;
		let llmError: string | null = null;
		const processedOk: RawFile[] = [...binaries];

		if (willCallLlm) {
			const batches = batchRawFiles(processable);
			const system = buildSystemPrompt(preferences);
			log(
				`Compiling ${processable.length} source(s) in ${batches.length} batch(es) via ${describeLlmConfig(llmConfig)}…`,
			);
			let idx = 0;
			for (const batch of batches) {
				idx++;
				const combinedText = batch
					.map((f) => f.text)
					.join("\n")
					.slice(0, 30_000);
				const relevant = findRelevantArticles(combinedText, articles);
				const user = buildBatchPrompt({
					rawFiles: batch,
					catalog,
					relevant,
					batchIndex: idx - 1,
					batchTotal: batches.length,
				});
				try {
					const started = Date.now();
					const rawOut = await callLlm(system, user, llmConfig);
					const elapsed = ((Date.now() - started) / 1000).toFixed(0);
					llmUsed = true;
					const parsed = parseLlmJson<CompilePlan>(rawOut);
					if (!isValidPlan(parsed)) {
						throw new Error("LLM output missing `articles` array");
					}
					const plans = normalizePlans(parsed);
					if (parsed.notes?.trim()) batchNotes.push(parsed.notes.trim());
					if (plans.length === 0) {
						log(
							`  batch ${idx}/${batches.length}: nothing wiki-worthy — skipped`,
						);
						processedOk.push(...batch);
						continue;
					}
					const results = await writePlannedArticles(dir, plans);
					writes.push(...results);
					processedOk.push(...batch);
					const created = results.filter((r) => r.status === "created").length;
					const updated = results.filter((r) => r.status === "updated").length;
					log(
						`  batch ${idx}/${batches.length}: +${created} created, ~${updated} updated (${elapsed}s)`,
					);
					if (
						Number(elapsed) > 90 &&
						llmConfig.provider === "opencode" &&
						!llmConfig.server
					) {
						log(
							"  tip: batches are slow mostly due to opencode cold boot. " +
								"Run `opencode serve` once in another terminal, then add " +
								"`--attach http://localhost:4096` (or set ALMANAC_OPENCODE_SERVER) to reuse it.",
						);
					}
				} catch (err) {
					llmError = err instanceof Error ? err.message : String(err);
					console.error(`  batch ${idx}/${batches.length} failed: ${llmError}`);
					console.error(
						"  (these sources were NOT marked processed — retry on the next run)",
					);
				}
			}
		} else if (processable.length > 0 && !artifactsOnly && !llmAvailable) {
			console.warn(
				`almanac: no LLM configured (${describeLlmConfig(llmConfig)}). ` +
					"Skipping article generation — rebuilding indexes only. " +
					"Set OPENAI_API_KEY / ANTHROPIC_API_KEY, or use --provider opencode to reuse your OpenCode auth " +
					"(or pass --artifacts-only to silence this).",
			);
		}

		let statePath: string | null = null;
		if (!artifactsOnly) {
			if (processedOk.length > 0) {
				markProcessed(state, processedOk, hashes);
			}
			const liveKeys = new Set(inputs.map((f) => stateKeyFor(f)));
			const pruned = pruneState(state, liveKeys);
			if (processedOk.length > 0 || pruned > 0 || full) {
				statePath = await saveCompileState(root, state);
			}
		}

		const archived: string[] = [];
		if (doArchive && processedOk.length > 0) {
			for (const f of processedOk) {
				if (f.source !== "raw" || f.binary) continue;
				const dest = join(config.rawDir, ".processed", f.relPath);
				try {
					await mkdir(dirname(dest), { recursive: true });
					await rename(f.absPath, dest);
					archived.push(`raw:${f.relPath}`);
				} catch (err) {
					console.warn(
						`  archive skipped for raw:${f.relPath}: ${err instanceof Error ? err.message : String(err)}`,
					);
				}
			}
		}

		let indexChanged = false;
		let indexPath = join(dir, "index.md");
		if (updateIndex) {
			const res = await rebuildIndexPage(dir);
			indexChanged = res.changed;
			indexPath = res.path;
		}

		const fresh = await loadArticles(dir).catch(() => articles);
		const graph = buildGraphData(fresh);
		const indexRaw = buildSearchIndexJson(fresh);
		const format = (value: unknown): string =>
			pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);

		await mkdir(outDir, { recursive: true });
		const files: [string, string][] = [
			[
				"articles.json",
				format(
					fresh.map((a) => ({
						slug: a.slug,
						title: a.title,
						description: a.description ?? null,
						path: a.path,
						lastModified: a.lastModified.toISOString(),
					})),
				),
			],
			["graph.json", format(graph)],
			[
				"search-index.json",
				pretty ? JSON.stringify(JSON.parse(indexRaw), null, 2) : indexRaw,
			],
		];
		for (const [name, text] of files) {
			await writeFile(join(outDir, name), `${text}\n`, "utf-8");
		}

		const lint = lintArticles(fresh);
		const created = writes.filter((w) => w.status === "created");
		const updated = writes.filter((w) => w.status === "updated");
		const unchangedWrites = writes.filter((w) => w.status === "unchanged");
		const invalid = writes.filter((w) => w.status === "invalid");

		const summary = {
			root,
			dir,
			outDir,
			full,
			mode: artifactsOnly
				? "artifacts-only"
				: llmUsed
					? "compile"
					: "indexes-only",
			llm: describeLlmConfig({ ...llmConfig, apiKey: "" }),
			scanned: inputs.length,
			changed: selection.changed.length,
			unchanged: selection.unchanged.length,
			processed: processedOk.length,
			created: created.map((w) => w.slug),
			updated: updated.map((w) => w.slug),
			unchangedWrites: unchangedWrites.map((w) => w.slug),
			invalid: invalid.map((w) => `${w.slug}: ${w.detail ?? "invalid"}`),
			skippedBinaries: binaries.map((f) => `${f.source}:${f.relPath}`),
			archived,
			index: updateIndex
				? { path: indexPath, changed: indexChanged }
				: { path: indexPath, changed: false, skipped: true },
			articles: fresh.length,
			links: graph.links.length,
			issues: lint.issues.length,
			issuesList: lint.issues,
			notes: batchNotes,
			llmError,
			statePath,
			files: files.map(([name]) => join(outDir, name)),
		};

		if (asJson) {
			printJson(summary);
			return;
		}

		log(
			`Compiled ${summary.articles} article(s), ${summary.links} link(s) to ${outDir}`,
		);
		if (created.length > 0) {
			log(`Created (${created.length}):`);
			for (const w of created) log(`  + ${w.slug} — ${w.title}`);
		}
		if (updated.length > 0) {
			log(`Updated (${updated.length}):`);
			for (const w of updated) log(`  ~ ${w.slug} — ${w.title}`);
		}
		if (binaries.length > 0) {
			log(`Skipped binaries (${binaries.length}):`);
			for (const f of binaries.slice(0, 10)) {
				log(`  - ${f.source}:${f.relPath} (${f.skipReason ?? "binary"})`);
			}
			if (binaries.length > 10) log(`  …and ${binaries.length - 10} more`);
		}
		if (
			created.length === 0 &&
			updated.length === 0 &&
			processable.length === 0 &&
			!indexChanged
		) {
			log(
				`Nothing to do — ${selection.unchanged.length} source(s) unchanged` +
					(inputs.length === 0
						? " (raw/ is empty — drop files in and re-run)"
						: "") +
					".",
			);
		}
		if (updateIndex) {
			log(
				indexChanged
					? `Index rebuilt: ${indexPath}`
					: `Index unchanged: ${indexPath}`,
			);
		}
		for (const file of summary.files) log(`  ${file}`);
		if (archived.length > 0) {
			log(`Archived (${archived.length}) to raw/.processed/`);
		}
		if (lint.issues.length > 0) {
			const broken = lint.issues.filter((i) => i.kind === "broken-link").length;
			const orphans = lint.issues.filter((i) => i.kind === "orphan").length;
			log(
				`Lint: ${lint.issues.length} issue(s) (${broken} broken links, ${orphans} orphans) — run \`almanac validate\` for details.`,
			);
		} else {
			log("Lint: clean.");
		}
		if (llmError) {
			log(`LLM errors: ${llmError}`);
		}
		if (batchNotes.length > 0) {
			log("Notes:");
			for (const n of batchNotes.slice(0, 3)) log(`  ${n}`);
		}
	},
});
