# Shahak Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated job dashboard at `/shahak` that runs a separate LinkedIn search (same credentials), stores results in its own table, and serves a simplified green-accented UI with delete-only job cards.

**Architecture:** New `lib/db/shahak.js` module mirrors the checkpoint DB pattern. `server.mjs` gets a new fetch function, 8AM cron, two API routes, and a static route for `/shahak`. `public/shahak.html` is a self-contained page sharing the dark aesthetic but with a green accent and no status tracking.

**Tech Stack:** better-sqlite3, Express, node-cron, vanilla JS frontend, ntfy.sh notifications

---

### Task 1: Add `SHAHAK_QUERY_PARAMS` to config

**Files:**
- Modify: `config.js`

- [ ] **Step 1: Add Shahak's query params**

Open `config.js` and add after `DEFAULT_QUERY_PARAMS`:

```js
export const SHAHAK_QUERY_PARAMS = {
  keywords: ["product manager", "project manager", "program manager"],
  experience: ["3", "4"], // Associate, Mid-Senior
  timePostedRange: ["r86400"], // Last 24 hours
  count: 100,
  start: 0,
};
```

> **Configure these values** based on what Shahak is actually looking for before deploying.

- [ ] **Step 2: Commit**

```bash
git add config.js
git commit -m "feat: add SHAHAK_QUERY_PARAMS to config"
```

---

### Task 2: Create Shahak DB module

**Files:**
- Create: `lib/db/shahak.js`

- [ ] **Step 1: Write the module**

```js
import { getDb } from './index.js';

export function initShahakTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS shahak_jobs (
      id TEXT PRIMARY KEY,
      title TEXT,
      company TEXT,
      location TEXT,
      url TEXT,
      company_page_url TEXT,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      hidden_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_shahak_first_seen ON shahak_jobs(first_seen_at);
  `);
}

export function upsertShahakJobs(jobs) {
  const db = getDb();
  const now = new Date().toISOString();

  // hidden_at excluded from ON CONFLICT update — preserves user's deletes
  const insertStmt = db.prepare(`
    INSERT INTO shahak_jobs (id, title, company, location, url, company_page_url, first_seen_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      last_seen_at = excluded.last_seen_at,
      title = excluded.title,
      company = excluded.company,
      location = excluded.location,
      url = excluded.url,
      company_page_url = excluded.company_page_url
  `);

  const existsStmt = db.prepare(`SELECT id FROM shahak_jobs WHERE id = ?`);

  const newJobs = [];
  let updatedCount = 0;

  const upsertMany = db.transaction((jobList) => {
    for (const job of jobList) {
      if (!job.id) continue;
      const exists = existsStmt.get(job.id);
      insertStmt.run(job.id, job.title, job.company, job.location, job.url, job.companyPageUrl, now, now);
      if (exists) {
        updatedCount++;
      } else {
        newJobs.push(job);
      }
    }
  });

  upsertMany(jobs);
  return { newJobs, updatedCount };
}

export function getShahakJobs() {
  const db = getDb();
  return db.prepare(`SELECT * FROM shahak_jobs WHERE hidden_at IS NULL ORDER BY first_seen_at DESC`).all();
}

