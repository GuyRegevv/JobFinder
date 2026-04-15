# Dashboard UX Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the job review workflow with a New-first default view, count badges, card removal animation, keyboard triage shortcuts, and a search bar.

**Architecture:** All changes are in `public/index.html` (single-file vanilla JS frontend). No backend changes. State is extended with `focusedIndex` and `searchQuery`. Card removal is animated per-card before re-rendering the grid. Keyboard events are handled via a single `document` keydown listener that skips when the search input is focused.

**Tech Stack:** Vanilla JS, CSS animations, existing Express/SQLite backend (untouched)

---

## File Map

| File | Change |
|------|--------|
| `public/index.html` | All changes — HTML, CSS, JS |

---

### Task 1: Reorder tabs and add count badges

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Update tab HTML order and add count badge spans**

In `public/index.html`, replace the filters section (around line 467–471):

```html
<!-- BEFORE -->
<div class="filters">
  <button class="filter-btn active" data-filter="all">All</button>
  <button class="filter-btn" data-filter="new">New</button>
  <button class="filter-btn" data-filter="applied">Applied</button>
  <button class="filter-btn" data-filter="ignored">Ignored</button>
</div>

<!-- AFTER -->
<div class="filters">
  <button class="filter-btn active" data-filter="new">New <span class="tab-count"></span></button>
  <button class="filter-btn" data-filter="applied">Applied <span class="tab-count"></span></button>
  <button class="filter-btn" data-filter="ignored">Ignored <span class="tab-count"></span></button>
  <button class="filter-btn" data-filter="all">All <span class="tab-count"></span></button>
</div>
```

- [ ] **Step 2: Add CSS for the count badge**

Add inside the `<style>` block, after the `.filter-btn.active` rule:

```css
.tab-count {
  color: var(--text-muted);
  font-size: 0.65rem;
}

.filter-btn.active .tab-count {
  color: var(--bg-primary);
}
```

- [ ] **Step 3: Change default JS state and add helper functions**

In the `<script>` block, replace:
```javascript
let currentFilter = 'all';
```
with:
```javascript
let currentFilter = 'new';
let focusedIndex = 0;
let searchQuery = '';
```

Then add these two helper functions right before `renderJobs`:

```javascript
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

- [ ] **Step 4: Update renderJobs to use getFilteredJobs and call updateCountBadges**

Replace the `renderJobs` function:

```javascript
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
  }

  updateCountBadges();
}
```

- [ ] **Step 5: Update the filter button click handler to reset focusedIndex and searchQuery**

Find the filter button event listener and replace it:

```javascript
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    focusedIndex = 0;
    searchQuery = '';
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    renderJobs();
  });
});
```

- [ ] **Step 6: Verify manually**

Run `npm run server`, open `http://localhost:3000`. Confirm:
- "New" tab is active by default
- Tab order is New · Applied · Ignored · All
- Each tab shows a count badge like `[5]`
- Clicking Applied shows only applied jobs, badge counts are correct

- [ ] **Step 7: Commit**

```bash
git add public/index.html
git commit -m "feat: reorder tabs to New-first with live count badges"
```

---

### Task 2: Add focused card and removal animation CSS

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Add CSS for focused card**

Add inside the `<style>` block, after `.job-card:hover`:

```css
.job-card.focused {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}
```

- [ ] **Step 2: Add CSS for card removal animation**

Add inside the `<style>` block, after the `@keyframes fadeSlideIn` block:

```css
@keyframes fadeSlideOut {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
    max-height: 300px;
    margin-bottom: 0;
  }
  to {
    opacity: 0;
    transform: translateY(-8px) scale(0.97);
    max-height: 0;
    margin-bottom: -1rem;
  }
}

.job-card.removing {
  animation: fadeSlideOut 0.25s ease forwards;
  pointer-events: none;
  overflow: hidden;
}
```

- [ ] **Step 3: Update renderJobs to apply focused class**

Replace the `renderJobs` function with one that applies `.focused` after rendering:

```javascript
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
    const clampedIndex = Math.min(focusedIndex, cards.length - 1);
    focusedIndex = clampedIndex;
    if (cards[clampedIndex]) {
      cards[clampedIndex].classList.add('focused');
    }
  }

  updateCountBadges();
}
```

- [ ] **Step 4: Verify manually**

Reload the page. The first job card in the New tab should have an amber border. Clicking a different tab and back should still highlight the first card.

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "feat: add focused card highlight and removal animation CSS"
```

---

### Task 3: Animate card removal and update focus on action

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Replace handleStatusChange with animated version**

Replace the existing `handleStatusChange` function:

```javascript
async function handleStatusChange(jobId, newStatus) {
  const job = jobs.find(j => j.id === jobId);
  if (!job) return;

  const status = job.status === newStatus ? 'new' : newStatus;

  // Determine focused index before removal so we can restore after re-render
  const filteredBefore = getFilteredJobs();
  const removedIdx = filteredBefore.findIndex(j => j.id === jobId);

  // Animate card out if it will leave the current view
  const willLeaveView = status !== currentFilter && currentFilter !== 'all';
  const card = document.querySelector(`.job-card[data-id="${jobId}"]`);
  if (card && willLeaveView) {
    card.classList.add('removing');
    await new Promise(r => setTimeout(r, 250));
  }

  try {
    await API.updateStatus(jobId, status);
    job.status = status;

    // After removal, set focus to same position (now next card) or last
    if (willLeaveView) {
      const filteredAfter = (currentFilter === 'all' ? jobs : jobs.filter(j => j.status === currentFilter))
        .filter(j => {
          if (!searchQuery) return true;
          const q = searchQuery.toLowerCase();
          return (j.title || '').toLowerCase().includes(q) || (j.company || '').toLowerCase().includes(q);
        });
      focusedIndex = Math.min(removedIdx, Math.max(filteredAfter.length - 1, 0));
    }

    renderJobs();
    showToast(`Job marked as ${status}`, 'success');
  } catch (err) {
    showToast('Failed to update status', 'error');
  }
}
```

- [ ] **Step 2: Verify manually**

Open the New tab. Click "Ignore" on a card. The card should animate out (fade + shrink), disappear, and the next card should become focused (amber border). Check the Ignored tab — the card should appear there. The New count badge should decrease by 1 and Ignored count should increase by 1.

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: animate card removal and restore keyboard focus after action"
```

