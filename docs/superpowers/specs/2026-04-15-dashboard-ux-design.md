# Dashboard UX Improvement Design

**Date:** 2026-04-15  
**Status:** Approved

## Goal

Improve the job review workflow so the user can triage new jobs quickly using keyboard shortcuts, with immediate visual feedback and a focused default view.

## Scope

All changes are frontend-only (`public/index.html`). No backend or API changes required.

## Design

### 1. Tabs & Counts

- Tab order changes to: **New · Applied · Ignored · All**
- "New" is the default active tab on page load
- Each tab shows a live count badge (e.g. `New [12]`)
- Counts update immediately when a job is acted on — New decrements, target tab increments

### 2. Keyboard Navigation & Card Removal

- On load, the first card in the New tab is auto-focused (amber border highlight)
- Navigation:
  - `j` / `↓` — move focus to next card
  - `k` / `↑` — move focus to previous card
  - `a` — mark focused card as applied → card animates out, focus jumps to next card
  - `i` — mark focused card as ignored → card animates out, focus jumps to next card
  - `Enter` — open the focused job's link in a new tab
- Mouse clicks on Apply/Ignore buttons behave identically to keyboard shortcuts
- Exit animation: quick fade + slide (matches existing `fadeSlideIn` style, reversed)
- A one-line keyboard hint is shown at the bottom of the screen (e.g. `j/k navigate · a apply · i ignore · Enter open · / search`)

### 3. Search Bar

- A text input sits between the tab bar and the jobs grid
- Filters visible cards in real-time by job title or company name (client-side only)
- Search resets when switching tabs
- The search bar is inactive by default — keyboard shortcuts (`j`, `k`, `a`, `i`) work normally when it is not focused
- Pressing `/` focuses the search bar (standard convention)
- Pressing `Escape` clears and blurs the search bar, returning focus to the grid

## Implementation Notes

- All logic lives in `public/index.html` (the existing single-file frontend)
- The `jobs` array and `currentFilter` state already exist — extend with `focusedIndex` and `searchQuery` state
- Tab count badges are derived from `jobs` array on every render, no extra API calls
- Card removal animation: add a `.removing` CSS class that plays a reverse animation, then remove the DOM element after the transition ends