export function deleteShahakJob(id) {
  const db = getDb();
  return db.prepare(`UPDATE shahak_jobs SET hidden_at = ? WHERE id = ?`).run(new Date().toISOString(), id);
}
```

- [ ] **Step 2: Verify it imports cleanly**

```bash
node --input-type=module <<'EOF'
import { initShahakTable, upsertShahakJobs, getShahakJobs, deleteShahakJob } from './lib/db/shahak.js';
console.log('OK');
EOF
```

Expected output: `OK`

- [ ] **Step 3: Commit**

```bash
git add lib/db/shahak.js
git commit -m "feat: add Shahak DB module (shahak_jobs table)"
```

---

### Task 3: Wire up `server.mjs`

**Files:**
- Modify: `server.mjs`

- [ ] **Step 1: Add imports at the top of `server.mjs`**

Add after the existing checkpoint import line (line 18):

```js
import { initShahakTable, upsertShahakJobs, getShahakJobs, deleteShahakJob } from './lib/db/shahak.js';
import { SHAHAK_QUERY_PARAMS } from './config.js';
```

- [ ] **Step 2: Add fetch state variables**

Add after the existing `isCheckpointFetching` line (line 36):

```js
let lastShahakFetch = { time: null, status: null, jobsFound: 0, newJobs: 0 };
let isShahakFetching = false;
```

- [ ] **Step 3: Add `runShahakFetch()` function**

Add after the `runCheckpointFetch()` function (after line 140):

```js
// ─────────────────────────────────────────────────────────────
// Shahak fetch logic
// ─────────────────────────────────────────────────────────────
async function runShahakFetch() {
  if (isShahakFetching) {
    console.log('[shahak] Already fetching, skipping...');
    return;
  }

  isShahakFetching = true;
  console.log(`[shahak] Starting fetch at ${new Date().toISOString()}`);

  try {
    const { jobs } = await searchJobs(SHAHAK_QUERY_PARAMS);
    const { newJobs, updatedCount } = upsertShahakJobs(jobs);

    lastShahakFetch = {
      time: new Date().toISOString(),
      status: 'success',
      jobsFound: jobs.length,
      newJobs: newJobs.length,
      updated: updatedCount,
    };

    console.log(`[shahak] Complete: ${jobs.length} found, ${newJobs.length} new`);

    if (newJobs.length > 0 && NTFY_TOPIC) {
      try {
        await notifyNewJobs(newJobs, {
          topic: NTFY_TOPIC,
          server: NTFY_SERVER,
          clickUrl: NTFY_CLICK_URL,
          label: 'Shahak Job',
          tags: ['person'],
        });
      } catch (ntfyErr) {
        console.error('[shahak][ntfy] Failed:', ntfyErr.message);
      }
    }
  } catch (err) {
    lastShahakFetch = { time: new Date().toISOString(), status: 'error', error: err.message };
    console.error('[shahak] Error:', err.message);
  } finally {
    isShahakFetching = false;
  }
}
```

- [ ] **Step 4: Add Shahak cron**

Add after the checkpoint cron log line (`console.log('[cron] Checkpoint scheduled: every hour')`):

```js
cron.schedule('0 8 * * *', () => {
  console.log(`[shahak-cron] Triggered at ${new Date().toISOString()}`);
  runShahakFetch();
});

console.log('[cron] Shahak scheduled: 8AM daily');
```

- [ ] **Step 5: Add API routes**

Add after the checkpoint delete route (after line 205) and **before** the stats route:

```js
// Get Shahak's jobs
app.get('/api/shahak/jobs', (req, res) => {
  const jobs = getShahakJobs();
  res.json({ jobs, count: jobs.length });
});

// Soft-delete a Shahak job
app.delete('/api/shahak/jobs/:id', (req, res) => {
  deleteShahakJob(req.params.id);
  res.json({ success: true });
});
```

- [ ] **Step 6: Add `/shahak` static route**

Add **before** the existing catch-all route (`app.get("/{*splat}", ...)`):

```js
app.get('/shahak', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'shahak.html'));
});
```

- [ ] **Step 7: Initialize Shahak table at startup**

In the `app.listen` callback, add after `initCheckpointTable()`:

```js
initShahakTable();
```

- [ ] **Step 8: Start the server and verify routes**

```bash
npm run server
```

In another terminal:

```bash
# Should return { jobs: [], count: 0 }
curl -s http://localhost:3000/api/shahak/jobs | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d)))"

