# Sprint 5 — From Mock to Production

> **Last updated:** 2026-02-20
> **Branch:** `epic/v3-architecture`
> **Status legend:** ✅ Done · 🔄 In Progress · ⬜ Pending

---

## Task 5.1 — Maintenance & Cleanup 🔄

| # | Item | File(s) | Status |
|---|------|---------|--------|
| 5.1.1 | Remove "Run Origin" detail item from expanded row panel | `ExecutionRow.tsx` | ✅ Done |
| 5.1.2 | Fix hardcoded "Cloud" label in Jira ticket description — compute source (LOCAL/CLOUD) dynamically from execution metadata | `CreateJiraTicketModal.tsx` | ✅ Done |

---

## Task 5.2 — Real-Time Analytics (MongoDB Aggregation) ✅

**Backend — `producer-service`**
- [x] `GET /api/analytics/kpis` → `routes/analytics.ts`
  - Total Runs (current month, org-scoped, excludes soft-deleted)
  - Success Rate % (`PASSED / finishedRuns × 100`, ignores in-progress runs)
  - Avg. Duration ms (finished runs with `endTime` only)
- [x] Registered in `config/routes.ts`

**Frontend — `dashboard-client`**
- [x] `useAnalyticsKPIs.ts` — TanStack Query, 60 s stale time, 2 retries
- [x] `StatsGrid.tsx` — real KPIs + skeleton loading + local fallback while fetching
  - Replaced hardcoded `"3"` Active Services with real Avg. Duration card
- [x] `Dashboard.tsx` — wired hook, passes `kpis` + `kpisLoading` to StatsGrid

---

## Task 5.3 — Scalability (Pagination & Filtering) ✅

**Backend**
- [x] `GET /api/executions` updated in `config/routes.ts`
  - `limit` (default 25, max 100), `offset` (default 0, min 0)
  - `status` comma-separated → `$in` filter (normalized to uppercase)
  - `environment` → case-insensitive regex, special-chars escaped
  - `startAfter` / `startBefore` → `startTime $gte/$lte` (end-date extended to 23:59:59 UTC)
  - `countDocuments` + `find` run in parallel
  - Returns `{ success, data: { executions, total, limit, offset } }`

**Frontend**
- [x] `useExecutions.ts` — full rewrite; exports `IExecutionFilters` + `IExecutionPage`
  - `queryKeyRef` pattern: sync-updated ref ensures socket handlers target the live cache key
  - `execution-updated`: in-place update if row on current page, else `invalidateQueries`
  - `setExecutions`: optimistic helper that also adjusts `total` count
- [x] `FilterBar.tsx` — Status multi-select chips (7 statuses, palette-matched), Environment button group, date range inputs, Clear badge + button
- [x] `Pagination.tsx` — "Showing X–Y of Z results", Prev/Next, Page X/Y, opacity dim during loading
- [x] `Dashboard.tsx` — single `filters` state; `handleFilterChange` resets offset to 0; `handlePageChange` moves offset only

---

## Task 5.4 — Run Groups (Folder/Group View) ✅

**Schema**
- [x] Migration `005-add-execution-group-fields.ts` — adds sparse compound indexes on `(organizationId, groupName, startTime)` and `(organizationId, batchId)` to `executions` collection

**Backend**
- [x] `groupName` / `batchId` exposed in `GET /api/executions` response (fields stored at creation time)
- [x] Accepted & persisted via `POST /api/execution-request` Zod schema (`shared-types`)
- [x] `GET /api/executions/grouped` — MongoDB `$group`+`$facet` aggregation; returns `{ groups[], totalGroups, limit, offset }`

**Frontend**
- [x] `GroupHeaderRow.tsx` — collapsible TR with group name, X/Y Passed badge, last run timestamp
- [x] `ExecutionList.tsx` — supports `viewMode: 'flat' | 'grouped'` + `groups` prop; renders `GroupHeaderRow` + collapsible child rows
- [x] `FilterBar.tsx` — "View Mode" segmented control (Flat / Grouped) using `List` / `LayoutList` icons
- [x] `Dashboard.tsx` — `viewMode` state persisted to `localStorage`; switches between `useExecutions` and `useGroupedExecutions`; dual pagination (by records vs by groups)
- [x] `useGroupedExecutions.ts` — TanStack Query hook; Socket.io in-place update patches within groups; `enabled` guard skips fetch in flat mode

