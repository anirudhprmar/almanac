import { file as bunFile } from "bun";
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

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export async function parseMarkdown(filePath: string): Promise<Markdown> {
  const f = bunFile(filePath);

  if (!(await f.exists())) {
    throw new Error(`Markdown file not found: ${filePath}`);
  }

  const rawContent = await f.text();
  const { data, content } = matter(rawContent);

  if (!data.title || typeof data.title !== "string" || !data.title.trim()) {
    throw new Error(`Missing or invalid 'title' in frontmatter: ${filePath}`);
  }

  const title = data.title.trim();

  const rawSlug = typeof data.slug === "string" ? data.slug.trim() : "";
  const slug = rawSlug ? slugify(rawSlug) : slugify(title);

  if (!slug) {
    throw new Error(`Unable to generate slug for: ${filePath} (title: "${title}")`);
  }

  return {
    title,
    slug,
    description: typeof data.description === "string" ? data.description.trim() || undefined : undefined,
    content: content.trim(),
    path: filePath,
    rawContent,
    frontmatter: data as Record<string, unknown>,
    lastModified: new Date(f.lastModified),
  };
}
