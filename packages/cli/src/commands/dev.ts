import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { defineCommand } from "citty";
import { loadAlmanacConfig } from "../utils/config.ts";
import { findAlmanacRoot } from "../utils/find-root.ts";

function waitFor(proc: ChildProcess, label: string): Promise<number> {
	return new Promise((resolve) => {
		proc.on("error", (err) => {
			console.error(
				`almanac: ${label} failed to start: ${err instanceof Error ? err.message : String(err)}`,
			);
			resolve(1);
		});
		proc.on("close", (code) => resolve(code ?? 0));
	});
}

export default defineCommand({
	meta: {
		name: "dev",
		description: "Start the Next.js frontend + Hono server",
	},
	args: {
		"web-port": {
			type: "string",
			description: "Frontend port (defaults to config webPort, 3001)",
			valueHint: "port",
		},
		"server-port": {
			type: "string",
			description: "API server port (defaults to config serverPort, 3000)",
			valueHint: "port",
		},
		turbo: {
			type: "boolean",
			description: "Run via `turbo run dev` instead of separate processes",
			default: false,
		},
		web: {
			type: "boolean",
			description: "Run the frontend (disable with --no-web)",
			default: true,
		},
		server: {
			type: "boolean",
			description: "Run the API server (disable with --no-server)",
			default: true,
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
		const webPortRaw =
			typeof raw["web-port"] === "string" && raw["web-port"]
				? (raw["web-port"] as string)
				: String(config.webPort);
		const serverPortRaw =
			typeof raw["server-port"] === "string" && raw["server-port"]
				? (raw["server-port"] as string)
				: String(config.serverPort);
		const turbo = raw.turbo === true;
		const runWeb = raw.web !== false;
		const runServer = raw.server !== false;

		const webPort = Number.parseInt(webPortRaw, 10);
		const serverPort = Number.parseInt(serverPortRaw, 10);
		if (!Number.isFinite(webPort) || !Number.isFinite(serverPort)) {
			console.error("almanac: --web-port and --server-port must be numbers");
			process.exit(1);
		}

		// Single-process mode: let turbo orchestrate both apps.
		if (turbo) {
			const proc = spawn("bun", ["run", "dev"], {
				cwd: root,
				stdio: "inherit",
				env: { ...process.env, PORT: String(serverPort) },
			});
			process.exit(await waitFor(proc, "turbo dev"));
		}

		if (!runWeb && !runServer) {
			console.error("almanac: nothing to run (--no-web with --no-server)");
			process.exit(1);
		}

		const webDir = join(root, "apps", "web");
		const serverDir = join(root, "apps", "server");
		if (runWeb && !existsSync(webDir)) {
			console.error(`almanac: frontend not found at ${webDir}`);
			process.exit(1);
		}
		if (runServer && !existsSync(serverDir)) {
			console.error(`almanac: server not found at ${serverDir}`);
			process.exit(1);
		}

		const procs: ChildProcess[] = [];
		if (runWeb) {
			// The repo script pins --port 3001; go through next directly
			// when a custom port was requested.
			const webArgs =
				webPort === 3001
					? ["run", "dev"]
					: ["x", "next", "dev", "--port", String(webPort)];
			console.log(`almanac: starting web on :${webPort}`);
			procs.push(spawn("bun", webArgs, { cwd: webDir, stdio: "inherit" }));
		}
		if (runServer) {
			console.log(`almanac: starting server on :${serverPort}`);
			procs.push(
				spawn("bun", ["run", "--hot", "src/index.ts"], {
					cwd: serverDir,
					stdio: "inherit",
					env: { ...process.env, PORT: String(serverPort) },
				}),
			);
		}

		const forward = (signal: NodeJS.Signals) => {
			for (const proc of procs) {
				try {
					proc.kill(signal);
				} catch {
					// Already exited — nothing to stop.
				}
			}
		};
		process.once("SIGINT", () => forward("SIGINT"));
		process.once("SIGTERM", () => forward("SIGTERM"));

		const codes = await Promise.all(
			procs.map((proc, i) =>
				waitFor(proc, i === 0 && runWeb ? "web" : "server"),
			),
		);
		const failed = codes.find((code) => code !== 0) ?? 0;
		process.exit(failed);
	},
});
