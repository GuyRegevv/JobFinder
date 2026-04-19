# Checkpoint Jobs Feature — Design Spec

**Date:** 2026-04-19

## Overview

Add a dedicated Checkpoint tab to JobFinderJS that scrapes Check Point's Israel careers page hourly, stores new jobs, sends ntfy notifications for new finds, and displays them in a pink-accented read-only view with per-job delete.

---

## Data Layer

### New table: `checkpoint_jobs`

```sql
checkpoint_jobs (
  id TEXT PRIMARY KEY,       -- from btn.dataset.id
  title TEXT,
  link TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
)
```

### New module: `lib/db/checkpoint.js`

Functions:
- `initCheckpointTable(db)` — creates table if not exists; called at server startup
- `upsertCheckpointJobs(jobs)` → `{ newJobs, updatedCount }` — inserts new, updates `last_seen_at` on existing
- `getCheckpointJobs()` → all jobs ordered by `first_seen_at DESC`
- `deleteCheckpointJob(id)` — hard delete by id
- `getCheckpointStats()` → `{ total }` (for future use; `lastCheckpointFetch` comes from server state)

---

## Scraper

### New module: `lib/jobs/fetchCheckpointJobs.js`

- Dependency: `cheerio` (Node.js HTML parser)
- Base URL: `https://careers.checkpoint.com/index.php?q=&module=cpcareers&a=search&fa%5B%5D=country_ss:Israel&sort=date_published_display_s+desc`
- Pagination: `while (true)` loop with `&start=N` (step 10); breaks when a page returns zero `.save-job-btn` elements
- Extracts per job from `btn` attributes: `id` (`dataset.id`), `title` (`dataset.title`), `link` (`dataset.link`)
- Returns `{ jobs: Array<{ id, title, link }> }`

---

## Server Integration (`server.mjs`)

### New state
```js
let lastCheckpointFetch = { time: null, status: null, jobsFound: 0, newJobs: 0 };
let isCheckpointFetching = false;
```

### New cron
- Schedule: `"0 * * * *"` (every hour on the hour)
- Calls `fetchCheckpointJobs()` → `upsertCheckpointJobs()` → `notifyNewJobs()` if any new
- ntfy notification uses same topic/server/clickUrl env vars as LinkedIn jobs

### New API endpoints
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/checkpoint/jobs` | Returns all checkpoint jobs |
| `DELETE` | `/api/checkpoint/jobs/:id` | Hard deletes a checkpoint job |

### Extended `GET /api/stats`
Response includes `lastCheckpointFetch` alongside existing `lastFetch`.

---

## Frontend (`public/index.html`)

### Header metric
- Add "Last Fetched CP" stat next to existing "Last Fetch"
- Value: `formatTime(stats.lastCheckpointFetch?.time)`

### Tab bar
- New `Checkpoint` filter button added after `All`
- Pink border accent when active: `border-color: var(--cp-pink)`
- New CSS variable: `--cp-pink: #f472b6`

### Checkpoint job cards
- Pink left border: `border-left: 3px solid var(--cp-pink)`
- Fields displayed: title (linked to `link`, opens in new tab), time since `first_seen_at`
- Single action: **Delete** button — calls `DELETE /api/checkpoint/jobs/:id`, removes card from DOM immediately
- No status actions (applied/ignored)

### Data management
- Separate `checkpointJobs` array, populated from `/api/checkpoint/jobs` on load
- Switching to Checkpoint tab renders `checkpointJobs` into the existing grid
- Switching away renders the LinkedIn `jobs` array
- Search bar filters by title across whichever tab is active

### No keyboard shortcuts for delete
Delete is mouse-only — it's permanent and irreversible.

---

## Dependencies

- `cheerio` — add to `package.json` for server-side HTML parsing

---

## What is NOT changing

- LinkedIn fetch logic, DB schema, and API endpoints are untouched
- ntfy notification format and env vars are reused as-is
- No new routes or HTML files — single-page approach
