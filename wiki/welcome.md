---
title: Welcome
description: Start here — your Almanac vault rendered as a personal Wikipedia.
categories:
  - Meta
  - Help
status: Active demo
engine: Usernamepedia
---

## Getting started

**Welcome** to your personal encyclopedia. Every markdown file in `wiki/` with a
`title` in its frontmatter becomes an *article* — with an infobox, a table of
contents, backlinks, categories, and history, just like Wikipedia.

## Writing articles

Create a note with frontmatter, then write plain markdown:

```md
---
title: My First Article
description: One line that appears under the title.
categories:
  - Notes
---

## Section

Write text here. Link to [[Welcome]] to connect articles.
```

Supported frontmatter fields:

| Field         | Used for                                   |
| ------------- | ------------------------------------------ |
| `title`       | Article title (required)                     |
| `description` | Subtitle under the title                   |
| `categories`  | Category box at the bottom of the article  |
| anything else | Extra rows in the infobox, e.g. `status`   |

## Linking articles

Connect notes with `[[wikilinks]]` — use `[[Welcome]]` for this page, or
`[[Some Article|custom text]]` for an alias. Links between articles power three
features at once:

- *See also* — outgoing links listed on each article
- *What links here* — backlinks from every article that mentions this one
- *Graph view* — the interactive node graph at `/graph`

## Search and discovery

Use the search box (top right) for full-text search across titles, descriptions,
and content — typos and prefix matches are tolerated. Feeling lucky? Jump to a
[*random article*](/random).

> This demo article is itself a normal vault note. Edit `wiki/welcome.md`,
> save, and watch the site update — no rebuild required.
