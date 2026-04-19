# Checkpoint Jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Checkpoint careers tab that scrapes Check Point's Israel jobs page hourly, stores new jobs in a separate SQLite table, sends ntfy notifications for new finds, and displays them in a pink-accented read-only tab with per-job delete.

**Architecture:** Mirror the existing LinkedIn pattern — a dedicated DB module (`lib/db/checkpoint.js`), a dedicated scraper module (`lib/jobs/fetchCheckpointJobs.js`), a second hourly cron in `server.mjs`, and a new Checkpoint tab in the single-page frontend. No changes to existing LinkedIn code.

**Tech Stack:** Node.js ESM, Express, better-sqlite3, node-cron, cheerio (new), vanilla JS frontend

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add `cheerio` dependency |
| `lib/db/checkpoint.js` | Create | All DB ops for `checkpoint_jobs` table |
| `lib/jobs/fetchCheckpointJobs.js` | Create | HTML scraper for Check Point careers site |
| `server.mjs` | Modify | New state, cron, endpoints, init call |
| `public/index.html` | Modify | New tab, cards, header metric, delete logic |

---

## Task 1: Install cheerio

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install cheerio**

```bash
npm install cheerio
```

Expected output: cheerio added to `node_modules` and `package.json` dependencies.

- [ ] **Step 2: Verify install**

```bash
node -e "import('cheerio').then(m => console.log('cheerio ok:', typeof m.load))"
```

Expected: `cheerio ok: function`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add cheerio for checkpoint HTML parsing"
```

---

## Task 2: Create lib/db/checkpoint.js

**Files:**
- Create: `lib/db/checkpoint.js`

- [ ] **Step 1: Create the file**

`lib/db/checkpoint.js`:

```js
import { getDb } from './index.js';

/**
 * Create checkpoint_jobs table if it doesn't exist.
 * Call once at server startup after getDb().
 */
