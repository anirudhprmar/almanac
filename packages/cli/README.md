# @almanac-cli/almanac

The official command-line interface and Model Context Protocol (MCP) server for **Almanac** — your markdown-native personal wiki and knowledge base.

---

## Installation

Install globally or run directly with your preferred package manager:

```bash
# Using Bun (recommended)
bun add -g @almanac-cli/almanac

# Using npm / pnpm / yarn
npm install -g @almanac-cli/almanac
pnpm add -g @almanac-cli/almanac

# Or run directly on-demand
npx @almanac-cli/almanac <command>
bunx @almanac-cli/almanac <command>
```

---

## Quick Start

```bash
# 1. Initialize a new vault in the current directory
almanac init

# 2. Add raw notes, docs, transcripts, or images into raw/
# ...

# 3. Preview and compile raw inputs into structured wiki articles
almanac compile --dry-run
almanac compile

# 4. Start the web UI and API server
almanac dev
```

---

## Commands Overview

| Command | Description |
|---|---|
| [`almanac init`](#almanac-init) | Bootstrap a new vault folder structure and config |
| [`almanac dev`](#almanac-dev) | Start the Next.js web client and Hono server |
| [`almanac compile`](#almanac-compile) | Compile inbox notes (`raw/`, `drafts/`) into wiki articles |
| [`almanac ask`](#almanac-ask) | RAG Q&A with wikilink citations |
| [`almanac search`](#almanac-search) | Full-text search across all vault articles |
| [`almanac mcp`](#almanac-mcp) | Start the stdio Model Context Protocol (MCP) server |
| [`almanac new`](#almanac-new) | Create a new markdown note in the vault |
| [`almanac list`](#almanac-list) | List all articles (newest first) |
| [`almanac show`](#almanac-show) | Display an article along with its backlinks |
| [`almanac backlinks`](#almanac-backlinks) | List incoming backlinks for a given article slug |
| [`almanac links`](#almanac-links) | List outgoing links from a given article slug |
| [`almanac graph`](#almanac-graph) | Export vault link graph (JSON or Graphviz DOT) |
| [`almanac validate`](#almanac-validate) | Check for duplicate slugs, broken links, and orphans |
| [`almanac stats`](#almanac-stats) | Print vault health metrics and connectivity stats |
| [`almanac index`](#almanac-index) | Build a serialized MiniSearch index |

---

## Command Reference

### `almanac init`

Bootstrap a new Almanac vault layout in the target folder.

```bash
almanac init [dir] [--name "My Vault"] [--json] [--force] [--empty]
```

**Options:**
- `dir` *(positional)*: Target directory (defaults to current directory).
- `--name <name>`: Vault name stored in config.
- `--json` (`-j`): Generate `config/almanac.config.json` instead of `.ts`.
- `--force`: Re-scaffold even if the directory is already an Almanac vault.
- `--empty`: Skip creating starter pages (`wiki/index.md`, `wiki/preferences.md`).

---

### `almanac dev`

Start the Next.js web application and the Hono API server.

```bash
almanac dev [--web-port 3001] [--server-port 3000] [--turbo] [--no-web] [--no-server]
```

**Options:**
- `--web-port <port>`: Port for the web interface (default: `3001`).
- `--server-port <port>`: Port for the API server (default: `3000`).
- `--turbo`: Run concurrently via `turbo run dev`.
- `--no-web`: Run API server only.
- `--no-server`: Run frontend only.

---

### `almanac compile`

Compile raw notes, transcripts, clips, and images from `raw/` and `drafts/` into structured wiki articles with backlinks and frontmatter.

```bash
almanac compile [options]
```

**Options:**
- `--dry-run`: Preview changes without calling LLMs or modifying files.
- `--full`: Force re-processing of all raw source files (ignore incremental cache).
- `--artifacts-only`: Skip LLM calls; rebuild search index, graph artifacts, and index page.
- `--model <model>`: Override LLM model (or set `ALMANAC_LLM_MODEL`).
- `--provider <provider>`: LLM provider override (`openai`, `anthropic`, or `opencode`).
- `--base-url <url>`: Override LLM base URL for OpenAI-compatible endpoints (Ollama, LM Studio, OpenRouter, vLLM).
- `--agent <agent>`: OpenCode agent override (when using `opencode` provider).
- `--attach <url>`: Connect to a running OpenCode server instance (e.g. `http://localhost:4096`) to skip cold boots.
- `--archive`: Move processed files from `raw/*` into `raw/.processed/`.
- `--drafts` / `--no-drafts`: Toggle scanning `drafts/` (default: `true`).
- `--outputs`: Include scanning `outputs/` for source inputs.
- `--max-chars <n>`: Maximum characters read per file (1,000–200,000).
- `--dir <dir>` (`-d`): Custom vault content directory (defaults to `wiki/` or `CONTENT_DIR`).
- `--out <dir>` (`-o`): Output directory for JSON artifacts (defaults to `outputs/`).
- `--pretty`: Pretty-print generated JSON artifacts.
- `--json`: Output compile results summary as JSON.

---

### `almanac ask`

Ask natural-language questions answered directly from your vault with `[[Wikilink]]` citations. If no LLM is configured, gracefully falls back to ranked excerpts.

```bash
almanac ask "<question>" [--limit 5] [--provider openai|anthropic|opencode] [--model <model>] [--json]
```

**Options:**
- `<question>` *(required positional)*: The query to ask.
- `--limit <n>`: Number of context articles to retrieve (1–10, default: `5`).
- `--model <model>`: LLM model override.
- `--provider <provider>`: LLM provider (`openai`, `anthropic`, or `opencode`).
- `--base-url <url>`: Custom API base URL.
- `--json`: Return structured JSON response.

---

### `almanac search`

Full-text search across all articles in the vault using MiniSearch.

```bash
almanac search "<query>" [--limit 10] [--json]
```

**Options:**
- `<query>` *(required positional)*: Search query string.
- `--limit <n>`: Maximum number of results to return (1–50, default: `10`).
- `--dir <dir>`: Target vault directory.
- `--json`: Output matching articles with relevance scores as JSON.

---

### `almanac mcp`

Start the stdio Model Context Protocol (MCP) server, allowing AI agents (Claude Code, Cursor, OpenCode, Codex, etc.) to query and write to the vault directly.

```bash
# Start the stdio MCP server
almanac mcp [--dir <path>]

# Print ready-to-copy client configuration snippets
almanac mcp --info
```

#### MCP Integration

**Claude Code:**
```bash
claude mcp add almanac -- almanac mcp
```

**Cursor / Generic `mcp.json`:**
```json
{
  "mcpServers": {
    "almanac": {
      "command": "almanac",
      "args": ["mcp"]
    }
  }
}
```

**Available MCP Tools:**
- `search` — Full-text search across vault articles.
- `get_article` — Read an article and its metadata by slug.
- `get_backlinks` — Find all articles referencing a slug.
- `get_neighborhood` — Inspect local link graph surrounding a slug.
- `get_preferences` — Read the vault's style guide and compilation preferences.
- `ask_almanac` — RAG-based question answering over the vault.
- `file_to_almanac` — Stage new notes/documents into the vault inbox (`raw/`).

---

### `almanac new`

Create a new markdown note in the vault with standard frontmatter.

```bash
almanac new "<title>" [--slug <slug>] [--description "<desc>"] [--force]
```

---

### `almanac list`

List articles in the vault, sorted newest first.

```bash
almanac list [--limit <n>] [--json]
```

---

### `almanac show`

Display an article's full markdown content, frontmatter metadata, and incoming backlinks.

```bash
almanac show <slug|title> [--json]
```

---

### `almanac backlinks` & `almanac links`

Inspect vault graph connections from the command line:

```bash
# What links here?
almanac backlinks <slug|title> [--json]

# Where does this article link to?
almanac links <slug|title> [--json]
```

---

### `almanac graph`

Export the global or local link graph.

```bash
# Export global link graph as JSON
almanac graph

# Export local subgraph for a specific article up to depth 2
almanac graph <slug> --depth 2

# Export in Graphviz DOT format to a file
almanac graph --format dot -o graph.dot
```

---

### `almanac validate`

Scan the vault for duplicate slugs, broken wikilinks, and orphan articles.

```bash
almanac validate [--strict] [--json]
```

**Options:**
- `--strict`: Exit with a non-zero exit code if any issues are detected (useful in CI / pre-commit hooks).

---

### `almanac stats`

Display vault summary metrics including total articles, link counts, orphan counts, average degree, and most connected nodes.

```bash
almanac stats [--json]
```

---

### `almanac index`

Generate a pre-built MiniSearch index artifact for client-side search.

```bash
almanac index [-o outputs/search-index.json] [--pretty]
```

---

## Global Options

Common flags supported across most commands:

- `--dir <dir>` / `-d`: Specify the vault markdown directory (defaults to `wiki/` or `CONTENT_DIR`).
- `--json`: Output machine-readable JSON to stdout (logs are redirected to stderr).

---

## Environment Variables

| Variable | Description |
|---|---|
| `CONTENT_DIR` | Default path to the vault content folder (e.g. `./wiki`) |
| `OPENAI_API_KEY` | API key for OpenAI LLM provider |
| `ANTHROPIC_API_KEY` | API key for Anthropic Claude provider |
| `ALMANAC_LLM_PROVIDER` | Default provider (`openai`, `anthropic`, `opencode`) |
| `ALMANAC_LLM_MODEL` | Default LLM model name |
| `ALMANAC_LLM_BASE_URL` | Base URL for custom/local OpenAI-compatible or Anthropic endpoints |
| `ALMANAC_OPENCODE_SERVER` | URL of warm OpenCode server (e.g. `http://localhost:4096`) |

---

## License

[MIT](../../LICENSE)
