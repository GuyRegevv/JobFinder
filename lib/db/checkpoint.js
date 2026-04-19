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
      last_seen_at TEXT NOT NULL,
      hidden_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_checkpoint_first_seen ON checkpoint_jobs(first_seen_at);
  `);

  // Migrate existing table if hidden_at column is missing
  try {
    db.exec(`ALTER TABLE checkpoint_jobs ADD COLUMN hidden_at TEXT`);
  } catch {
    // Column already exists — safe to ignore
  }
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

  // hidden_at is intentionally excluded from ON CONFLICT update — preserves user's delete
  const insertStmt = db.prepare(`
    INSERT INTO checkpoint_jobs (id, title, link, first_seen_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      last_seen_at = excluded.last_seen_at,
      title = excluded.title,
      link = excluded.link
  `);

  const existsStmt = db.prepare(`SELECT id FROM checkpoint_jobs WHERE id = ?`); // includes hidden rows

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
 * Return visible (non-hidden) checkpoint jobs, newest first.
 * @returns {Array}
 */
export function getCheckpointJobs() {
  const db = getDb();
  return db.prepare(`SELECT * FROM checkpoint_jobs WHERE hidden_at IS NULL ORDER BY first_seen_at DESC`).all();
}

/**
 * Soft-delete a checkpoint job so it survives hourly re-fetches.
 * @param {string} id
 */
export function deleteCheckpointJob(id) {
  const db = getDb();
  return db.prepare(`UPDATE checkpoint_jobs SET hidden_at = ? WHERE id = ?`).run(new Date().toISOString(), id);
}
