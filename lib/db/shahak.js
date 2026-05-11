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
