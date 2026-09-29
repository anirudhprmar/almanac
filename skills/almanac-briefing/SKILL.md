---
name: almanac-briefing
description: Produce a briefing or digest from the Almanac vault. Use when the user asks for a daily/weekly briefing, a catch-up, a topic overview, or "what do I know about X". Researches the vault, then writes a tight cited brief.
---

# Almanac Briefing

A briefing is a short, skimmable document grounded in the vault: what the vault knows about the requested scope, what's new or connected, and what's missing. Default to Markdown the user can paste anywhere.

## Available tools

| Goal | MCP tool | CLI fallback |
|---|---|---|
| Vault shape | — | `almanac stats`, `almanac list --limit 30` |
| Topic research | `search`, `get_article`, `get_backlinks`, `get_neighborhood` | `almanac search`, `almanac show`, `almanac backlinks`, `almanac graph` |
| Per-question synthesis | `ask_almanac(question)` | `almanac ask "question"` |
| Freshness | `search` + article `lastModified` | `almanac list` (newest first) |

## Workflow

1. **Scope the brief.** One topic (`"What do I know about X?"`) or whole-vault (`daily briefing`). For whole-vault: run `almanac stats` + `almanac list --limit 20` to find the newest and most-connected notes — those lead.
2. **Research in passes** (3–6 searches max, then stop):
   - `search` the topic's core terms; read the top 2–3 articles fully.
   - For each key article: `get_backlinks` (what depends on it) and `get_neighborhood` depth 1 (its cluster).
   - For open-ended sub-questions, one `ask_almanac` each rather than manual stitching.
3. **Assemble the brief** in this shape (omit sections that don't apply):

```md
# Briefing: <topic> — <date>

**TL;DR:** 2–3 sentences, the single most important thing first.

## What the vault knows
- Claim with [[Citation]].
- Claim with [[Citation]].

## Key connections
- [[Note A]] ↔ [[Note B]]: why the link matters.

## Fresh / active
- [[Recent Note]] (updated <date>): what's new.

## Gaps
- What's missing or thin, and what to capture next.
```

4. **Cite everything.** Every bullet carries at least one exact-title `[[Wikilink]]`. No uncited claims, no invented facts. If the vault is thin on the topic, say so and keep the brief short rather than padding.
5. **Offer the next step.** One line: what to add (`almanac-update` flow) or which question to dig into.

## Guardrails

- Briefings are READ-ONLY unless the user explicitly asks to save — then write the Markdown to `drafts/briefing-<date>.md` via `file_to_almanac(subdir: "drafts")`, never straight to `wiki/`.
- Respect `get_preferences` tone/length rules when present.
- Cap context: prefer excerpts and depth-1 neighborhoods; don't dump full articles into the brief.
- Date-stamp with the user's local date; mark stale notes (`lastModified` > 6 months) as possibly outdated.
