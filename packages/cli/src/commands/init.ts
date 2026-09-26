import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { defineCommand } from "citty";
import { tryFindAlmanacRoot } from "../utils/find-root.ts";

const DIRS = ["wiki", "raw", "drafts", "outputs", "config"] as const;

function tsConfig(name: string): string {
	const safe = name.replace(/"/g, '\\"');
	return `// Almanac project config - loaded by \`almanac dev\` / \`almanac compile\`.
export default {
	name: "${safe}",
	contentDir: "wiki",
	rawDir: "raw",
	draftsDir: "drafts",
	outputDir: "outputs",
	webPort: 3001,
	serverPort: 3000,
};
`;
}

function jsonConfig(name: string): string {
	return `${JSON.stringify(
		{
			name,
			contentDir: "wiki",
			rawDir: "raw",
			draftsDir: "drafts",
			outputDir: "outputs",
			webPort: 3001,
			serverPort: 3000,
		},
		null,
		2,
	)}\n`;
}

function indexPage(name: string): string {
	return `---
title: Welcome
---

# Welcome to ${name}

This is your Almanac vault. Start here:

- Adjust your [[preferences]]
- Create notes with \`almanac new "My note"\`
- Run \`almanac dev\` to browse the wiki in your browser
`;
}

const PREFERENCES_PAGE = `---
title: Preferences
---

# Preferences

Project-wide defaults for this vault.

- Theme: system
- Excerpts: on
`;
export default defineCommand({
	meta: {
		name: "init",
		description: "Bootstrap a new Almanac vault in the current directory",
	},
	args: {
		dir: {
			type: "positional",
			description: "Target directory (defaults to the current directory)",
			required: false,
			valueHint: "dir",
		},
		name: {
			type: "string",
			description: 'Vault name stored in the config (e.g. --name "Username")',
			valueHint: "name",
		},
		force: {
			type: "boolean",
			description: "Re-scaffold even if the folder is already an Almanac",
			default: false,
		},
		empty: {
			type: "boolean",
			description: "Skip starter pages (wiki/index.md, wiki/preferences.md)",
			default: false,
		},
		json: {
			type: "boolean",
			description: "Write config/almanac.config.json instead of .ts",
			alias: "j",
			default: false,
		},
	},
	async run({ args }) {
		const raw = args as Record<string, unknown>;
		const target = resolve(
			typeof raw.dir === "string" && raw.dir ? raw.dir : process.cwd(),
		);
		const name =
			(typeof raw.name === "string" && raw.name.trim()) || basename(target);
		const force = raw.force === true;
		const empty = raw.empty === true;
		const asJson = raw.json === true;

		// Refuse when the target already is (or sits inside) an Almanac.
		const existing = tryFindAlmanacRoot(target);
		if (existing && !force) {
			console.error(
				`almanac: ${target} is already an Almanac (root: ${existing}). Use --force to re-scaffold.`,
			);
			process.exit(1);
		}

		for (const dir of DIRS) {
			await mkdir(join(target, dir), { recursive: true });
		}

		const configPath = join(
			target,
			"config",
			asJson ? "almanac.config.json" : "almanac.config.ts",
		);
		if (existsSync(configPath) && !force) {
			console.error(
				`almanac: ${configPath} already exists. Use --force to overwrite.`,
			);
			process.exit(1);
		}
		await writeFile(configPath, asJson ? jsonConfig(name) : tsConfig(name));

		const created: string[] = [
			...DIRS.map((d) => `${d}/`),
			"config/almanac.config.ts",
		];
		if (asJson) created[created.length - 1] = "config/almanac.config.json";

		if (!empty) {
			const starters: [string, string][] = [
				["wiki/index.md", indexPage(name)],
				["wiki/preferences.md", PREFERENCES_PAGE],
			];
			for (const [rel, content] of starters) {
				const path = join(target, rel);
				if (existsSync(path) && !force) continue;
				await writeFile(path, content, "utf-8");
				created.push(rel);
			}
		}

		console.log(`✓ Initialized "${name}" in ${target}\n`);
		console.log("Created:");
		for (const rel of created) console.log(`  ${rel}`);
		console.log("\nNext steps:");
		console.log("  almanac dev             Start the frontend + server");
		console.log('  almanac new "My note"   Create a note in wiki/');
		console.log("  almanac list            List vault articles");
	},
});
