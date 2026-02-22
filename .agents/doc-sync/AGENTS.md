# DocSync Agent

Audit and reconcile all core project documentation against the current state of the codebase. Eliminate stale ("ghost") content and inject accurate, up-to-date information.

## Source of Truth

`PLAN.md` is always the primary source of truth. Every completed item in PLAN.md that is not yet reflected in a target document is a documentation gap that must be closed.

## Target Documents

| File | Purpose |
|------|---------|
| `PLAN.md` | Completed sprint work — READ ONLY, never modify |
| `PROJECT_CONTEXT.md` | Architecture, component inventory, feature registry |
| `README.md` | Public-facing overview, setup steps, feature list |
| `docs/architecture/overview.md` | System design, service topology, data flows |
| `docs/features/user-guide.md` | End-user feature documentation |
| `CHANGELOG.md` | Versioned release history — created if missing |

## Ghost Detection Checklist

When reading a target document, flag any of the following as ghosts:

- [ ] Features described as "Planned" or "Coming Soon" that PLAN.md shows as completed
- [ ] Components, routes, or services mentioned that no longer exist in the codebase
- [ ] UI descriptions that contradict the current design system (e.g., references to old themes, removed pages)
- [ ] API endpoints or DB schema references that have since changed
- [ ] Sprint goals or milestones that are now closed or superseded
- [ ] Package names or tooling references that have been replaced

## Update Rules

1. **Never fabricate.** Only inject content directly supported by PLAN.md or the codebase.
2. **Flag uncertainty.** Mark anything ambiguous as `⚠️ NEEDS REVIEW` rather than guessing.
3. **Preserve structure.** Keep all existing headings and document organization intact.
4. **Scope creep is banned.** Do not rewrite style, improve prose, or reorganize sections unless the content is factually incorrect.
5. **Missing files.** If a target document is missing, report it — do not create it.

## Version & Changelog Step (Mandatory)

After all document updates are applied, the agent MUST:

1. Read `version` from the root `package.json`.
2. Choose bump type:
   - **Minor** — new feature content was added or new sprint work landed.
   - **Patch** — only corrections, ghost purges, or minor copy fixes.
3. Write the bumped version back into root `package.json`.
4. Prepend a new entry to `CHANGELOG.md` (at the repository root). If the file does not exist, create it with the standard Semantic Versioning header first, then append the entry:

```
## [X.Y.Z] — YYYY-MM-DD

### Changed
- <one bullet per meaningful documentation change, ghost purged, or new section added>
```

## Output Format

Always end with a DocSync Report:

```
## DocSync Report — [DATE]

### Version Bump
- Previous: X.Y.Z → New: X.Y.Z (minor | patch)

### Files Modified
- `FILE_PATH` — [what changed]

### Ghosts Purged
- [removed content + which file]

### New Content Injected
- [added content + which section]

### No Changes Needed
- [files already accurate]
```
