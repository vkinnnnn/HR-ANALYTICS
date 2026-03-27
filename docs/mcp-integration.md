# MCP & Skills Integration Guide

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code Agent                     │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ │
│  │  Memory   │ │ Context7 │ │  GitHub  │ │  Stitch   │ │
│  │   MCP     │ │   MCP    │ │   MCP    │ │   MCP     │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬──────┘ │
│       │             │            │             │        │
│  ┌────┴─────┐  Library    Issues/PRs      Gemini       │
│  │ memory   │  docs via   via GitHub      AI via       │
│  │ .json    │  Upstash    REST API        Google       │
│  └──────────┘                                          │
│                                                         │
│  ┌──────────────────────────────────┐                  │
│  │         Local Skills             │                  │
│  │  .claude/skills/gh-issues/       │                  │
│  │  .claude/skills/skill-lookup/    │                  │
│  └──────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────┘
```

## Configuration Files

| File | Purpose | Git-tracked? |
|---|---|---|
| `.mcp.json` | MCP server definitions | Yes (tokens use env var refs) |
| `.claude/settings.local.json` | Env vars (GITHUB_TOKEN) | **No** (gitignored) |
| `.claude/skills/*/SKILL.md` | Local skill definitions | Yes |
| `.mcp-data/memory/memory.json` | Memory MCP persistent store | **No** (gitignored) |

## MCP Servers

### 1. Memory MCP (`@modelcontextprotocol/server-memory`)

**Purpose:** Persistent knowledge graph memory across sessions.

**Storage:** `.mcp-data/memory/memory.json`

**How it works:**
- Stores entities + relations as a JSON knowledge graph
- Persists across agent sessions
- Tools: `create_entities`, `create_relations`, `search_nodes`, `read_graph`, `delete_entities`

**Startup:** Auto-started by Claude Code when configured in `.mcp.json`

**Reset memory:**
```bash
rm .mcp-data/memory/memory.json
# Memory will be recreated on next agent session
```

**Backup memory:**
```bash
cp .mcp-data/memory/memory.json .mcp-data/memory/memory.backup.json
```

### 2. Context7 (`@upstash/context7-mcp`)

**Purpose:** Real-time library documentation lookup for any npm/Python package.

**How it works:**
- `resolve-library-id`: Find the Context7 ID for a library (e.g., "react", "fastapi")
- `get-library-docs`: Fetch up-to-date docs, examples, API reference

**Example queries:**
```
"Look up FastAPI dependency injection docs via Context7"
"Get Recharts BarChart API reference from Context7"
"Find pandas DataFrame.groupby docs"
```

**No configuration needed** — uses Upstash's public API.

### 3. GitHub MCP (`@modelcontextprotocol/server-github`)

**Purpose:** GitHub operations — issues, PRs, commits, reviews, actions.

**Auth:** Uses `GITHUB_TOKEN` env var from `.claude/settings.local.json`

**Required token scopes:** `repo`, `read:org` (for private repos add `repo:status`, `write:discussion`)

**Available tools:**
- `list_issues`, `create_issue`, `update_issue`
- `list_pull_requests`, `create_pull_request`, `merge_pull_request`
- `get_file_contents`, `push_files`
- `list_commits`, `search_code`, `search_repositories`

**Security:** Token stored in gitignored `.claude/settings.local.json`, referenced via `${GITHUB_TOKEN}` in `.mcp.json`.

### 4. Stitch MCP (`github:davideast/stitch-mcp`)

**Purpose:** Google Gemini AI integration.

**Auth:** Google API key in `.mcp.json` (consider moving to env var).

## Local Skills

Skills live in `.claude/skills/` — each is a directory with a `SKILL.md` file.

### Installed Skills

| Skill | Trigger | Description |
|---|---|---|
| `gh-issues` | `/gh-issues [owner/repo]` | Auto-fix GitHub issues with parallel sub-agents |
| `skill-lookup` | Ask about skills | Discover and install agent skills from prompts.chat |

### Adding New Skills

1. Create directory: `.claude/skills/my-skill/`
2. Create `SKILL.md` with frontmatter:
```yaml
---
name: my-skill
description: "What this skill does"
user-invocable: true
---
# Skill instructions here
```
3. Skill is automatically available in next session.

### Naming Conventions
- Directory name = skill name (lowercase, hyphens)
- One `SKILL.md` per skill directory
- No version numbers in directory names (use git for versioning)

## Environment Variables

| Variable | Location | Required | Purpose |
|---|---|---|---|
| `GITHUB_TOKEN` | `.claude/settings.local.json` | For GitHub MCP | GitHub Personal Access Token |
| `GOOGLE_API_KEY` | `.mcp.json` | For Stitch MCP | Google/Gemini API key |
| `MEMORY_FILE_PATH` | `.mcp.json` | Auto-set | Memory storage location |
| `SENTRY_DSN` | Cloud Run env | Optional | Error monitoring |
| `REDIS_URL` | Cloud Run env | Optional | ARQ job queue |

## Startup

All MCP servers start automatically when Claude Code opens this project. No manual startup needed.

To verify servers are running, check `/mcp` in the Claude Code UI, or ask:
> "List all connected MCP servers"

## Troubleshooting

| Issue | Fix |
|---|---|
| MCP server not starting | Check `npx -y <package>` works manually. May need `npm cache clean --force`. |
| Memory MCP empty | Check `.mcp-data/memory/memory.json` exists. If deleted, restarts fresh. |
| GitHub MCP auth fail | Verify GITHUB_TOKEN in `.claude/settings.local.json` is valid. Test: `curl -H "Authorization: Bearer $TOKEN" https://api.github.com/user` |
| Context7 timeout | Upstash API may be slow. Retry. No local config needed. |
| Skills not showing | Verify `.claude/skills/<name>/SKILL.md` exists with valid frontmatter. |
| "npx: not found" | Ensure Node.js is installed: `node --version` |

## Security Notes

- **NEVER commit tokens** to `.mcp.json`. Use `${ENV_VAR}` references.
- `.claude/settings.local.json` is gitignored — safe for secrets.
- `.mcp-data/` is gitignored — memory data stays local.
- GitHub token: use **minimum required scopes** (start with `repo` only).
- Rotate tokens periodically via https://github.com/settings/tokens.

## Rollback

To remove any MCP server, delete its entry from `.mcp.json` and restart Claude Code.

To remove all MCP integrations:
```bash
# Remove MCP config (keeps stitch only)
# Edit .mcp.json and remove memory/context7/github entries

# Remove memory data
rm -rf .mcp-data/

# Remove skills
rm -rf .claude/skills/

# Remove env vars
# Edit .claude/settings.local.json and remove env block
```