export function initCheckpointTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS checkpoint_jobs (
      id TEXT PRIMARY KEY,
      title TEXT,
      link TEXT,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_checkpoint_first_seen ON checkpoint_jobs(first_seen_at);
  `);
}

/**
 * Upsert checkpoint jobs.
 * New jobs get inserted; existing jobs get last_seen_at updated.
 * @param {Array<{id, title, link}>} jobs
 * @returns {{ newJobs: Array, updatedCount: number }}
 */
export function upsertCheckpointJobs(jobs) {
  const db = getDb();
  const now = new Date().toISOString();

  const insertStmt = db.prepare(`
    INSERT INTO checkpoint_jobs (id, title, link, first_seen_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      last_seen_at = excluded.last_seen_at,
      title = excluded.title,
      link = excluded.link
  `);

  const existsStmt = db.prepare(`SELECT id FROM checkpoint_jobs WHERE id = ?`);

  const newJobs = [];
  let updatedCount = 0;

  const upsertMany = db.transaction((jobList) => {
    for (const job of jobList) {
      if (!job.id) continue;
      const exists = existsStmt.get(job.id);
      insertStmt.run(job.id, job.title, job.link, now, now);
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

/**
 * Return all checkpoint jobs, newest first.
 * @returns {Array}
 */
export function getCheckpointJobs() {
  const db = getDb();
  return db.prepare(`SELECT * FROM checkpoint_jobs ORDER BY first_seen_at DESC`).all();
}

/**
 * Hard delete a checkpoint job by id.
 * @param {string} id
 */
export function deleteCheckpointJob(id) {
  const db = getDb();
  return db.prepare(`DELETE FROM checkpoint_jobs WHERE id = ?`).run(id);
}
```

- [ ] **Step 2: Quick smoke test in Node**

```bash
node --input-type=module <<'EOF'
import { getDb } from './lib/db/index.js';
import { initCheckpointTable, upsertCheckpointJobs, getCheckpointJobs, deleteCheckpointJob } from './lib/db/checkpoint.js';

getDb();
initCheckpointTable();

const { newJobs } = upsertCheckpointJobs([
  { id: 'test-1', title: 'Test Job', link: 'https://example.com' }
]);
console.log('newJobs:', newJobs.length); // 1

const all = getCheckpointJobs();
console.log('total:', all.length); // 1

deleteCheckpointJob('test-1');
console.log('after delete:', getCheckpointJobs().length); // 0
console.log('DB OK');
EOF
```

Expected output:
```
newJobs: 1
total: 1
after delete: 0
DB OK
```

- [ ] **Step 3: Commit**

```bash
git add lib/db/checkpoint.js
git commit -m "feat: add checkpoint_jobs DB module"
```

---

## Task 3: Create lib/jobs/fetchCheckpointJobs.js

**Files:**
- Create: `lib/jobs/fetchCheckpointJobs.js`

- [ ] **Step 1: Create the file**

`lib/jobs/fetchCheckpointJobs.js`:

```js
import * as cheerio from 'cheerio';

const BASE_URL =
  'https://careers.checkpoint.com/index.php?q=&module=cpcareers&a=search' +
  '&fa%5B%5D=country_ss:Israel&sort=date_published_display_s+desc';

/**
 * Scrape all Israel jobs from Check Point's careers site.
 * Paginates with &start=N (step 10) until a page returns no .save-job-btn elements.
 * @returns {{ jobs: Array<{id: string, title: string, link: string}> }}
 */
export async function fetchCheckpointJobs() {
  const allJobs = [];
  let start = 0;

  while (true) {
    const url = start === 0 ? BASE_URL : `${BASE_URL}&start=${start}`;
    console.log(`[checkpoint] Fetching page start=${start}`);

    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} fetching checkpoint page start=${start}`);
    }

    const html = await resp.text();
    const $ = cheerio.load(html);
    const buttons = $('.save-job-btn');

    if (buttons.length === 0) break;

    buttons.each((_, btn) => {
      const $btn = $(btn);
      const id = $btn.attr('data-id');
      const title = $btn.attr('data-title');
      const link = $btn.attr('data-link');
      if (id) allJobs.push({ id, title: title || '', link: link || '' });
    });

    start += 10;
  }

  console.log(`[checkpoint] Total jobs fetched: ${allJobs.length}`);
  return { jobs: allJobs };
}
```

- [ ] **Step 2: Smoke test the scraper**

```bash
node --input-type=module <<'EOF'
import { fetchCheckpointJobs } from './lib/jobs/fetchCheckpointJobs.js';
const { jobs } = await fetchCheckpointJobs();
console.log('Total jobs:', jobs.length);
console.log('First job:', jobs[0]);
EOF
```

Expected: total jobs > 0, first job has `id`, `title`, `link` fields populated.

- [ ] **Step 3: Commit**

```bash
git add lib/jobs/fetchCheckpointJobs.js
git commit -m "feat: add checkpoint careers scraper using cheerio"
```

---

## Task 4: Update server.mjs

**Files:**
- Modify: `server.mjs`

- [ ] **Step 1: Add imports after the existing import block (after line 17 `import { DEFAULT_QUERY_PARAMS }`)**

Add these two lines:

```js
import { initCheckpointTable, upsertCheckpointJobs, getCheckpointJobs, deleteCheckpointJob } from './lib/db/checkpoint.js';
import { fetchCheckpointJobs } from './lib/jobs/fetchCheckpointJobs.js';
```

- [ ] **Step 2: Add checkpoint fetch state after the existing `let lastFetch` / `let isFetching` lines (after line 31)**

```js
let lastCheckpointFetch = { time: null, status: null, jobsFound: 0, newJobs: 0 };
let isCheckpointFetching = false;
```

- [ ] **Step 3: Add the checkpoint fetch function after the closing `}` of the existing `fetchJobs()` function (after line 85)**

```js
// ─────────────────────────────────────────────────────────────
// Checkpoint fetch logic
// ─────────────────────────────────────────────────────────────
async function runCheckpointFetch() {
  if (isCheckpointFetching) {
    console.log('[checkpoint] Already fetching, skipping...');
    return;
  }

  isCheckpointFetching = true;
  console.log(`[checkpoint] Starting fetch at ${new Date().toISOString()}`);

  try {
    const { jobs } = await fetchCheckpointJobs();
    const { newJobs, updatedCount } = upsertCheckpointJobs(jobs);

    lastCheckpointFetch = {
      time: new Date().toISOString(),
      status: 'success',
      jobsFound: jobs.length,
      newJobs: newJobs.length,
      updated: updatedCount,
    };

    console.log(`[checkpoint] Complete: ${jobs.length} found, ${newJobs.length} new`);

    if (newJobs.length > 0 && NTFY_TOPIC) {
      try {
        await notifyNewJobs(newJobs, {
          topic: NTFY_TOPIC,
          server: NTFY_SERVER,
          clickUrl: NTFY_CLICK_URL,
        });
      } catch (ntfyErr) {
        console.error('[checkpoint][ntfy] Failed:', ntfyErr.message);
      }
    }
  } catch (err) {
    lastCheckpointFetch = {
      time: new Date().toISOString(),
      status: 'error',
      error: err.message,
    };
    console.error('[checkpoint] Error:', err.message);
  } finally {
    isCheckpointFetching = false;
  }
}
```

- [ ] **Step 4: Add the hourly checkpoint cron after the existing `cron.schedule(CRON_SCHEDULE, ...)` block (after line 93)**

```js
cron.schedule('0 * * * *', () => {
  console.log(`[checkpoint-cron] Triggered at ${new Date().toISOString()}`);
  runCheckpointFetch();
});

