import type { Article } from "./article-loader";
import type { RawFile } from "./raw-scan";

export type WikiCatalogEntry = {
	slug: string;
	title: string;
	description?: string;
	categories: string[];
	outgoingCount: number;
	backlinkCount: number;
};

export type RelevantArticle = {
	slug: string;
	title: string;
	content: string;
};

export type PlannedArticle = {
	/** kebab-case filename without .md */
	slug: string;
	title: string;
	description?: string;
	categories?: string[];
	/** create = new file, update = merge into existing file */
	action: "create" | "update";
	/** Markdown body WITHOUT frontmatter. May contain [[wikilinks]]. */
	body: string;
};

export type CompilePlan = {
	articles: PlannedArticle[];
	notes?: string;
};

function categoriesOf(a: Article): string[] {
	const c = a.frontmatter?.categories;
	if (Array.isArray(c)) return c.map((x) => String(x)).filter(Boolean);
	if (typeof c === "string" && c.trim()) return [c.trim()];
	return [];
}

export function buildCatalog(
	articles: Article[],
	outgoing: Map<string, string[]>,
	backlinks: Map<string, Article[]>,
): WikiCatalogEntry[] {
	return articles.map((a) => ({
		slug: a.slug,
		title: a.title,
		description: a.description,
		categories: categoriesOf(a),
		outgoingCount: outgoing.get(a.slug)?.length ?? 0,
		backlinkCount: backlinks.get(a.slug)?.length ?? 0,
	}));
}

function tokenize(text: string): Set<string> {
	return new Set(
		text
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, " ")
			.split(/[\s-]+/)
			.map((t) => t.trim())
			.filter((t) => t.length > 2),
	);
}

/**
 * Cheap keyword-overlap retrieval: rank existing articles by shared
 * vocabulary with the raw text. Keeps the LLM context small and relevant.
 */
export function findRelevantArticles(
	rawText: string,
	articles: Article[],
	limit = 4,
	maxCharsPerArticle = 4000,
): RelevantArticle[] {
	if (articles.length === 0 || !rawText.trim()) return [];
	const tokens = tokenize(rawText);
	if (tokens.size === 0) return [];
	const scored = articles.map((a) => {
		const hay = tokenize(
			`${a.title} ${a.description ?? ""} ${a.content.slice(0, 6000)}`,
		);
		let overlap = 0;
		for (const t of tokens) if (hay.has(t)) overlap++;
		// Boost title-word hits so obviously-related pages rank first.
		const titleTokens = tokenize(a.title);
		let titleHits = 0;
		for (const t of titleTokens) if (tokens.has(t)) titleHits++;
		return { article: a, score: overlap + titleHits * 3 };
	});
	return scored
		.filter((s) => s.score > 0)
		.sort((x, y) => y.score - x.score)
		.slice(0, Math.max(1, limit))
		.map(({ article }) => ({
			slug: article.slug,
			title: article.title,
			content: article.content.slice(0, maxCharsPerArticle),
		}));
}

export function buildSystemPrompt(preferences: string): string {
	return [
		"You are the Almanac wiki compiler — the sole author of a personal Wikipedia vault.",
		"Every run must leave the knowledge base better and more connected, and it must be",
		"safe to run repeatedly (idempotent: same inputs produce the same outputs).",
		"",
		"## Preferences (highest priority — style and organization rules)",
		preferences.trim()
			? preferences
			: "(no preferences file found — use clean defaults)",
		"",
		"## Rules",
		"1. New concept → create a new article. Related to an existing article → update it in place.",
		"2. Improve summaries, add missing [[wikilinks]], and fix inconsistencies you notice.",
		"3. Create short linking/bridge articles only when they reveal a genuinely interesting connection.",
		"4. Every article: good title, kebab-case slug, one-line description, sensible categories.",
		"5. Body uses plain Markdown with [[Wikilinks]] (use [[Title]] or [[slug|custom text]]).",
		"6. NEVER link to articles that do not exist and that you are not creating in the same response.",
		"7. Preserve facts from the source material. Do not invent dates, names, or claims.",
		"8. Keep bodies focused; skip source files with nothing wiki-worthy (return zero articles for them).",
		"9. Body must NOT contain YAML frontmatter — the system adds it. Start directly with content.",
		"10. Prefer updating the single best-matching existing article over creating near-duplicates.",
		"",
		"## Output contract (STRICT — JSON only, no prose, no fences)",
		JSON.stringify({
			articles: [
				{
					slug: "kebab-case-filename-without-md",
					title: "Article Title",
					description: "One line shown under the title.",
					categories: ["Category"],
					action: "create|update",
					body: "Markdown body without frontmatter, with [[wikilinks]].",
				},
			],
			notes: "One short paragraph: what you created/updated and why.",
		}),
	].join("\n");
}

export function buildBatchPrompt(args: {
	rawFiles: RawFile[];
	catalog: WikiCatalogEntry[];
	relevant: RelevantArticle[];
	batchIndex: number;
	batchTotal: number;
}): string {
	const { rawFiles, catalog, relevant, batchIndex, batchTotal } = args;
	const catalogLines =
		catalog.length === 0
			? "(wiki is empty — every concept is new)"
			: catalog
					.map(
						(c) =>
							`- ${c.title} (slug: ${c.slug})` +
							(c.description ? ` — ${c.description}` : "") +
							(c.categories.length > 0 ? ` [${c.categories.join(", ")}]` : ""),
					)
					.join("\n");

	const relevantBlock =
		relevant.length === 0
			? "(no closely-related articles)"
			: relevant
					.map((r) => `### ${r.title} (slug: ${r.slug})\n${r.content}`)
					.join("\n\n---\n\n");

	const sources = rawFiles
		.map((f) => {
			const header = `### SOURCE ${f.source}:${f.relPath} (${f.size} bytes${f.truncated ? ", TRUNCATED" : ""})`;
			if (f.binary) {
				return `${header}\n[BINARY — ${f.skipReason ?? "no readable content"}. Do not create an article from this file alone.]`;
			}
			return `${header}\n${f.text}`;
		})
		.join("\n\n====\n\n");

	return [
		`Batch ${batchIndex + 1} of ${batchTotal}. Decide what needs to happen for these sources.`,
		"",
		"## Existing wiki catalog (use exact slugs/titles when linking or updating)",
		catalogLines,
		"",
		"## Most relevant existing articles (full text — update these when related)",
		relevantBlock,
		"",
		"## New raw material for this batch",
		sources,
		"",
		"Return STRICT JSON per the output contract. No prose outside the JSON.",
	].join("\n");
}

/** Split raw files into batches capped at ~maxChars of source text each. */
export function batchRawFiles(
	files: RawFile[],
	maxChars = 20_000,
): RawFile[][] {
	const batches: RawFile[][] = [];
	let current: RawFile[] = [];
	let currentChars = 0;
	for (const f of files) {
		const size = f.binary ? 200 : Math.max(200, f.text.length);
		if (current.length > 0 && currentChars + size > maxChars) {
			batches.push(current);
			current = [];
			currentChars = 0;
		}
		current.push(f);
		currentChars += size;
	}
	if (current.length > 0) batches.push(current);
	return batches;
}
