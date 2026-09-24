import { join, resolve } from "node:path";
import { Glob } from "bun";
import { parseMarkdown, type Markdown } from "./markdown-parser";
import { getCachedData } from "./cache/index";

export type Article = Markdown;

const mdGlob = new Glob("**/*.md");

export async function loadArticles(dirPath: string): Promise<Article[]> {
  const dir = resolve(dirPath);
  const articles: Article[] = [];

  for await (const relativePath of mdGlob.scan(dir)) {
    const fullPath = join(dir, relativePath);
    try {
      const parsed = await parseMarkdown(fullPath);
      articles.push(parsed);
    } catch (err) {
      console.warn(`Skipping ${fullPath}:`, err instanceof Error ? err.message : String(err));
    }
  }

  articles.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

  return articles;
}

export async function getArticles(dirPath: string): Promise<Article[]> {
  const normalized = resolve(dirPath);
  const cacheKey = `articles:${normalized}`;
  return getCachedData(cacheKey, () => loadArticles(normalized), 600);
}

export async function getArticleBySlug(dirPath: string, slug: string): Promise<Article | null> {
  const articles = await getArticles(dirPath);
  return articles.find((a) => a.slug === slug) ?? null;
}
