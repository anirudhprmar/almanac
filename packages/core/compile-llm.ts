import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type LlmProvider = "openai" | "anthropic" | "opencode";

export type LlmConfig = {
	provider: LlmProvider;
	model: string;
	baseUrl: string;
	apiKey: string;

	workdir: string;
};

export type LlmOverrides = {
	provider?: string;
	model?: string;
	baseUrl?: string;
	apiKey?: string;
	workdir?: string;
};

const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
const OPENAI_DEFAULT_BASE = "https://api.openai.com/v1";
const ANTHROPIC_DEFAULT_MODEL = "claude-3-5-haiku-latest";
const ANTHROPIC_DEFAULT_BASE = "https://api.anthropic.com/v1";

function clean(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function normalizeProvider(value: string): LlmProvider | null {
	const v = value.trim().toLowerCase();
	if (
		v === "openai" ||
		v === "openai-compatible" ||
		v === "openrouter" ||
		v === "ollama"
	) {
		return "openai";
	}
	if (v === "anthropic" || v === "claude") return "anthropic";
	if (v === "opencode") return "opencode";
	return null;
}

export function resolveLlmConfig(overrides: LlmOverrides = {}): LlmConfig {
	const envProvider =
		clean(process.env.ALMANAC_LLM_PROVIDER) || clean(process.env.LLM_PROVIDER);
	const provider =
		(overrides.provider ? normalizeProvider(overrides.provider) : null) ??
		(normalizeProvider(envProvider) || null);

	const openaiKey =
		clean(overrides.apiKey) ||
		clean(process.env.ALMANAC_LLM_API_KEY) ||
		clean(process.env.OPENAI_API_KEY);
	const anthropicKey = clean(process.env.ANTHROPIC_API_KEY);

	let resolved: LlmProvider = provider ?? "openai";
	if (!provider) {
		if (!openaiKey && anthropicKey) resolved = "anthropic";
	}

	const model =
		clean(overrides.model) ||
		clean(process.env.ALMANAC_LLM_MODEL) ||
		clean(process.env.OPENAI_MODEL) ||
		(resolved === "anthropic"
			? ANTHROPIC_DEFAULT_MODEL
			: resolved === "opencode"
				? ""
				: OPENAI_DEFAULT_MODEL);

	const baseUrl =
		clean(overrides.baseUrl) ||
		clean(process.env.ALMANAC_LLM_BASE_URL) ||
		clean(process.env.OPENAI_BASE_URL) ||
		(resolved === "anthropic" ? ANTHROPIC_DEFAULT_BASE : OPENAI_DEFAULT_BASE);

	const apiKey =
		resolved === "anthropic" ? anthropicKey || openaiKey : openaiKey;

	const workdir = overrides.workdir?.trim() || process.cwd();

	return { provider: resolved, model, baseUrl, apiKey, workdir };
}

export function hasLlmKey(config: LlmConfig): boolean {
	return config.apiKey.length > 0;
}

export function canCallLlm(config: LlmConfig): boolean {
	return config.provider === "opencode" || hasLlmKey(config);
}

export function describeLlmConfig(config: LlmConfig): string {
	if (config.provider === "opencode") {
		return `opencode/${config.model || "default-model"} (CLI in ${config.workdir})`;
	}
	const keyState = hasLlmKey(config) ? "key set" : "NO KEY";
	return `${config.provider}/${config.model} (${config.baseUrl}, ${keyState})`;
}

async function fetchWithTimeout(
	url: string,
	init: RequestInit,
	timeoutMs = 120_000,
): Promise<Response> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		return await fetch(url, { ...init, signal: ctrl.signal });
	} finally {
		clearTimeout(timer);
	}
}

