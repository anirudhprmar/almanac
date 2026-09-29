import { readFile, stat } from "node:fs/promises";
import matter from "gray-matter";

export type Markdown = {
	title: string;
	slug: string;
	description?: string;
	content: string;
	path: string;
	rawContent: string;
	frontmatter: Record<string, unknown>;
	lastModified: Date;
};

export function slugify(input: string): string {
	return input
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
}

export async function parseMarkdown(filePath: string): Promise<Markdown> {
	let rawContent: string;
	try {
		rawContent = await readFile(filePath, "utf-8");
	} catch {
		throw new Error(`Markdown file not found: ${filePath}`);
	}
	const { data, content } = matter(rawContent);

	if (!data.title || typeof data.title !== "string" || !data.title.trim()) {
		throw new Error(`Missing or invalid 'title' in frontmatter: ${filePath}`);
	}

	const title = data.title.trim();

	const rawSlug = typeof data.slug === "string" ? data.slug.trim() : "";
	const slug = rawSlug ? slugify(rawSlug) : slugify(title);

	if (!slug) {
		throw new Error(
			`Unable to generate slug for: ${filePath} (title: "${title}")`,
		);
	}

	let lastModified = new Date();
	try {
		const st = await stat(filePath);
		lastModified = st.mtime;
	} catch {}

	return {
		title,
		slug,
		description:
			typeof data.description === "string"
				? data.description.trim() || undefined
				: undefined,
		content: content.trim(),
		path: filePath,
		rawContent,
		frontmatter: data as Record<string, unknown>,
		lastModified,
	};
}
