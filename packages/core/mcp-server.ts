import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { describeLlmConfig, resolveLlmConfig } from "./compile-llm";
import {
	askVault,
	getArticleDetailBySlug,
	getBacklinksBySlug,
	getNeighborhoodBySlug,
	getVaultPreferences,
	importFileToVault,
	searchVault,
	type VaultRef,
} from "./mcp-tools";

export type AlmanacMcpOptions = VaultRef & {
	serverName?: string;

	serverVersion?: string;
};

const SEARCH_DESC =
	"Full-text search across the Almanac vault (titles, descriptions, content). " +
	"Use first to discover what the vault knows. Returns ranked hits with excerpts.";

const GET_ARTICLE_DESC =
	"Read one vault article by slug or title (aliases accepted). " +
	"Returns frontmatter, full Markdown body, outgoing links, and backlinks. " +
	"Prefer this over guessing file paths.";

const GET_BACKLINKS_DESC =
	"What links here: list every article that links to the given slug. " +
	"Use to gauge importance and find related notes before answering or editing.";

const GET_NEIGHBORHOOD_DESC =
	"Local link-graph around one article (depth 1 = direct links both ways, up to 3 hops). " +
	"Use to explore clusters, find bridge articles, and avoid duplicate notes.";

const GET_PREFERENCES_DESC =
	"Read wiki/preferences.md — the vault's style and organization rules. " +
	"Always read before writing or compiling; follow it over defaults.";

const ASK_DESC =
	"Ask a question grounded ONLY in the vault (retrieval-augmented Q&A). " +
	"Retrieves the most relevant articles, then answers with [[Wikilink]] citations. " +
	"Needs an LLM (OPENAI_API_KEY / ANTHROPIC_API_KEY or opencode provider). " +
	"Falls back to ranked excerpts when no LLM is configured.";

const FILE_TO_ALMANAC_DESC =
	"Stage external text into the vault inbox (raw/ or drafts/) for a later `almanac compile`. " +
	"Never writes wiki/ directly. Pass filename + content (or sourcePath). " +
	"Afterwards run `almanac compile` to fold it into linked articles.";

