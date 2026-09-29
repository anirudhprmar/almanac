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

export function resolveVaultRef(): { contentDir: string; root?: string } {
	const dir = contentDir();
	const root = findSiteRoot(dir) ?? undefined;
	return { contentDir: dir, root };
}

export function createServerMcp() {
	const vault = resolveVaultRef();
	return createAlmanacMcpServer({
		contentDir: vault.contentDir,
		root: vault.root,
		serverName: MCP_SERVER_NAME,
		serverVersion: MCP_SERVER_VERSION,
	});
}

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

	app.all(MCP_ROUTE_PATH, handler as never);
}

export async function startStdioMcp(): Promise<void> {
	const server = createServerMcp();
	const transport = new StdioServerTransport();
	await server.connect(transport);
	const vault = resolveVaultRef();
	console.error(
		`[almanac-mcp] serving ${vault.contentDir} on stdio (${ALMANAC_MCP_TOOL_NAMES.length} tools: ${ALMANAC_MCP_TOOL_NAMES.join(", ")})`,
	);

	await new Promise<void>(() => {});
}

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
