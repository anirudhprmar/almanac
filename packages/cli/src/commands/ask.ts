import { askAlmanac } from "@almanac/core/ask";
import { searchVault } from "@almanac/core/mcp-tools";
import { defineCommand } from "citty";
import { dirArg, jsonArg } from "../utils/args.ts";
import { resolveContentDir } from "../utils/content-dir.ts";
import { tryFindAlmanacRoot } from "../utils/find-root.ts";
import { printJson } from "../utils/output.ts";

function strFlag(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export default defineCommand({
	meta: {
		name: "ask",
		description:
			"Ask a question grounded in the vault (RAG: retrieval + LLM answer with [[Wikilink]] citations)",
	},
	args: {
		question: {
			type: "positional",
			description: "Natural-language question about the vault",
			required: true,
			valueHint: "question",
		},
		dir: dirArg,
		json: jsonArg,
		limit: {
			type: "string",
			description: "Context articles to retrieve (1-10)",
			default: "5",
			valueHint: "n",
		},
		model: {
			type: "string",
			description: "LLM model override (else ALMANAC_LLM_MODEL)",
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
	},
	async run({ args }) {
		const raw = args as Record<string, unknown>;
		const question = String(raw.question ?? "").trim();
		if (!question) {
			console.error("almanac: question must not be empty.");
			process.exit(1);
		}
		const dir = resolveContentDir(
			typeof raw.dir === "string" ? raw.dir : undefined,
		);
		const asJson = raw.json === true;
		const limit = Math.min(
			Math.max(Number.parseInt(String(raw.limit ?? "5"), 10) || 5, 1),
			10,
		);
		const root = tryFindAlmanacRoot() ?? process.cwd();

		const log = (...parts: unknown[]): void => {
			const msg = parts.map((p) => String(p)).join(" ");
			if (asJson) console.error(msg);
			else console.log(msg);
		};

		let result: Awaited<ReturnType<typeof askAlmanac>>;
		try {
			result = await askAlmanac(question, {
				dir,
				limit,
				llm: {
					provider: strFlag(raw.provider),
					model: strFlag(raw.model),
					baseUrl: strFlag(raw["base-url"]),
					workdir: root,
				},
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);

			if (/no llm api key|opencode cli not found/i.test(msg)) {
				log(
					`No LLM configured — showing ranked vault excerpts instead.\n(${msg})\n`,
				);
				try {
					const { hits, articlesCount } = await searchVault(
						dir,
						question,
						limit,
					);
					if (asJson) {
						printJson({
							question,
							answer: null,
							fallback: "retrieval-only (no LLM configured)",
							hint: "Set OPENAI_API_KEY / ANTHROPIC_API_KEY, or use --provider opencode, then retry.",
							articlesCount,
							hits,
						});
						return;
					}
					if (hits.length === 0) {
						log(`No results for "${question}" in ${articlesCount} article(s).`);
						log(
							"Hint: set OPENAI_API_KEY / ANTHROPIC_API_KEY (or --provider opencode) for full answers.",
						);
						return;
					}
					log(
						`Top ${hits.length} of ${articlesCount} article(s) for "${question}":\n`,
					);
					for (const h of hits) {
						log(`## ${h.title} (${h.slug}) — score ${h.score.toFixed(3)}`);
						if (h.excerpt) log(`  ${h.excerpt}`);
						log("");
					}
					log(
						"Hint: set OPENAI_API_KEY / ANTHROPIC_API_KEY (or --provider opencode) for a synthesized answer.",
					);
					return;
				} catch {}
			}
			console.error(`almanac: ask failed: ${msg}`);
			process.exit(1);
		}

		if (asJson) {
			printJson({
				...result,
				dir,
				hits: result.sources,
			});
			return;
		}

		console.log(result.answer);
		console.log("");
		if (result.sources.length > 0) {
			console.log(`Sources (${result.sources.length}, via ${result.model}):`);
			for (const s of result.sources) {
				const desc = s.description ? ` — ${s.description}` : "";
				console.log(`- [[${s.title}]] (${s.slug})${desc}`);
				if (s.excerpt) console.log(`  ${s.excerpt}`);
			}
		} else {
			console.log(`(no vault sources — via ${result.model})`);
		}
	},
});