# Should return shahak.html (404 means the route is missing or order is wrong)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/shahak
# Expected: 200
```

- [ ] **Step 9: Commit**

```bash
git add server.mjs
git commit -m "feat: wire Shahak fetch, cron, and API routes in server"
```

---

### Task 4: Create `public/shahak.html`

**Files:**
- Create: `public/shahak.html`

- [ ] **Step 1: Write the page**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shahak's Jobs</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Syne:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0a0a0a;
      --bg-secondary: #141414;
      --bg-card: #1a1a1a;
      --bg-card-hover: #222222;
      --border: #2a2a2a;
      --text-primary: #fafafa;
      --text-secondary: #888888;
      --text-muted: #555555;
      --accent: #4ade80;
      --accent-dim: #22c55e;
      --font-display: 'Syne', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: var(--font-mono);
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      line-height: 1.5;
    }

    body::before {
      content: '';
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      opacity: 0.03;
      pointer-events: none;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    }

    .header {
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border);
      padding: 1.5rem 2rem;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .header-content {
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 2rem;
    }

    .logo {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .logo-icon {
      width: 32px;
      height: 32px;
      background: var(--accent);
      color: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      font-weight: 700;
    }

    .btn {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      font-weight: 500;
      padding: 0.6rem 1rem;
      border: 1px solid var(--border);
      background: var(--bg-card);
      color: var(--text-primary);
      cursor: pointer;
      transition: all 0.15s ease;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .btn:hover { background: var(--bg-card-hover); border-color: var(--text-muted); }
    .btn:active { transform: scale(0.98); }

    .main {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    .search-bar { margin-bottom: 1.5rem; }

    .search-input {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      width: 100%;
      max-width: 400px;
      padding: 0.55rem 1rem;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      color: var(--text-primary);
      outline: none;
      transition: border-color 0.15s ease;
    }

    .search-input:focus { border-color: var(--text-muted); }
    .search-input::placeholder { color: var(--text-muted); }

    .jobs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 1rem;
    }

    .job-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-left: 3px solid var(--accent);
      padding: 1.25rem;
      transition: all 0.2s ease;
      opacity: 0;
      animation: fadeSlideIn 0.4s ease forwards;
      position: relative;
    }

    .job-card:hover { background: var(--bg-card-hover); border-color: var(--accent); transform: translateY(-2px); }

    .job-card.focused { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }

    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes fadeSlideOut {
      from { opacity: 1; transform: translateY(0) scale(1); max-height: 300px; margin-bottom: 0; }
      to { opacity: 0; transform: translateY(-8px) scale(0.97); max-height: 0; margin-bottom: -1rem; }
    }

    .job-card.removing {
      animation: fadeSlideOut 0.25s ease forwards;
      pointer-events: none;
      overflow: hidden;
    }

    .job-card:nth-child(1) { animation-delay: 0.02s; }
    .job-card:nth-child(2) { animation-delay: 0.04s; }
    .job-card:nth-child(3) { animation-delay: 0.06s; }
    .job-card:nth-child(4) { animation-delay: 0.08s; }
    .job-card:nth-child(5) { animation-delay: 0.10s; }
    .job-card:nth-child(6) { animation-delay: 0.12s; }
    .job-card:nth-child(7) { animation-delay: 0.14s; }
    .job-card:nth-child(8) { animation-delay: 0.16s; }
    .job-card:nth-child(9) { animation-delay: 0.18s; }
    .job-card:nth-child(10) { animation-delay: 0.20s; }

    .job-title {
      font-family: var(--font-display);
      font-size: 1rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      line-height: 1.3;
    }

    .job-title a { color: var(--text-primary); text-decoration: none; transition: color 0.15s ease; }
    .job-title a:hover { color: var(--accent); }

    .job-company { font-size: 0.8rem; margin-bottom: 0.25rem; }
    .job-company a { color: var(--text-secondary); text-decoration: none; transition: color 0.15s ease; }
    .job-company a:hover { color: var(--accent); }

    .job-location { font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1rem; }

    .job-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border);
    }

    .job-time { font-size: 0.65rem; color: var(--text-muted); }

    .job-actions { display: flex; gap: 0.5rem; }

    .job-action {
      font-size: 0.65rem;
      padding: 0.3rem 0.5rem;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .job-action:hover { color: var(--accent); border-color: var(--accent); }

    .empty-state { text-align: center; padding: 4rem 2rem; color: var(--text-muted); }
    .empty-state-icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.3; }

    .toast-container {
      position: fixed;
      bottom: 2rem; right: 2rem;
      display: flex; flex-direction: column; gap: 0.5rem;
      z-index: 1000;
    }

    .toast {
      background: var(--bg-card);
      border: 1px solid var(--border);
      padding: 0.75rem 1rem;
      font-size: 0.75rem;
      animation: slideIn 0.3s ease;
    }

    .toast.success { border-color: var(--accent); }
    .toast.error { border-color: #ef4444; }

    @keyframes slideIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .keyboard-hint {
      position: fixed;
      bottom: 1rem; left: 50%;
      transform: translateX(-50%);
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      padding: 0.35rem 1rem;
      font-size: 0.6rem;
      color: var(--text-muted);
      letter-spacing: 0.06em;
      pointer-events: none;
      z-index: 50;
      white-space: nowrap;
    }

    @media (max-width: 768px) {
      .header-content { flex-direction: column; align-items: flex-start; }
      .jobs-grid { grid-template-columns: 1fr; }
      .main { padding: 1rem; }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-content">
      <div class="logo">
        <div class="logo-icon">SJ</div>
        Shahak's Jobs
      </div>
      <div class="header-actions">
        <button class="btn" id="btn-refresh">Refresh</button>
      </div>
    </div>
  </header>

  <main class="main">
    <div class="search-bar">
      <input
        type="text"
        id="search-input"
        class="search-input"
        placeholder="/ to search by title or company"
        autocomplete="off"
      >
    </div>

    <div class="jobs-grid" id="jobs-grid"></div>

    <div class="empty-state" id="empty-state" style="display: none;">
      <div class="empty-state-icon">◇</div>
      <p>No jobs found</p>
    </div>
  </main>

  <div class="toast-container" id="toast-container"></div>
  <div class="keyboard-hint">j/k navigate · d delete · Enter open · / search</div>

  <script>
    const API = {
      async getJobs() {
        const res = await fetch('/api/shahak/jobs');
        return res.json();
      },
      async deleteJob(id) {
        const res = await fetch(`/api/shahak/jobs/${id}`, { method: 'DELETE' });
        return res.json();
      }
    };

    let jobs = [];
    let focusedIndex = 0;
    let searchQuery = '';

    function formatTime(isoString) {
      if (!isoString) return '--';
      const date = new Date(isoString);
      const diffMs = Date.now() - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    }

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
      ));
    }

    function renderJob(job) {
      return `
        <article class="job-card" data-id="${job.id}">
          <h3 class="job-title">
            <a href="${escapeHtml(job.url)}" target="_blank" rel="noopener">${escapeHtml(job.title)}</a>
          </h3>
          <div class="job-company">
            <a href="${escapeHtml(job.company_page_url || '#')}" target="_blank" rel="noopener">${escapeHtml(job.company)}</a>
          </div>
          <div class="job-location">${escapeHtml(job.location)}</div>
          <div class="job-meta">
            <span class="job-time">${formatTime(job.first_seen_at)}</span>
            <div class="job-actions">
              <button class="job-action shahak-delete">Delete</button>
            </div>
          </div>
        </article>
      `;
    }

    function getFilteredJobs() {
      if (!searchQuery) return jobs;
      const q = searchQuery.toLowerCase();
      return jobs.filter(j =>
        (j.title || '').toLowerCase().includes(q) ||
        (j.company || '').toLowerCase().includes(q)
      );
    }

    function renderJobs() {
      const grid = document.getElementById('jobs-grid');
      const empty = document.getElementById('empty-state');
      const filtered = getFilteredJobs();
      if (filtered.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'block';
      } else {
        empty.style.display = 'none';
        grid.innerHTML = filtered.map(renderJob).join('');
        const cards = grid.querySelectorAll('.job-card');
        const clamped = Math.min(focusedIndex, cards.length - 1);
        focusedIndex = clamped;
        if (cards[clamped]) cards[clamped].classList.add('focused');
      }
    }

    function showToast(message, type = 'info') {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }

    async function loadData() {
      try {
        const data = await API.getJobs();
        jobs = data.jobs;
        renderJobs();
      } catch {
        showToast('Failed to load data', 'error');
      }
    }

    async function handleDelete(jobId) {
      try {
        await API.deleteJob(jobId);
        jobs = jobs.filter(j => j.id !== jobId);
        const card = document.querySelector(`.job-card[data-id="${jobId}"]`);
        if (card) {
          card.classList.add('removing');
          await new Promise(r => setTimeout(r, 250));
          card.remove();
        }
        const grid = document.getElementById('jobs-grid');
        if (grid.querySelectorAll('.job-card').length === 0) {
          document.getElementById('empty-state').style.display = 'block';
        }
        showToast('Job deleted', 'success');
      } catch {
        showToast('Failed to delete job', 'error');
      }
    }

    document.addEventListener('DOMContentLoaded', () => {
      loadData();

      document.getElementById('btn-refresh').addEventListener('click', loadData);

      const searchInput = document.getElementById('search-input');

      searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value.trim();
        focusedIndex = 0;
        renderJobs();
      });

      searchInput.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          searchQuery = '';
          searchInput.value = '';
          searchInput.blur();
          focusedIndex = 0;
          renderJobs();
        }
      });

      document.addEventListener('keydown', e => {
        const searchFocused = document.activeElement === searchInput;
        if (e.key === '/' && !searchFocused) {
          e.preventDefault();
          searchInput.focus();
          return;
        }
        if (searchFocused) return;

        const grid = document.getElementById('jobs-grid');
        const cards = grid.querySelectorAll('.job-card');
        if (cards.length === 0) return;

        if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault();
          focusedIndex = Math.min(focusedIndex + 1, cards.length - 1);
          cards.forEach((c, i) => c.classList.toggle('focused', i === focusedIndex));
          cards[focusedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          return;
        }

        if (e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault();
          focusedIndex = Math.max(focusedIndex - 1, 0);
          cards.forEach((c, i) => c.classList.toggle('focused', i === focusedIndex));
          cards[focusedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          return;
        }

        const focusedCard = cards[focusedIndex];
        if (!focusedCard) return;
        const jobId = focusedCard.dataset.id;

        if (e.key === 'd') {
          e.preventDefault();
          handleDelete(jobId);
          return;
        }

        if (e.key === 'Enter') {
          e.preventDefault();
          const link = focusedCard.querySelector('.job-title a');
          if (link) window.open(link.href, '_blank', 'noopener');
          return;
        }
      });

      document.getElementById('jobs-grid').addEventListener('click', e => {
        const deleteBtn = e.target.closest('.shahak-delete');
        if (!deleteBtn) return;
        const card = deleteBtn.closest('.job-card');
        handleDelete(card.dataset.id);
      });
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify the page loads in a browser**

With the server running, open `http://localhost:3000/shahak` in a browser.