---

### Task 4: Keyboard shortcuts

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Add keyboard hint HTML**

Inside `<body>`, just before `</body>`, add:

```html
<div class="keyboard-hint">j/k navigate · a apply · i ignore · Enter open · / search</div>
```

- [ ] **Step 2: Add CSS for the keyboard hint**

Add inside the `<style>` block, before the `/* Responsive */` section:

```css
.keyboard-hint {
  position: fixed;
  bottom: 1rem;
  left: 50%;
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
```

- [ ] **Step 3: Add the keyboard event listener**

Add this inside the `DOMContentLoaded` block, after the existing event listeners:

```javascript
document.addEventListener('keydown', e => {
  const searchInput = document.getElementById('search-input');
  const searchFocused = document.activeElement === searchInput;

  // / to focus search
  if (e.key === '/' && !searchFocused) {
    e.preventDefault();
    searchInput?.focus();
    return;
  }

  // All other shortcuts are blocked when search is focused
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

  if (e.key === 'a') {
    e.preventDefault();
    handleStatusChange(jobId, 'applied');
    return;
  }

  if (e.key === 'i') {
    e.preventDefault();
    handleStatusChange(jobId, 'ignored');
    return;
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    const link = focusedCard.querySelector('.job-title a');
    if (link) window.open(link.href, '_blank', 'noopener');
    return;
  }
});
```

- [ ] **Step 4: Verify manually**

Reload and go to the New tab. Press `j` — focus should move to the second card. Press `k` — focus moves back to first. Press `i` — card animates out, focus moves to next. Press `a` — card moves to Applied. Press `Enter` — opens job in new tab. Press `/` — search input gets focused, `j`/`k` no longer navigate.

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "feat: add keyboard navigation (j/k/a/i/Enter) with hint bar"
```

---

### Task 5: Search bar

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Add search bar HTML**

Inside `<main class="main">`, add the search bar between the filters div and the jobs-grid div:

```html
<div class="search-bar">
  <input
    type="text"
    id="search-input"
    class="search-input"
    placeholder="/ to search by title or company"
    autocomplete="off"
  >
</div>
```

- [ ] **Step 2: Add CSS for the search bar**

Add inside the `<style>` block, after the `.filters` rule:

```css
.search-bar {
  margin-bottom: 1.5rem;
}

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

.search-input:focus {
  border-color: var(--text-muted);
}

.search-input::placeholder {
  color: var(--text-muted);
}
```

- [ ] **Step 3: Wire up search input events**

Add inside the `DOMContentLoaded` block:

```javascript
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
```

- [ ] **Step 4: Verify manually**

Reload. Type part of a company name in the search box — cards filter in real-time. Press Escape — search clears and all cards return. Press `/` from the grid — search box gets focus. Switch tabs — search resets (already handled by the tab click handler in Task 1 Step 5).

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "feat: add real-time search bar with / shortcut and Escape to clear"
```

---

## Self-Review

**Spec coverage:**
- [x] New tab is default on load — Task 1 Step 3
- [x] Tabs reordered New · Applied · Ignored · All — Task 1 Step 1
- [x] Count badges, live updates — Task 1 Steps 2–4, updated in `renderJobs` via `updateCountBadges`
- [x] Cards disappear immediately when acted on — Task 3
- [x] Focus auto-set to first card on New tab — Task 2 Step 3 (focusedIndex=0 default + renderJobs applies it)
- [x] j/k navigation — Task 4 Step 3
- [x] a/i shortcuts — Task 4 Step 3
- [x] Enter opens link — Task 4 Step 3
- [x] Focus jumps to next card after action — Task 3 Step 1
- [x] / focuses search, Escape clears — Task 4 Step 3 (/) and Task 5 Step 3 (Escape)
- [x] Search filters by title/company — Task 5
- [x] Search resets on tab switch — Task 1 Step 5
- [x] Keyboard hint — Task 4 Steps 1–2

**Placeholder scan:** No TBDs, all steps have full code.

**Type consistency:** `getFilteredJobs()` is defined in Task 1 and used in Tasks 2, 3. `focusedIndex` and `searchQuery` defined in Task 1, used throughout. `handleStatusChange` signature unchanged — still takes `(jobId, newStatus)`. `updateCountBadges()` defined in Task 1, called from `renderJobs` in Task 2.