console.log('[cron] Checkpoint scheduled: every hour');
```

- [ ] **Step 5: Add checkpoint API endpoints — add before the catch-all route (`app.get('/{*splat}', ...)`, line 145)**

```js
// Get all checkpoint jobs
app.get('/api/checkpoint/jobs', (req, res) => {
  const jobs = getCheckpointJobs();
  res.json({ jobs, count: jobs.length });
});

// Delete a checkpoint job (hard delete)
app.delete('/api/checkpoint/jobs/:id', (req, res) => {
  deleteCheckpointJob(req.params.id);
  res.json({ success: true });
});
```

- [ ] **Step 6: Update the stats endpoint to include lastCheckpointFetch**

Find the existing stats route:
```js
app.get('/api/stats', (req, res) => {
  const stats = getStats();
  res.json({ ...stats, lastFetch, isFetching });
});
```

Replace with:
```js
app.get('/api/stats', (req, res) => {
  const stats = getStats();
  res.json({ ...stats, lastFetch, isFetching, lastCheckpointFetch });
});
```

- [ ] **Step 7: Call initCheckpointTable() at startup — inside the app.listen callback, after getDb()**

Find:
```js
app.listen(PORT, () => {
  // Initialize DB
  getDb();
```

Replace with:
```js
app.listen(PORT, () => {
  // Initialize DB
  getDb();
  initCheckpointTable();
```

- [ ] **Step 8: Start server and verify**

```bash
npm run server
```

Expected console output includes:
```
[cron] Checkpoint scheduled: every hour
[server] Running on http://localhost:3000
```

Then in a second terminal:
```bash
curl http://localhost:3000/api/checkpoint/jobs
```

Expected: `{"jobs":[],"count":0}`

```bash
curl http://localhost:3000/api/stats | grep lastCheckpointFetch
```

Expected: `lastCheckpointFetch` key present in the JSON.

- [ ] **Step 9: Commit**

```bash
git add server.mjs
git commit -m "feat: add checkpoint cron, fetch function, and API endpoints"
```

---

## Task 5: Update public/index.html — CSS and HTML

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Add --cp-pink CSS variable — inside `:root { }` after `--font-mono` line**

Find:
```css
    --font-mono: 'JetBrains Mono', monospace;
  }
```

Replace with:
```css
    --font-mono: 'JetBrains Mono', monospace;
    --cp-pink: #f472b6;
  }
```

- [ ] **Step 2: Add Checkpoint tab and card CSS — after the `.filter-btn.active .tab-count` rule block (after line ~232)**

Find:
```css
    .filter-btn.active .tab-count {
      color: var(--bg-primary);
    }
```

Replace with:
```css
    .filter-btn.active .tab-count {
      color: var(--bg-primary);
    }

    .filter-btn[data-filter="checkpoint"] {
      border-color: var(--cp-pink);
      color: var(--cp-pink);
    }

    .filter-btn[data-filter="checkpoint"]:hover {
      background: rgba(244, 114, 182, 0.1);
      color: var(--cp-pink);
    }

    .filter-btn[data-filter="checkpoint"].active {
      background: var(--cp-pink);
      color: var(--bg-primary);
      border-color: var(--cp-pink);
    }

    .filter-btn[data-filter="checkpoint"].active .tab-count {
      color: var(--bg-primary);
    }

    .job-card.checkpoint-card {
      border-left: 3px solid var(--cp-pink);
    }

    .job-action.checkpoint-delete:hover {
      color: var(--cp-pink);
      border-color: var(--cp-pink);
    }
```

- [ ] **Step 3: Add "Last Fetched CP" header stat — after the existing "Last Fetch" stat block**

Find:
```html
        <div class="stat">
          <span class="stat-label">Last Fetch</span>
          <span class="stat-value" id="stat-last-fetch">--</span>
        </div>
```

Replace with:
```html
        <div class="stat">
          <span class="stat-label">Last Fetch</span>
          <span class="stat-value" id="stat-last-fetch">--</span>
        </div>
        <div class="stat">
          <span class="stat-label">Last Fetched CP</span>
          <span class="stat-value" id="stat-last-fetch-cp">--</span>
        </div>
```

- [ ] **Step 4: Add Checkpoint filter button — after the "All" filter button**

Find:
```html
      <button class="filter-btn" data-filter="all">All <span class="tab-count"></span></button>
```

Replace with:
```html
      <button class="filter-btn" data-filter="all">All <span class="tab-count"></span></button>
      <button class="filter-btn" data-filter="checkpoint">Checkpoint <span class="tab-count"></span></button>
```

- [ ] **Step 5: Commit HTML/CSS structure**

```bash
git add public/index.html
git commit -m "feat: add checkpoint tab HTML structure and pink CSS"
```

---

## Task 6: Update public/index.html — JavaScript

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Add checkpoint API methods — inside the `API` object, after the `fetchJobs` method**

Find:
```js
      async fetchJobs() {
        const res = await fetch('/api/fetch', { method: 'POST' });
        return res.json();
      }
    };
```

Replace with:
```js
      async fetchJobs() {
        const res = await fetch('/api/fetch', { method: 'POST' });
        return res.json();
      },
      async getCheckpointJobs() {
        const res = await fetch('/api/checkpoint/jobs');
        return res.json();
      },
      async deleteCheckpointJob(id) {
        const res = await fetch(`/api/checkpoint/jobs/${id}`, { method: 'DELETE' });
        return res.json();
      }
    };
