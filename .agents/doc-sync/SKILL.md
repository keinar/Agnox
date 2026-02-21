---
name: doc-sync
description: Syncs all project documentation to match the current state of the codebase. Run after a major feature or sprint with "Run DocSync" or "Sync Docs" to purge stale content and inject accurate, up-to-date information.
version: 1.0.0
---

# DocSync

Audits and reconciles all core project documentation against the current state of `PLAN.md` and the codebase. Detects and removes "ghost" content (outdated implementations, deprecated features, superseded UI paradigms) and injects accurate, current information into the correct sections.

## Triggers

- "Run DocSync"
- "Sync Docs"

## Target Documents (in audit order)

1. `PLAN.md` — Source of truth for what was built/completed
2. `PROJECT_CONTEXT.md` — Architecture, component inventory, feature registry
3. `README.md` — Public-facing overview, setup, and feature list
4. `docs/architecture/overview.md` — System design and service topology
5. `docs/features/user-guide.md` — End-user feature documentation

## Workflow

### Step 1 — Analyze
Read `PLAN.md` in full. Extract:
- Features marked **completed** (✅) since the last sync
- Architecture changes (new services, removed services, changed data flows)
- UI/UX paradigm shifts (theme changes, new components, deprecated views)
- API or schema changes

### Step 2 — Audit Core Docs
Read each target document. For every section, flag content that:
- Describes a feature or component that no longer exists
- References an old implementation pattern now replaced
- Shows UI flows that contradict the current design
- Lists a status (e.g., "Planned", "In Progress") that is now stale

### Step 3 — Purge Ghosts
Remove or strike through flagged content. Ghost categories to actively hunt:
- References to deprecated packages, routes, or DB schemas
- Old sprint goals that have since been delivered or cancelled
- UI screenshots, descriptions, or flows from prior design iterations
- Any "Coming Soon" or "Planned" label for features that are now live

### Step 4 — Update
Inject accurate content into the correct sections:
- **Product Features** → add newly completed features with accurate descriptions
- **Roadmap / Sprint Status** → advance statuses to reflect current sprint
- **Component Hierarchy** → add new React components; remove deleted ones
- **Architecture Diagrams / Descriptions** → reflect any new services, queue changes, or auth flow changes
- **API Reference** → note any new or removed endpoints

### Step 5 — Report
Output a structured summary in this exact format:

```
## DocSync Report — [DATE]

### Files Modified
- `FILE_PATH` — [brief description of what changed]

### Ghosts Purged
- [Description of removed content and which file it was in]

### New Content Injected
- [Description of added content and which section it went into]

### No Changes Needed
- [Files that were already accurate]
```

## Rules

- Never fabricate information. If a feature's status is unclear, flag it as `⚠️ NEEDS REVIEW` rather than guessing.
- Do not rewrite documentation style unless content is factually wrong.
- Preserve all headings and document structure; only change content within sections.
- If a target document does not exist, note it in the report as `MISSING` — do not create it automatically.
