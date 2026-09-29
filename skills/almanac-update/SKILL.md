---
name: almanac-update
description: Ingest new material into the Almanac vault. Use when the user drops in notes, transcripts, exports, or files and wants them folded into linked wiki articles. Stages to raw/drafts, compiles, validates.
---

# Almanac Update

New knowledge enters through `raw/` (or `drafts/`), never by hand-editing `wiki/`. The compiler (`almanac compile`, LLM-backed) owns `wiki/` — it creates/updates articles, adds `[[wikilinks]]`, and rebuilds the catalog. Your job: stage cleanly, preview, compile, verify.

## Available tools

| Goal | MCP tool | CLI fallback |
|---|---|---|
| Read style rules | `get_preferences()` | read `wiki/preferences.md` |
| Stage new text | `file_to_almanac(filename, content, subdir)` | save file to `raw/<name>.md`, or `almanac new "Title"` for a wiki note |
| Check duplicates first | `search`, `get_article` | `almanac search`, `almanac show` |
| Preview compile | — | `almanac compile --dry-run` |
| Compile | — | `almanac compile` (add `--artifacts-only` for indexes without LLM) |
| Verify links | — | `almanac validate` (or `almanac validate --strict` in CI) |

## Workflow

1. **Read preferences** (`get_preferences`). Style, categories, and linking conventions come from there — follow them over defaults.
2. **Dedupe check.** `search` the vault for the incoming concepts. Note which existing articles (exact slugs) the new material extends — the compiler prefers updating over creating near-duplicates, and telling it helps.
3. **Stage the material.**
   - Small paste / chat answer: `file_to_almanac` with a dated kebab-case filename (`2026-09-29-topic.md`), `subdir: "raw"`.
   - Existing file on disk: same tool with `sourcePath` (absolute path), or copy it into `raw/` yourself.
   - Draft-quality / not-yet-trusted text: `subdir: "drafts"`.
   - One file per topic; keep each under ~200KB. Binaries (PDF/PNG/MP3) are recorded as metadata only — don't expect articles from them.
4. **Dry-run.** `almanac compile --dry-run` — confirm the right sources are picked up as new/changed and the LLM is configured. Nothing is written.
5. **Compile.** `almanac compile` (incremental by default; `--full` re-processes everything). Report created (`+ slug`) vs updated (`~ slug`) lines from its output.
6. **Validate.** `almanac validate`. Fix what you can without inventing facts:
   - `broken-link` → point the `[[link]]` at the exact existing slug or create the missing article.
   - `orphan` → add a `[[wikilink]]` in or out (bridge notes only when the connection is genuine).
   - `missing-description` → add the one-line frontmatter description.
7. **Report.** What was created/updated (with `[[Wikilinks]]`), what was skipped (binaries, nothing wiki-worthy), and remaining lint issues.

## Guardrails

- NEVER write `wiki/*.md` by hand — stage to `raw/`/`drafts/` and compile. (`wiki/index.md` is system-owned and rebuilt automatically.)
- Preserve facts from the source. Do not invent dates, names, or claims.
- Every new article needs: good title, kebab-case slug, one-line description, sensible categories, and at least one `[[wikilink]]` in or out.
- Never link to articles that don't exist and aren't being created in the same run.
- Idempotency matters: re-running compile with the same inputs must produce the same vault. Don't force-write unchanged content.
- Large imports: split into batches and compile incrementally; use `--archive` to move processed `raw/*` into `raw/.processed/` when the user wants an inbox-zero flow.