```

- [ ] **Step 2: Add checkpointJobs array — after the existing `let searchQuery = '';` line**

Find:
```js
    let searchQuery = '';
```

Replace with:
```js
    let searchQuery = '';
    let checkpointJobs = [];
```

- [ ] **Step 3: Add renderCheckpointJob function — after the closing `}` of the existing `renderJob` function**

Find:
```js
    function escapeHtml(str) {
```

Replace with:
```js
    function renderCheckpointJob(job) {
      return `
        <article class="job-card checkpoint-card" data-id="${job.id}">
          <h3 class="job-title">
            <a href="${escapeHtml(job.link)}" target="_blank" rel="noopener">${escapeHtml(job.title)}</a>
          </h3>
          <div class="job-meta">
            <span class="job-time">${formatTime(job.first_seen_at)}</span>
            <div class="job-actions">
              <button class="job-action checkpoint-delete" data-action="delete">Delete</button>
            </div>
          </div>
        </article>
      `;
    }

    function escapeHtml(str) {
```

- [ ] **Step 4: Update getFilteredJobs() to handle the checkpoint tab**

Find:
```js
    function getFilteredJobs() {
      let filtered = currentFilter === 'all'
        ? jobs
        : jobs.filter(j => j.status === currentFilter);
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(j =>
          (j.title || '').toLowerCase().includes(q) ||
          (j.company || '').toLowerCase().includes(q)
        );
      }
      return filtered;
    }
```

Replace with:
```js
    function getFilteredJobs() {
      if (currentFilter === 'checkpoint') {
        if (!searchQuery) return checkpointJobs;
        const q = searchQuery.toLowerCase();
        return checkpointJobs.filter(j => (j.title || '').toLowerCase().includes(q));
      }
      let filtered = currentFilter === 'all'
        ? jobs
        : jobs.filter(j => j.status === currentFilter);
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(j =>
          (j.title || '').toLowerCase().includes(q) ||
          (j.company || '').toLowerCase().includes(q)
        );
      }
      return filtered;
    }
```

- [ ] **Step 5: Update renderJobs() to use the checkpoint card template on the checkpoint tab**

Find:
```js
        grid.innerHTML = filtered.map(renderJob).join('');
```

Replace with:
```js
        const renderFn = currentFilter === 'checkpoint' ? renderCheckpointJob : renderJob;
        grid.innerHTML = filtered.map(renderFn).join('');
```

- [ ] **Step 6: Update updateCountBadges() to include checkpoint count**

Find:
```js
    function updateCountBadges() {
      document.querySelectorAll('.filter-btn').forEach(btn => {
        const filter = btn.dataset.filter;
        const count = filter === 'all'
          ? jobs.length
          : jobs.filter(j => j.status === filter).length;
        const badge = btn.querySelector('.tab-count');
        if (badge) badge.textContent = count > 0 ? `[${count}]` : '';
      });
    }
```

Replace with:
```js
    function updateCountBadges() {
      document.querySelectorAll('.filter-btn').forEach(btn => {
        const filter = btn.dataset.filter;
        let count;
        if (filter === 'checkpoint') {
          count = checkpointJobs.length;
        } else if (filter === 'all') {
          count = jobs.length;
        } else {
          count = jobs.filter(j => j.status === filter).length;
        }
        const badge = btn.querySelector('.tab-count');
        if (badge) badge.textContent = count > 0 ? `[${count}]` : '';
      });
    }
