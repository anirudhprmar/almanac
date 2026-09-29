---
name: almanac-query
description: Answer questions grounded in the Almanac vault. Use when the user asks what the vault knows, wants a fact looked up, or needs research synthesized from vault articles with citations. Read-only — never writes.
---

# Almanac Query

Answer from the vault, not from general knowledge. Every claim must trace to a vault article and cite it with a `[[Wikilink]]`.

## Available tools

Prefer MCP tools when connected as an MCP client; otherwise use the CLI equivalents.

| Goal | MCP tool | CLI fallback |
|---|---|---|
| Discover what exists | `search(query, limit)` | `almanac search "query" --limit 10` |
| Read full article | `get_article(slug)` | `almanac show <slug>` |
| What links here | `get_backlinks(slug)` | `almanac backlinks <slug>` |
| Explore cluster | `get_neighborhood(slug, depth)` | `almanac graph <slug> --depth 1` |
| Style rules | `get_preferences()` | read `wiki/preferences.md` |
| Synthesized answer | `ask_almanac(question, limit)` | `almanac ask "question"` |

Slug resolution is forgiving: slugs, titles, and frontmatter aliases all work (`Welcome`, `welcome`, `welcome.md` all resolve).

## Workflow

1. **Search first.** Call `search` with 2–4 keyword variants of the question (not the full sentence). Scan titles + excerpts, not just the top hit.
2. **Read the best 1–3 hits** with `get_article`. If the article is thin, pull its neighborhood (`get_neighborhood`, depth 1) to find the real coverage.
3. **Check backlinks** for the key article — the most-linked note is usually the canonical one.
4. **Synthesize.** Write a focused answer in the user's language. Cite every non-trivial claim inline with exact-title `[[Wikilinks]]` (e.g. `[[Welcome]]`, `[[My Note|custom text]]`).
5. **Handle gaps honestly.** If the vault has nothing, say so in one sentence and suggest what note to add (don't invent the content).

## Using ask_almanac

`ask_almanac` does steps 1–2 + LLM synthesis in one call (retrieval over the top ~5 articles, then a grounded answer). Prefer it for open-ended questions; do manual `search` → `get_article` when you need to inspect sources yourself or when no LLM is configured (it degrades to ranked excerpts — still useful).

CLI: `almanac ask "How does linking work?" --limit 5` prints answer + sources. Without an LLM key (`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `--provider opencode`) it prints ranked excerpts instead — say so and continue manually.

## Output format

- Short paragraphs or bullets; no throat-clearing.
- Inline `[[Wikilink]]` citations on the claims they support.
- End with a `Sources:` line listing `[[Title]]` links when more than two articles informed the answer.
- Never include file-system paths, scores, or tool JSON in the reply.

## Guardrails

- READ-ONLY. Do not create, edit, or move any vault file. For writes, defer to `almanac-update`.
- Never invent dates, names, or facts. If context conflicts, quote both and flag it.
- Keep context small: excerpts over full dumps; depth 1 neighborhoods unless the question needs more.
- Respect `get_preferences` style rules when they exist.
