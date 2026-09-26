import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { slugify } from "@almanac/core/markdown-parser";
import { defineCommand } from "citty";
import { dirArg } from "../utils/args.ts";
import { resolveContentDir } from "../utils/content-dir.ts";

export default defineCommand({
	meta: {
		name: "new",
		description: "Create a new markdown note in the vault",
	},
	args: {
		title: {
			type: "positional",
			description: "Note title",
			required: true,
			valueHint: "title",
		},
		dir: dirArg,
		slug: {
			type: "string",
			description: "Custom slug (defaults to slugified title)",
			valueHint: "slug",
		},
		description: {
			type: "string",
			description: "Frontmatter description",
			valueHint: "text",
		},
		force: {
			type: "boolean",
			description: "Overwrite if the file already exists",
			default: false,
		},
	},
	async run({ args }) {
		const raw = args as Record<string, unknown>;
		const title = String(raw.title ?? "").trim();
		const dir = resolveContentDir(
			typeof raw.dir === "string" ? raw.dir : undefined,
		);
		const slugRaw = typeof raw.slug === "string" ? raw.slug.trim() : "";
		const description =
			typeof raw.description === "string" ? raw.description.trim() : "";
		const force = raw.force === true;

		if (!title) {
			console.error("almanac: title must not be empty");
			process.exit(1);
		}
		const slug = slugify(slugRaw || title);
		if (!slug) {
			console.error("almanac: unable to generate slug for title");
			process.exit(1);
		}

		await mkdir(dir, { recursive: true });
		const filePath = join(dir, `${slug}.md`);

		if (existsSync(filePath) && !force) {
			console.error(
				`almanac: ${filePath} already exists (use --force to overwrite)`,
			);
			process.exit(1);
		}

		const lines = ["---", `title: "${title.replace(/"/g, '\\"')}"`];
		if (description) {
			lines.push(`description: "${description.replace(/"/g, '\\"')}"`);
		}
		lines.push("---", "", `# ${title}`, "");
		await writeFile(filePath, `${lines.join("\n")}\n`, "utf-8");
		console.log(`Created ${filePath}`);
	},
});