async function callOpenAI(
	system: string,
	user: string,
	config: LlmConfig,
): Promise<string> {
	const url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
	const res = await fetchWithTimeout(url, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${config.apiKey}`,
		},
		body: JSON.stringify({
			model: config.model,
			temperature: 0.2,
			response_format: { type: "json_object" },
			messages: [
				{ role: "system", content: system },
				{ role: "user", content: user },
			],
		}),
	});
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(
			`LLM request failed (${res.status} ${res.statusText}) at ${url}: ${body.slice(0, 500)}`,
		);
	}
	const data = (await res.json()) as {
		choices?: { message?: { content?: string } }[];
	};
	const content = data.choices?.[0]?.message?.content;
	if (!content || typeof content !== "string") {
		throw new Error("LLM returned an empty completion (OpenAI-compatible)");
	}
	return content;
}

async function callAnthropic(
	system: string,
	user: string,
	config: LlmConfig,
): Promise<string> {
	const url = `${config.baseUrl.replace(/\/$/, "")}/messages`;
	const res = await fetchWithTimeout(url, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-api-key": config.apiKey,
			"anthropic-version": "2023-06-01",
		},
		body: JSON.stringify({
			model: config.model,
			max_tokens: 4096,
			temperature: 0.2,
			system,
			messages: [{ role: "user", content: user }],
		}),
	});
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(
			`LLM request failed (${res.status} ${res.statusText}) at ${url}: ${body.slice(0, 500)}`,
		);
	}
	const data = (await res.json()) as {
		content?: { type?: string; text?: string }[];
	};
	const text = data.content
		?.filter((b) => b.type === "text" && b.text)
		.map((b) => b.text as string)
		.join("\n");
	if (!text) throw new Error("LLM returned an empty completion (Anthropic)");
	return text;
}

function opencodeTimeoutMs(): number {
	const raw = Number.parseInt(clean(process.env.ALMANAC_LLM_TIMEOUT_MS), 10);
	if (Number.isFinite(raw) && raw >= 5_000 && raw <= 3_600_000) return raw;

	return 600_000;
}

function callOpencode(
	system: string,
	user: string,
	config: LlmConfig,
): Promise<string> {
	const briefPath = join(
		tmpdir(),
		`almanac-compile-${randomBytes(8).toString("hex")}.md`,
	);
	const brief = [
		"# Compile brief (read fully and follow exactly)",
		"",
		system,
		"",
		"---",
		"",
		user,
		"",
	].join("\n");
	const message =
		"Read the attached compile brief and follow it exactly. " +
		"Your entire reply must be the STRICT JSON it specifies.";
	const args = ["run"];
	if (config.model) args.push("--model", config.model);
	args.push("--file", briefPath, message);
	return (async () => {
		await writeFile(briefPath, brief, "utf-8");
		try {
			return await runOpencode(args, config);
		} finally {
			await unlink(briefPath).catch(() => {});
		}
	})();
}

function runOpencode(args: string[], config: LlmConfig): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(
			"opencode",
			args,
			{
				cwd: config.workdir,
				timeout: opencodeTimeoutMs(),
				maxBuffer: 10 * 1024 * 1024,
				windowsHide: true,
			},
			(err, stdout, stderr) => {
				if (err) {
					if ((err as NodeJS.ErrnoException).code === "ENOENT") {
						reject(
							new Error(
								"opencode CLI not found on PATH — install it from https://opencode.ai (npm i -g opencode-ai).",
							),
						);
						return;
					}
					const tail = String(stderr || err.message)
						.trim()
						.slice(-800);
					reject(new Error(`opencode run failed: ${tail || err.message}`));
					return;
				}
				const text = String(stdout ?? "").trim();
				if (!text) {
					reject(new Error("opencode run returned empty output"));
					return;
				}
				resolve(text);
			},
		);
	});
}

export async function callLlm(
	system: string,
	user: string,
	config: LlmConfig,
): Promise<string> {
	if (config.provider === "opencode") return callOpencode(system, user, config);
	if (!hasLlmKey(config)) {
		throw new Error(
			`No LLM API key found (provider=${config.provider}). ` +
				"Set OPENAI_API_KEY (or ALMANAC_LLM_API_KEY) for OpenAI-compatible endpoints, " +
				"ANTHROPIC_API_KEY for Anthropic, or use --provider opencode to reuse your OpenCode auth. " +
				"See --artifacts-only / --dry-run for keyless runs.",
		);
	}
	if (config.provider === "anthropic")
		return callAnthropic(system, user, config);
	return callOpenAI(system, user, config);
}

export function parseLlmJson<T = unknown>(text: string): T {
	const trimmed = text.trim();
	const fence = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(trimmed);
	const candidate = fence?.[1]?.trim() ?? trimmed;
	try {
		return JSON.parse(candidate) as T;
	} catch {
		const startObj = candidate.indexOf("{");
		const startArr = candidate.indexOf("[");
		const starts = [startObj, startArr]
			.filter((i) => i >= 0)
			.sort((a, b) => a - b);
		for (const start of starts) {
			const open = candidate[start];
			const close = open === "{" ? "}" : "]";
			const end = candidate.lastIndexOf(close);
			if (end > start) {
				try {
					return JSON.parse(candidate.slice(start, end + 1)) as T;
				} catch {}
			}
		}
		throw new Error(
			`LLM output was not valid JSON (first 300 chars): ${candidate.slice(0, 300)}`,
		);
	}
}