```

- [ ] **Step 7: Update renderStats() to populate the CP metric**

Find:
```js
      document.getElementById('stat-last-fetch').textContent = formatTime(stats.lastFetch?.time);
    }
```

Replace with:
```js
      document.getElementById('stat-last-fetch').textContent = formatTime(stats.lastFetch?.time);
      document.getElementById('stat-last-fetch-cp').textContent = formatTime(stats.lastCheckpointFetch?.time);
    }
```

- [ ] **Step 8: Update loadData() to also fetch checkpoint jobs**

Find:
```js
    async function loadData() {
      try {
        const [jobsData, statsData] = await Promise.all([
          API.getAllJobs(),
          API.getStats()
        ]);
        jobs = jobsData.jobs;
        renderJobs();
        renderStats(statsData);
      } catch (err) {
        showToast('Failed to load data', 'error');
      }
    }
```

Replace with:
```js
    async function loadData() {
      try {
        const [jobsData, statsData, checkpointData] = await Promise.all([
          API.getAllJobs(),
          API.getStats(),
          API.getCheckpointJobs()
        ]);
        jobs = jobsData.jobs;
        checkpointJobs = checkpointData.jobs;
        renderJobs();
        renderStats(statsData);
      } catch (err) {
        showToast('Failed to load data', 'error');
      }
    }
```

- [ ] **Step 9: Add handleCheckpointDelete function — after the closing `}` of handleFetch**

Find:
```js
    async function handleStatusChange(jobId, newStatus) {
```

Replace with:
```js
    async function handleCheckpointDelete(jobId) {
      try {
        await API.deleteCheckpointJob(jobId);
        checkpointJobs = checkpointJobs.filter(j => j.id !== jobId);

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

        updateCountBadges();
        showToast('Job deleted', 'success');
      } catch (err) {
        showToast('Failed to delete job', 'error');
      }
    }

    async function handleStatusChange(jobId, newStatus) {
```

- [ ] **Step 10: Update the grid click handler to intercept checkpoint delete clicks**

Find:
```js
      // Job action buttons (delegated)
      document.getElementById('jobs-grid').addEventListener('click', e => {
        const actionBtn = e.target.closest('.job-action');
        if (!actionBtn) return;

        const card = actionBtn.closest('.job-card');
        const jobId = card.dataset.id;
        const action = actionBtn.dataset.action;

        handleStatusChange(jobId, action);
      });
```

Replace with:
```js
      // Job action buttons (delegated)
      document.getElementById('jobs-grid').addEventListener('click', e => {
        const deleteBtn = e.target.closest('.checkpoint-delete');
        if (deleteBtn) {
          const card = deleteBtn.closest('.job-card');
          handleCheckpointDelete(card.dataset.id);
          return;
        }

        const actionBtn = e.target.closest('.job-action');
        if (!actionBtn) return;

        const card = actionBtn.closest('.job-card');
        const jobId = card.dataset.id;
        const action = actionBtn.dataset.action;

        handleStatusChange(jobId, action);
      });
```

- [ ] **Step 11: Verify in browser**

Start the server:
```bash
npm run server
```

Open `http://localhost:3000` and verify:
1. Header shows "Last Fetched CP" metric (shows `--` since cron hasn't run yet)
2. A pink-bordered "Checkpoint" tab appears after "All"
3. Clicking "Checkpoint" shows empty state (no jobs yet)
4. Run a manual test fetch in a second terminal:

```bash
node --input-type=module <<'EOF'
import { fetchCheckpointJobs } from './lib/jobs/fetchCheckpointJobs.js';
import { getDb } from './lib/db/index.js';
import { initCheckpointTable, upsertCheckpointJobs } from './lib/db/checkpoint.js';
getDb();
initCheckpointTable();
const { jobs } = await fetchCheckpointJobs();
const { newJobs } = upsertCheckpointJobs(jobs);
console.log(`Inserted ${newJobs.length} new jobs`);
EOF
```

5. Refresh the browser — Checkpoint tab should show jobs with pink left borders
6. Click Delete on a job — it should animate out and disappear
7. "Last Fetched CP" in header still shows `--` (it only updates via cron/server-side fetch); that's expected

- [ ] **Step 12: Commit**

```bash
git add public/index.html
git commit -m "feat: add checkpoint tab UI with pink design and delete action"
```
