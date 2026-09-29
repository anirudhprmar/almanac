import { createAlmanacMcpServer } from "@almanac/core/mcp-server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { defineCommand } from "citty";
import { resolveContentDir } from "../utils/content-dir.ts";
import { tryFindAlmanacRoot } from "../utils/find-root.ts";

export default defineCommand({
	meta: {
		name: "mcp",
		description:
			"Serve the vault over MCP stdio (Claude Code / Cursor / opencode / any MCP agent)",
	},
	args: {
		dir: {
			type: "string",
			description:
				"Vault content directory (defaults to CONTENT_DIR env or ./wiki)",
			alias: "d",
			valueHint: "dir",
		},
		info: {
			type: "boolean",
			description: "Print MCP client config instead of starting the server",
			default: false,
		},
	},
	async run({ args }) {
		const raw = args as Record<string, unknown>;
		const dir = resolveContentDir(
			typeof raw.dir === "string" ? raw.dir : undefined,
		);
		const root = tryFindAlmanacRoot() ?? process.cwd();

		if (raw.info === true) {
			const entry = "almanac mcp";
			console.log("Almanac MCP — stdio server\n");
			console.log(`Vault: ${dir}`);
			console.log(
				"Tools: search, get_article, get_backlinks, get_neighborhood, get_preferences, ask_almanac, file_to_almanac\n",
			);
			console.log("Claude Code (`claude mcp add`):");
			console.log(`  claude mcp add almanac -- ${entry} --dir "${dir}"`);
			console.log("\nCursor / generic MCP JSON (mcp.json):");
			console.log(
				JSON.stringify(
					{
						mcpServers: {
							almanac: {
								command: "almanac",
								args: ["mcp", "--dir", dir],
								env: {},
							},
						},
					},
					null,
					2,
				),
			);
			console.log("\nHTTP (when `almanac dev` / server is running):");
			console.log(
				"  POST/GET http://localhost:3000/mcp  (Streamable HTTP, stateless)",
			);
			console.log("  GET  http://localhost:3000/mcp/info (tool list)");
			return;
		}

		const server = createAlmanacMcpServer({
			contentDir: dir,
			root,
			serverName: "almanac",
			serverVersion: "0.0.0",
		});
		const transport = new StdioServerTransport();
		await server.connect(transport);
		console.error(
			`[almanac-mcp] serving ${dir} on stdio (7 tools). Configure clients with \`almanac mcp --dir "${dir}"\`.`,
		);
		// Stay alive until the MCP client closes stdin.
		await new Promise<never>(() => {});
	},
});