function textResult(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

function jsonResult(value: unknown) {
	return textResult(JSON.stringify(value, null, 2));
}

export function createAlmanacMcpServer(opts: AlmanacMcpOptions): McpServer {
	const server = new McpServer(
		{
			name: opts.serverName ?? "almanac",
			version: opts.serverVersion ?? "0.0.0",
		},
		{
			capabilities: { tools: {} },
		},
	);
	const vault: VaultRef = { contentDir: opts.contentDir, root: opts.root };

	server.tool(
		"search",
		SEARCH_DESC,
		{
			query: z.string().min(1).max(200).describe("Search query"),
			limit: z
				.number()
				.int()
				.min(1)
				.max(20)
				.default(8)
				.describe("Max hits (1-20)"),
		},
		async ({ query, limit }) => {
			try {
				const { hits, articlesCount } = await searchVault(
					vault.contentDir,
					query,
					limit,
				);
				if (hits.length === 0) {
					return textResult(
						`No results for "${query}" in ${articlesCount} article(s) at ${vault.contentDir}. Try fewer/typo-tolerant terms — search supports prefix + fuzzy matching.`,
					);
				}
				return jsonResult({ query, articlesCount, hits });
			} catch (err) {
				return textResult(
					`search failed: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		},
	);

	server.tool(
		"get_article",
		GET_ARTICLE_DESC,
		{
			slug: z
				.string()
				.min(1)
				.max(200)
				.describe("Article slug, title, or alias"),
		},
		async ({ slug }) => {
			try {
				const detail = await getArticleDetailBySlug(vault.contentDir, slug);
				if (!detail) {
					return textResult(
						`Article not found: "${slug}". Use search to find the right slug/title first.`,
					);
				}
				return jsonResult(detail);
			} catch (err) {
				return textResult(
					`get_article failed: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		},
	);

	server.tool(
		"get_backlinks",
		GET_BACKLINKS_DESC,
		{
			slug: z
				.string()
				.min(1)
				.max(200)
				.describe("Article slug, title, or alias"),
		},
		async ({ slug }) => {
			try {
				const res = await getBacklinksBySlug(vault.contentDir, slug);
				if (!res) {
					return textResult(
						`Article not found: "${slug}". Use search to find the right slug/title first.`,
					);
				}
				return jsonResult(res);
			} catch (err) {
				return textResult(
					`get_backlinks failed: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		},
	);

	server.tool(
		"get_neighborhood",
		GET_NEIGHBORHOOD_DESC,
		{
			slug: z
				.string()
				.min(1)
				.max(200)
				.describe("Center article slug, title, or alias"),
			depth: z
				.number()
				.int()
				.min(1)
				.max(3)
				.default(1)
				.describe("Hops from center (1-3)"),
		},
		async ({ slug, depth }) => {
			try {
				const graph = await getNeighborhoodBySlug(
					vault.contentDir,
					slug,
					depth,
				);
				if (!graph) {
					return textResult(
						`Article not found: "${slug}". Use search to find the right slug/title first.`,
					);
				}
				return jsonResult(graph);
			} catch (err) {
				return textResult(
					`get_neighborhood failed: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		},
	);

	server.tool("get_preferences", GET_PREFERENCES_DESC, {}, async () => {
		try {
			const prefs = await getVaultPreferences(vault.contentDir);
			if (!prefs.present) {
				return textResult(
					"No preferences file found (looked for wiki/preferences.md). Use clean defaults: short [[Wikilinks]], one-line descriptions, sensible categories.",
				);
			}
			return jsonResult(prefs);
		} catch (err) {
			return textResult(
				`get_preferences failed: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	});

	server.tool(
		"ask_almanac",
		ASK_DESC,
		{
			question: z
				.string()
				.min(1)
				.max(1000)
				.describe("Natural-language question about the vault"),
			limit: z
				.number()
				.int()
				.min(1)
				.max(10)
				.default(5)
				.describe("Context articles to retrieve (1-10)"),
		},
		async ({ question, limit }) => {
			try {
				const result = await askVault(vault, question, { limit });
				return jsonResult(result);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);

				if (/no llm api key|opencode cli not found/i.test(msg)) {
					try {
						const { hits, articlesCount } = await searchVault(
							vault.contentDir,
							question,
							limit,
						);
						const llmHint = (() => {
							try {
								return describeLlmConfig(
									resolveLlmConfig({ workdir: vault.root }),
								);
							} catch {
								return "no LLM configured";
							}
						})();
						return jsonResult({
							answer: null,
							fallback: "retrieval-only (no LLM configured)",
							llm: llmHint,
							hint: "Set OPENAI_API_KEY / ANTHROPIC_API_KEY, or use --provider opencode, then retry ask_almanac. Ranked excerpts below.",
							articlesCount,
							hits,
						});
					} catch {}
				}
				return textResult(`ask_almanac failed: ${msg}`);
			}
		},
	);

	server.tool(
		"file_to_almanac",
		FILE_TO_ALMANAC_DESC,
		{
			filename: z
				.string()
				.min(1)
				.max(120)
				.describe('Target filename, e.g. "meeting-notes.md"'),
			content: z
				.string()
				.max(200_000)
				.optional()
				.describe("Text/markdown to store (or use sourcePath)"),
			sourcePath: z
				.string()
				.max(500)
				.optional()
				.describe("Absolute path of an existing file to import"),
			subdir: z
				.enum(["raw", "drafts"])
				.default("raw")
				.describe("Inbox folder: raw (compile input) or drafts"),
			overwrite: z
				.boolean()
				.default(false)
				.describe("Overwrite when the destination exists"),
		},
		async ({ filename, content, sourcePath, subdir, overwrite }) => {
			try {
				if (!content && !sourcePath) {
					return textResult("Provide either `content` or `sourcePath`.");
				}
				const res = await importFileToVault(vault, {
					filename,
					content: content ?? undefined,
					sourcePath: sourcePath ?? undefined,
					subdir,
					overwrite,
				});
				return jsonResult(res);
			} catch (err) {
				return textResult(
					`file_to_almanac failed: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		},
	);

	return server;
}

export const ALMANAC_MCP_TOOL_NAMES = [
	"search",
	"get_article",
	"get_backlinks",
	"get_neighborhood",
	"get_preferences",
	"ask_almanac",
	"file_to_almanac",
] as const;
