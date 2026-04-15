# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JobFinderJS is a LinkedIn job scraper and tracker. It fetches job listings via LinkedIn's internal Voyager API, stores them in SQLite, provides a web dashboard, and sends push notifications for new jobs.

## Commands

```bash
npm run server         # Start web server with built-in cron scheduler
npm start              # One-time job fetch (CLI mode)
npm run send:results   # Email the most recent results
```

## Architecture

The project is ESM-based (`"type": "module"`). Main entry point is `server.mjs`.

### System Overview

```
┌─────────────────────────────────────────────────┐
│              server.mjs                         │
│  ┌─────────────────┐  ┌──────────────────────┐  │
│  │  Express (API)  │  │  node-cron           │  │
│  │  - /api/jobs    │  │  (scheduled fetches) │  │
│  │  - /api/fetch   │  │                      │  │
│  │  - /api/stats   │  │                      │  │
│  └────────┬────────┘  └──────────┬───────────┘  │
│           │                      │              │
│           ▼                      ▼              │
│  ┌─────────────────────────────────────────┐    │
│  │            SQLite (jobs.db)             │    │
│  │  - Stores all jobs with timestamps      │    │
│  │  - Tracks status (new/applied/ignored)  │    │
│  │  - Deduplication via primary key        │    │
│  └─────────────────────────────────────────┘    │
│           │                                     │
│           ▼                                     │
│  ┌─────────────────────────────────────────┐    │
│  │         ntfy.sh (push notifications)    │    │
│  │  - Sends alert when new jobs found      │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### Key Modules

| Module | Purpose |
|--------|---------|
| `server.mjs` | Express server + cron scheduler |
| `lib/db/index.js` | SQLite database operations |
| `lib/jobs/searchJobs.js` | LinkedIn API search orchestration |
| `lib/jobs/buildQuery.js` | Constructs Voyager API URLs |
| `lib/jobs/normalize.js` | Extracts job data from API response |
| `lib/jobs/fetchJobDetails.js` | Fetch full job description (optional) |
| `lib/notifications/ntfy.js` | Push notifications via ntfy |
| `lib/api/httpClient.js` | Axios client with LinkedIn auth |
| `public/index.html` | Web dashboard (dark industrial UI) |

### Database Schema

```sql
jobs (
  id TEXT PRIMARY KEY,
  title TEXT,
  company TEXT,
  location TEXT,
  url TEXT,
  company_page_url TEXT,
  first_seen_at TEXT,
  last_seen_at TEXT,
  status TEXT DEFAULT 'new',  -- new, applied, ignored
  hidden_at TEXT
)
```

### Environment Variables

```bash
# LinkedIn Auth (required)
LI_AT=<cookie>
JSESSIONID=<cookie>

# Server
PORT=3000
CRON_SCHEDULE="0 9,13,18 * * *"

# Notifications (optional)
NTFY_TOPIC=guyreg-jobs
NTFY_SERVER=https://ntfy.sh
NTFY_CLICK_URL=https://your-domain.com

# Email (optional, for legacy email flow)
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL, TO_EMAIL
```

## Deployment

### Local Development
```bash
npm install
npm run server
# Open http://localhost:3000
```

### Docker
```bash
docker build -t jobfinder:latest .
docker run -p 3000:3000 --env-file .env jobfinder:latest
```

### Kubernetes (k3s)
Manifests in `k8s/` directory:
```bash
kubectl apply -k k8s/
```

### Update Cluster
```bash
docker buildx build --platform linux/amd64 -t guyreg/jobfinder:latest --push .
kubectl rollout restart deployment/jobfinder -n jobfinder
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/jobs` | GET | List visible jobs (with TTL filter) |
| `/api/jobs/all` | GET | List all jobs |
| `/api/jobs/:id/status` | POST | Update job status |
| `/api/fetch` | POST | Trigger manual job fetch |
| `/api/stats` | GET | Dashboard statistics |
| `/api/health` | GET | Health check |