**Worker**
- [x] `worker.ts` — destructures `groupName` / `batchId` from RabbitMQ task; writes them to DB on `RUNNING` update and includes them in `notifyProducer` broadcasts

---

## Task 5.5 — Layout Evolution ⬜

- [ ] Refactor `Dashboard.tsx` to full-screen layout (remove max-width container)
- [ ] Extract collapsible `Sidebar.tsx` with navigation links (Dashboard, Settings, Docs)
- [ ] `DashboardHeader.tsx` — convert from embedded `<style>` tags to Tailwind-only
- [ ] Persist sidebar collapsed state in `localStorage`

---

## Task 5.6 — UX Polish, Bulk Actions & Documentation 🔄

### 5.6.1 — Quick UX Wins ✅

| # | Item | File(s) | Status |
|---|------|---------|--------|
| 5.6.1a | Dynamic Source Resolution — use `window.location.hostname` (LOCAL/CLOUD), not execution metadata | `CreateJiraTicketModal.tsx` | ✅ Done |
| 5.6.1b | Sidebar "Docs" link — update to `http://docs.automation.keinar.com/`, remove disabled state | `Sidebar.tsx` | ✅ Done |
| 5.6.1c | Filter Cleanup — remove "Analyzing", "Pending", "Running" chips from FilterBar | `FilterBar.tsx` | ✅ Done |
| 5.6.1d | Scroll Locking — add `overscroll-contain` to log `<pre>` in expanded row panel | `ExecutionRow.tsx` | ✅ Done |

### 5.6.2 — Bulk Actions System ⬜

| # | Item | File(s) | Status |
|---|------|---------|--------|
| 5.6.2a | Selection Model — checkbox per `ExecutionRow` + "Select All" in table header | `ExecutionRow.tsx`, `ExecutionList.tsx` | ⬜ Pending |
| 5.6.2b | Bulk Actions Bar — floating bar (visible when items selected) with "Delete Selected" + "Group Selected" (popover for group name) | New `BulkActionsBar.tsx` | ⬜ Pending |
| 5.6.2c | API: `PATCH /api/executions/bulk` (grouping) + `DELETE /api/executions/bulk` | `producer-service/config/routes.ts`, new route handler | ⬜ Pending |

### 5.6.3 — Documentation Update ⬜

| # | Item | File(s) | Status |
|---|------|---------|--------|
| 5.6.3a | README.md — new Layout Architecture section (Sidebar, full-screen), Advanced Features (Analytics, Jira ADF, Run Groups), updated Tech Stack | `README.md` | ⬜ Pending |
| 5.6.3b | API docs — document pagination (`limit`/`offset`) and analytics (`/api/analytics/kpis`) endpoints | `README.md` | ⬜ Pending |

### Constraints
- All code, comments, and documentation in **English**.
- MongoDB bulk operations must use indexed fields (`organizationId`, `_id`) — no collection scans.
- Bulk delete: soft-delete pattern (`deletedAt: new Date()`) consistent with existing queries.

---

## Dependency Map

```
5.1 ──► 5.2 ──► 5.3
              └──► 5.4 (independent, but benefits from 5.3 pagination)
5.5 (independent — pure layout refactor)
5.6.1 (independent quick wins)
5.6.1 ──► 5.6.2 (bulk actions build on stable row/list components)
5.6.2 ──► 5.6.3 (docs written after features are stable)
```

---

## Architectural Notes

- All API responses must follow `{ success: boolean; data?: T; error?: string }`.
- Every DB query must include `organizationId` for tenant isolation.
- Styling: **Tailwind CSS only** — no inline styles, no pure CSS additions.
- Logging: `app.log.*` in producer-service, `logger.*` in worker-service.
- Commit after each completed task or logical sub-phase.
