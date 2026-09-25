import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getCachedData } from "./cache/index";
import { type Markdown, parseMarkdown } from "./markdown-parser";

export type Article = Markdown;

async function collectMarkdownFiles(dir: string): Promise<string[]> {
	const out: string[] = [];
	async function walk(current: string): Promise<void> {
		const entries = await readdir(current, { withFileTypes: true });
		for (const entry of entries) {
			// Skip hidden dirs (e.g. .obsidian), node_modules, and dotfiles
			if (entry.name.startsWith(".")) continue;
			if (entry.name === "node_modules") continue;
			const full = join(current, entry.name);
			if (entry.isDirectory()) {
				await walk(full);
			} else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
				out.push(full);
			}
		}
	}
	try {
		await walk(dir);
	} catch (err) {
		throw new Error(
			`Content directory not readable: ${dir} (${err instanceof Error ? err.message : String(err)})`,
		);
	}
	return out;
}

function reviveDates(articles: Article[]): Article[] {
	for (const a of articles) {
		if (!(a.lastModified instanceof Date)) {
			a.lastModified = new Date(a.lastModified);
		}
	}
	return articles;
}

export async function loadArticles(dirPath: string): Promise<Article[]> {
	const dir = resolve(dirPath);
	const files = await collectMarkdownFiles(dir);
	const articles: Article[] = [];

	for (const fullPath of files) {
		try {
			const parsed = await parseMarkdown(fullPath);
			articles.push(parsed);
		} catch (err) {
			console.warn(
				`Skipping ${fullPath}:`,
				err instanceof Error ? err.message : String(err),
			);
		}
	}

	articles.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

	return articles;
}

export async function getArticles(dirPath: string): Promise<Article[]> {
	const normalized = resolve(dirPath);
	const cacheKey = `articles:${normalized}`;
	const cached = await getCachedData(
		cacheKey,
		() => loadArticles(normalized),
		600,
	);
	return reviveDates(cached);
}

export async function getArticleBySlug(
	dirPath: string,
	slug: string,
): Promise<Article | null> {
	const articles = await getArticles(dirPath);
	return articles.find((a) => a.slug === slug) ?? null;
}
