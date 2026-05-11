# Shahak Page Design

Date: 2026-05-11

## Overview

Add a dedicated job dashboard page for a friend (Shahak) at `jobs.guyregev.dev/shahak`. The page runs a separate LinkedIn search using the owner's credentials, stores results in its own DB table, and presents a simplified version of the main dashboard UI.

The main dashboard (`/`) is untouched — no new tab, no changes.

## Architecture

### Data

New `shahak_jobs` SQLite table managed by a new `lib/db/shahak.js` module:

```sql
shahak_jobs (
  id TEXT PRIMARY KEY,
  title TEXT,
  company TEXT,
  location TEXT,
  url TEXT,
  company_page_url TEXT,
  first_seen_at TEXT,
  last_seen_at TEXT,
  hidden_at TEXT          -- soft delete; never reset by upsert
)
```

No `status` column — no applied/ignored tracking.

### Search

`SHAHAK_QUERY_PARAMS` defined in `config.js` alongside `DEFAULT_QUERY_PARAMS`. Uses the same `searchJobs()` function with different keywords/experience/etc.

### Cron

Shahak's fetch runs on the same schedule as the LinkedIn cron (`CRON_SCHEDULE`). No separate env var needed.

### Notifications

ntfy with `label: "Shahak Job"` and `tags: ["person"]` to distinguish from the owner's LinkedIn jobs (`label: "Job"`, `tags: ["briefcase"]`) and Checkpoint (`label: "Checkpoint Job"`, `tags: ["shield"]`).

## API Routes (new)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/shahak/jobs` | List Shahak's visible jobs (excluding soft-deleted) |
| DELETE | `/api/shahak/jobs/:id` | Soft-delete a job (sets `hidden_at`) |

## Frontend

### Owner's dashboard (`/`)

No changes.

### Shahak's page (`/shahak`)

Served by a new `public/shahak.html`. Matches the main dashboard's dark industrial aesthetic (same fonts, same card layout, same color system) with these differences:

- Accent color: `#4ade80` (green) instead of amber
- Single tab — no tab bar needed
- Job cards have a **Delete** button only — no Applied / Ignored
- No "Fetch jobs" button (cron-only, no manual trigger)
- No stats bar

Express serves `shahak.html` on `GET /shahak`.

## What Is Reused

- `searchJobs()` — called with `SHAHAK_QUERY_PARAMS`
- `notifyNewJobs()` — called with Shahak-specific label/tags
- Existing `httpClient` / LinkedIn auth
- All CSS design tokens and card structure (copied into `shahak.html`, green accent swapped in)

## What Is New

- `lib/db/shahak.js` — `initShahakTable`, `upsertShahakJobs`, `getShahakJobs`, `deleteShahakJob`
- `SHAHAK_QUERY_PARAMS` in `config.js`
- `runShahakFetch()` function in `server.mjs`
- Cron entry in `server.mjs`
- Two API routes in `server.mjs`
- `public/shahak.html`
