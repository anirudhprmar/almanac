/**
 * Almanac MCP server — lets Claude / Cursor / any MCP agent live inside the vault.
 *
 * Transports:
 * - stdio (default): `bun run src/mcp.ts` or `almanac mcp`
 *   (configure in Claude Code / Cursor / opencode as a stdio MCP server).
 * - Streamable HTTP: mounted at POST/GET /mcp by apps/server (stateless,
 *   works with web MCP clients).
 *
 * Tools (7):
 * - search            full-text ranked search with excerpts
 * - get_article       one article + outgoing links + backlinks
 * - get_backlinks     "what links here"
 * - get_neighborhood  local link-graph around one article (depth 1-3)
 * - get_preferences   vault style/organization rules (preferences.md)
 * - ask_almanac       RAG Q&A grounded in the vault, [[Wikilink]] citations
 * - file_to_almanac   stage external text into raw//drafts/ for `almanac compile`
 */

import {
	ALMANAC_MCP_TOOL_NAMES,
	createAlmanacMcpServer,
} from "@almanac/core/mcp-server";
import { findSiteRoot } from "@almanac/core/site-config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Hono } from "hono";
import { contentDir } from "./content";

export const MCP_SERVER_NAME = "almanac";
export const MCP_SERVER_VERSION = "0.0.0";
export const MCP_ROUTE_PATH = "/mcp";

export { ALMANAC_MCP_TOOL_NAMES };

/** Resolve the vault { contentDir, root } for this process. */
export function resolveVaultRef(): { contentDir: string; root?: string } {
	const dir = contentDir();
	const root = findSiteRoot(dir) ?? undefined;
	return { contentDir: dir, root };
}

/** Build a fresh MCP server bound to this process's vault. */
export function createServerMcp() {
	const vault = resolveVaultRef();
	return createAlmanacMcpServer({
		contentDir: vault.contentDir,
		root: vault.root,
		serverName: MCP_SERVER_NAME,
		serverVersion: MCP_SERVER_VERSION,
	});
}

// --- Streamable HTTP (Hono) -----------------------------------------------
// Stateless singleton: one server + one transport reused across requests.
// Stateless mode = no session IDs, no server-side session store — every
// request carries full JSON-RPC, which is what `almanac` needs (vault reads
// are cheap + cached) and what most web MCP clients expect.

type HttpMcp = {
	server: ReturnType<typeof createServerMcp>;
	transport: WebStandardStreamableHTTPServerTransport;
	connected: Promise<void>;
};

let httpMcp: HttpMcp | null = null;

function ensureHttpMcp(): Promise<WebStandardStreamableHTTPServerTransport> {
	if (httpMcp) {
		const { connected, transport } = httpMcp;
		return connected.then(() => transport);
	}
	const server = createServerMcp();
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
	});
	const connected = server.connect(transport).catch((err) => {
		httpMcp = null;
		throw err;
	});
	httpMcp = { server, transport, connected };
	return connected.then(() => transport);
}

/**
 * Mount the MCP Streamable HTTP endpoint on a Hono app.
 * Handles GET/POST/DELETE /mcp (DELETE for client session close — no-op in stateless mode).
 */
export function registerMcpRoutes(app: Hono): void {
	const handler = async (c: { req: { raw: Request } }) => {
		try {
			const transport = await ensureHttpMcp();
			return await transport.handleRequest(c.req.raw);
		} catch (err) {
			return Response.json(
				{ error: err instanceof Error ? err.message : String(err) },
				{ status: 500 },
			);
		}
	};
	// Hono's `app.all` covers every method; register explicitly for clarity.
	app.all(MCP_ROUTE_PATH, handler as never);
}

// --- stdio entry ------------------------------------------------------------

/** Start the MCP server on stdio (Claude Code / Cursor / opencode). Never returns. */
export async function startStdioMcp(): Promise<void> {
	const server = createServerMcp();
	const transport = new StdioServerTransport();
	await server.connect(transport);
	const vault = resolveVaultRef();
	console.error(
		`[almanac-mcp] serving ${vault.contentDir} on stdio (${ALMANAC_MCP_TOOL_NAMES.length} tools: ${ALMANAC_MCP_TOOL_NAMES.join(", ")})`,
	);
	// Keep the process alive until the client closes stdin.
	await new Promise<void>(() => {});
}

// Run stdio when executed directly: `bun run src/mcp.ts`
const isMain =
	typeof import.meta !== "undefined" &&
	(import.meta as { main?: boolean }).main === true;
if (isMain) {
	startStdioMcp().catch((err) => {
		console.error(
			"[almanac-mcp] fatal:",
			err instanceof Error ? err.message : String(err),
		);
		process.exit(1);
	});
}
