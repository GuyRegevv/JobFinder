import "dotenv/config.js";
import express from "express";
import cron from "node-cron";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { searchJobs } from "./lib/jobs/searchJobs.js";
import {
  upsertJobs,
  getVisibleJobs,
  getAllJobs,
  updateJobStatus,
  getStats,
  getDb,
} from "./lib/db/index.js";
import { notifyNewJobs } from "./lib/notifications/ntfy.js";
import { DEFAULT_QUERY_PARAMS } from "./config.js";
import { initCheckpointTable, upsertCheckpointJobs, getCheckpointJobs, deleteCheckpointJob } from './lib/db/checkpoint.js';
import { fetchCheckpointJobs } from './lib/jobs/fetchCheckpointJobs.js';
import { initShahakTable, upsertShahakJobs, getShahakJobs, deleteShahakJob } from './lib/db/shahak.js';
import { SHAHAK_QUERY_PARAMS } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "0 9,13,18 * * *"; // 9am, 1pm, 6pm
const NTFY_TOPIC = process.env.NTFY_TOPIC || "";
const NTFY_SERVER = process.env.NTFY_SERVER || "https://ntfy.sh";
const NTFY_CLICK_URL = process.env.NTFY_CLICK_URL || "";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Track fetch status
let lastFetch = { time: null, status: null, jobsFound: 0, newJobs: 0 };
let isFetching = false;
let lastCheckpointFetch = { time: null, status: null, jobsFound: 0, newJobs: 0 };
let isCheckpointFetching = false;
let lastShahakFetch = { time: null, status: null, jobsFound: 0, newJobs: 0 };
let isShahakFetching = false;

// ─────────────────────────────────────────────────────────────
// Job fetching logic
// ─────────────────────────────────────────────────────────────
async function fetchJobs() {
  if (isFetching) {
    console.log("[fetch] Already fetching, skipping...");
    return { skipped: true };
  }

  isFetching = true;
  console.log(`[fetch] Starting job fetch at ${new Date().toISOString()}`);

  try {
    const { jobs } = await searchJobs(DEFAULT_QUERY_PARAMS);
    const { newJobs, updatedCount } = upsertJobs(jobs);

    lastFetch = {
      time: new Date().toISOString(),
      status: "success",
      jobsFound: jobs.length,
      newJobs: newJobs.length,
      updated: updatedCount,
    };

    console.log(`[fetch] Complete: ${jobs.length} found, ${newJobs.length} new`);

    // Send push notification if there are new jobs
    if (newJobs.length > 0 && NTFY_TOPIC) {
      try {
        await notifyNewJobs(newJobs, {
          topic: NTFY_TOPIC,
          server: NTFY_SERVER,
          clickUrl: NTFY_CLICK_URL,
        });
      } catch (ntfyErr) {
        console.error("[ntfy] Failed to send notification:", ntfyErr.message);
      }
    }

    return lastFetch;
  } catch (err) {
    lastFetch = {
      time: new Date().toISOString(),
      status: "error",
      error: err.message,
    };
    console.error("[fetch] Error:", err.message);
    return lastFetch;
  } finally {
    isFetching = false;
  }
}

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
          label: "Checkpoint Job",
          tags: ["shield"],
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

// ─────────────────────────────────────────────────────────────
// Cron scheduler
// ─────────────────────────────────────────────────────────────
cron.schedule(CRON_SCHEDULE, () => {
  console.log(`[cron] Triggered at ${new Date().toISOString()}`);
  fetchJobs();
});

console.log(`[cron] Scheduled: "${CRON_SCHEDULE}"`);

cron.schedule('0 * * * *', () => {
  console.log(`[checkpoint-cron] Triggered at ${new Date().toISOString()}`);
  runCheckpointFetch();
});

console.log('[cron] Checkpoint scheduled: every hour');

cron.schedule('0 8 * * *', () => {
  console.log(`[shahak-cron] Triggered at ${new Date().toISOString()}`);
  runShahakFetch();
});

console.log('[cron] Shahak scheduled: 8AM daily');;

// ─────────────────────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────────────────────

// Get visible jobs (within TTL)
app.get("/api/jobs", (req, res) => {
  const ttlHours = parseInt(req.query.ttl) || 24;
  const jobs = getVisibleJobs({ ttlHours });
  res.json({ jobs, count: jobs.length });
});

// Get all jobs (no TTL filter)
app.get("/api/jobs/all", (req, res) => {
  const jobs = getAllJobs();
  res.json({ jobs, count: jobs.length });
});

// Update job status
app.post("/api/jobs/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["new", "applied", "ignored"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  updateJobStatus(id, status);
  res.json({ success: true, id, status });
});

// Trigger manual fetch
app.post("/api/fetch", async (req, res) => {
  const result = await fetchJobs();
  res.json(result);
});

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

// Trigger manual Shahak fetch
app.post('/api/shahak/fetch', async (req, res) => {
  await runShahakFetch();
  res.json(lastShahakFetch);
});

// Get stats
app.get("/api/stats", (req, res) => {
  const stats = getStats();
  res.json({ ...stats, lastFetch, isFetching, lastCheckpointFetch });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Shahak's page
app.get('/shahak', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'shahak.html'));
});

// Serve frontend for all other routes
app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─────────────────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  // Initialize DB
  getDb();
  initCheckpointTable();
  initShahakTable();
  console.log(`[server] Running on http://localhost:${PORT}`);
  console.log(`[server] Cron schedule: ${CRON_SCHEDULE}`);
  if (NTFY_TOPIC) {
    console.log(`[server] Ntfy notifications: ${NTFY_SERVER}/${NTFY_TOPIC}`);
  } else {
    console.log(`[server] Ntfy notifications: disabled (no NTFY_TOPIC set)`);
  }
});
