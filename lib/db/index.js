import Database from "better-sqlite3";
import fs from "node:fs";

const DEFAULT_DB_PATH = "./data/jobs.db";
const DEFAULT_TTL_HOURS = 24;

let db = null;

/**
 * Initialize the database connection and create tables if needed.
 */
export function initDb(dbPath = DEFAULT_DB_PATH) {
  const dir = dbPath.substring(0, dbPath.lastIndexOf("/"));
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      title TEXT,
      company TEXT,
      location TEXT,
      url TEXT,
      company_page_url TEXT,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      status TEXT DEFAULT 'new',
      hidden_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_first_seen ON jobs(first_seen_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  `);

  return db;
}

/**
 * Get the database instance, initializing if needed.
 */
export function getDb(dbPath = DEFAULT_DB_PATH) {
  if (!db) {
    initDb(dbPath);
  }
  return db;
}

/**
 * Close the database connection.
 */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Upsert jobs into the database.
 * - New jobs get inserted with first_seen_at = now
 * - Existing jobs get last_seen_at updated
 * @param {Array} jobs - Array of normalized job objects
 * @returns {{ newJobs: Array, updatedCount: number }}
 */
export function upsertJobs(jobs) {
  const database = getDb();
  const now = new Date().toISOString();

  const insertStmt = database.prepare(`
    INSERT INTO jobs (id, title, company, location, url, company_page_url, first_seen_at, last_seen_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')
    ON CONFLICT(id) DO UPDATE SET
      last_seen_at = excluded.last_seen_at,
      title = excluded.title,
      company = excluded.company,
      location = excluded.location,
      url = excluded.url,
      company_page_url = excluded.company_page_url
  `);

  const existsStmt = database.prepare(`SELECT id FROM jobs WHERE id = ?`);

  const newJobs = [];
  let updatedCount = 0;

  const upsertMany = database.transaction((jobList) => {
    for (const job of jobList) {
      if (!job.id) continue;

      const exists = existsStmt.get(job.id);

      insertStmt.run(
        job.id,
        job.title,
        job.company,
        job.location,
        job.url,
        job.companyPageUrl,
        now,
        now
      );

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
 * Get jobs that should be visible (within TTL window or status = 'new').
 * @param {object} options
 * @returns {Array} Jobs to display
 */
export function getVisibleJobs(options = {}) {
  const { ttlHours = DEFAULT_TTL_HOURS, includeHidden = false } = options;
  const database = getDb();

  const cutoff = new Date(Date.now() - ttlHours * 60 * 60 * 1000).toISOString();

  let query = `
    SELECT * FROM jobs
    WHERE (first_seen_at >= ? OR status = 'new')
  `;

  if (!includeHidden) {
    query += ` AND (hidden_at IS NULL)`;
  }

  query += ` ORDER BY first_seen_at DESC`;

  return database.prepare(query).all(cutoff);
}

/**
 * Get all jobs regardless of TTL.
 */
export function getAllJobs() {
  const database = getDb();
  return database.prepare(`SELECT * FROM jobs ORDER BY first_seen_at DESC`).all();
}

/**
 * Get a single job by ID.
 */
export function getJob(jobId) {
  const database = getDb();
  return database.prepare(`SELECT * FROM jobs WHERE id = ?`).get(jobId);
}

/**
 * Update job status (new, applied, ignored, expired).
 */
export function updateJobStatus(jobId, status) {
  const database = getDb();
  const hiddenAt = status === "ignored" ? new Date().toISOString() : null;

  return database
    .prepare(`UPDATE jobs SET status = ?, hidden_at = ? WHERE id = ?`)
    .run(status, hiddenAt, jobId);
}

/**
 * Mark old jobs as expired.
 * @param {number} olderThanDays - Expire jobs not seen for this many days
 */
export function expireOldJobs(olderThanDays = 7) {
  const database = getDb();
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

  return database
    .prepare(`UPDATE jobs SET status = 'expired' WHERE last_seen_at < ? AND status = 'new'`)
    .run(cutoff);
}

/**
 * Get database stats.
 */
export function getStats() {
  const database = getDb();

  const total = database.prepare(`SELECT COUNT(*) as count FROM jobs`).get().count;
  const byStatus = database
    .prepare(`SELECT status, COUNT(*) as count FROM jobs GROUP BY status`)
    .all();

  return { total, byStatus };
}

/**
 * Delete all jobs (reset database).
 */
export function clearAllJobs() {
  const database = getDb();
  return database.prepare(`DELETE FROM jobs`).run();
}
