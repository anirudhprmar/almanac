# Almanac

Your personal Wikipedia, rendered from plain markdown — and an MCP server so AI agents can live inside it.

Drop notes, transcripts, and exports into `raw/`. `almanac compile` turns them into linked articles with infoboxes, backlinks, and a graph. Browse at `localhost:3001`, or point Claude Code / Cursor at the vault and let the agent read, write, and reason over it.

## Why

A wiki you can read is only half the story. Almanac is designed so an agent is a first-class resident of your knowledge base:

- **Retrieval-augmented Q&A** — `ask_almanac` answers from your articles with `[[Wikilink]]` citations, not from the open web.
- **Graph-aware** — agents see backlinks and neighborhoods before editing, so they update existing articles instead of creating near-duplicates.
- **Safe by construction** — new material is staged in `raw/`; the compiler owns `wiki/`.

## Quick start

```bash
bun install
bun run dev
```

Frontend on [localhost:3001](http://localhost:3001), API on [localhost:3000](http://localhost:3000).

To try the compiler, put a text file in `raw/` and run:

```bash
almanac compile --dry-run   # preview
almanac compile             # write articles
```

The compiler needs an LLM. It auto-detects `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`, and any OpenAI-compatible endpoint (OpenRouter, Ollama, LM Studio) via `ALMANAC_LLM_BASE_URL`. To reuse your existing OpenCode login instead of an API key, pass `--provider opencode`.

## The vault

```
almanac/
├── wiki/       # articles — the vault itself (the compiler owns this)
├── raw/        # inbox: source material waiting to be compiled
├── drafts/     # inbox: rough notes, skipped unless --drafts
├── outputs/    # generated artifacts (articles.json, graph.json, search-index.json)
└── config/     # almanac.config.*
```

An article is a markdown file with a `title` in its frontmatter:

```md
---
title: SQLite WAL Mode
description: Why writes don't block readers in WAL.
categories: [Databases]
---

Body text with [[links]] to related articles.
```

Supported fields: `title` (required), `description`, `categories`, and any extra key — extras show up as infobox rows. Links use `[[Wikilinks]]` and drive *see also*, *what links here*, and the graph view.

`wiki/preferences.md` is the vault's style guide. The compiler and the agent both read it, so put your voice and conventions there.

## CLI

```bash
almanac init                     # bootstrap a new vault
almanac dev                      # run web + server
almanac compile [--dry-run]      # raw/ -> wiki/
almanac ask "question"           # RAG answer with citations
almanac mcp                      # serve the vault over MCP stdio
almanac search "term"            # full-text search
almanac show <slug>              # article + backlinks
almanac backlinks <slug>         # what links here
almanac graph <slug> [--depth 2] # local link graph
almanac validate                 # broken links, orphans, duplicates
almanac stats                    # vault health
```

Most commands accept `--dir` (vault path) and `--json`.

## Agents

### MCP server

Seven tools: `search`, `get_article`, `get_backlinks`, `get_neighborhood`, `get_preferences`, `ask_almanac`, `file_to_almanac`.

```bash
claude mcp add almanac -- almanac mcp
```

For Cursor or any other MCP client, point at the same command:

```json
{
  "mcpServers": {
    "almanac": { "command": "almanac", "args": ["mcp"] }
  }
}
```

`almanac mcp --info` prints client config for your vault path. A Streamable HTTP endpoint is also mounted at `POST /mcp` when the server runs (`GET /mcp/info` lists the tools), and the server entry is available directly via `bun run apps/server/src/mcp.ts`.

Without an LLM configured, `ask_almanac` degrades to ranked excerpts instead of failing.

### Skills

Three workflows in [`skills/`](./skills), each with tool mappings, steps, and guardrails:

| Skill | Use it for |
|---|---|
| [`almanac-query`](./skills/almanac-query) | Answering questions from the vault. Read-only, always cited. |
| [`almanac-update`](./skills/almanac-update) | Folding new material in: stage → dry-run → compile → validate. |
| [`almanac-briefing`](./skills/almanac-briefing) | Briefings and digests on a topic or the whole vault. |

## Project structure

```
apps/
  web/            # Next.js frontend
  server/         # Hono API, content watcher, MCP server
packages/
  core/           # vault logic: loading, search, graph, compile, MCP tools
  cli/            # the almanac command
  ui/             # shared shadcn/ui primitives
  config/         # shared tsconfig
```

`packages/core` is the single source of truth — the HTTP API, the CLI, and the MCP server all call the same functions, so behavior can't drift between them.

## Scripts

| Command | Does |
|---|---|
| `bun run dev` | start everything in watch mode |
| `bun run dev:web` / `dev:server` | start one app |
| `bun run build` | build all packages |
| `bun run check-types` | typecheck every workspace |
| `bun run check` | Biome format + lint (also the pre-commit hook) |
| `bun run env:generate` | regenerate `src/env.ts` from `.env.schema` |

## Environment

Each app owns a `.env.schema`; Varlock generates `src/env.ts` from it during install. Commit schemas, keep secrets in ignored env files. After editing a schema run `bun run env:generate`.

Useful server vars: `CONTENT_DIR` (vault path), `CACHE_PROVIDER` (`memory` default, or `redis`), `REDIS_URL`, `CORS_ORIGIN`. Cache defaults to in-memory, so Redis is optional.

## Stack

TypeScript · Next.js · Hono · Bun · Turborepo · Tailwind CSS · shadcn/ui · MiniSearch · Biome