Expected: Green-accented dark page titled "Shahak's Jobs", empty state shown (no jobs yet), Refresh button works without errors.

- [ ] **Step 3: Commit**

```bash
git add public/shahak.html
git commit -m "feat: add Shahak's job dashboard page"
```

---

### Task 5: Configure Shahak's actual search keywords

- [ ] **Step 1: Update `SHAHAK_QUERY_PARAMS` in `config.js`**

Replace the placeholder values with the real keywords and experience levels Shahak is looking for. The `experience` values map to LinkedIn's filter codes:
- `"1"` = Internship
- `"2"` = Entry level
- `"3"` = Associate
- `"4"` = Mid-Senior level
- `"5"` = Director
- `"6"` = Executive

- [ ] **Step 2: Commit**

```bash
git add config.js
git commit -m "feat: configure Shahak's LinkedIn search params"
```

---

### Final verification

- [ ] Restart server: `npm run server`
- [ ] Confirm `GET http://localhost:3000/api/shahak/jobs` returns `{ jobs: [], count: 0 }`
- [ ] Confirm `GET http://localhost:3000/shahak` serves the green-accented page
- [ ] Confirm `GET http://localhost:3000/` still serves the unchanged main dashboard
- [ ] Confirm logs show `[cron] Shahak scheduled: 8AM daily`
