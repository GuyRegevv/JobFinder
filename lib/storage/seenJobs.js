import fs from "node:fs";

const DEFAULT_SEEN_FILE = "./data/seen.json";

/**
 * Load seen jobs from file.
 * @param {string} filePath - Path to seen.json
 * @returns {Map<string, object>} Map of jobId -> { firstSeen, title }
 */
export function loadSeenJobs(filePath = DEFAULT_SEEN_FILE) {
  try {
    if (!fs.existsSync(filePath)) {
      return new Map();
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return new Map(Object.entries(data));
  } catch (err) {
    console.error("Failed to load seen jobs:", err.message);
    return new Map();
  }
}

/**
 * Save seen jobs to file.
 * @param {Map<string, object>} seen - Map of jobId -> { firstSeen, title }
 * @param {string} filePath - Path to seen.json
 */
export function saveSeenJobs(seen, filePath = DEFAULT_SEEN_FILE) {
  const dir = filePath.substring(0, filePath.lastIndexOf("/"));
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const data = Object.fromEntries(seen);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * Filter jobs to only return new (unseen) ones, and mark them as seen.
 * @param {Array} jobs - Array of normalized job objects
 * @param {object} options - Options
 * @returns {{ newJobs: Array, seenCount: number }} New jobs and count of filtered duplicates
 */
export function filterNewJobs(jobs, options = {}) {
  const { seenFile = DEFAULT_SEEN_FILE, dryRun = false } = options;

  const seen = loadSeenJobs(seenFile);
  const now = new Date().toISOString();

  const newJobs = [];
  let seenCount = 0;

  for (const job of jobs) {
    if (!job.id) continue;

    if (seen.has(job.id)) {
      seenCount++;
    } else {
      newJobs.push(job);
      seen.set(job.id, { firstSeen: now, title: job.title });
    }
  }

  if (!dryRun && newJobs.length > 0) {
    saveSeenJobs(seen, seenFile);
  }

  return { newJobs, seenCount };
}

/**
 * Get stats about seen jobs.
 * @param {string} filePath - Path to seen.json
 * @returns {object} Stats object
 */
export function getSeenStats(filePath = DEFAULT_SEEN_FILE) {
  const seen = loadSeenJobs(filePath);
  return {
    total: seen.size,
    oldest: [...seen.values()].reduce((min, v) =>
      v.firstSeen < min ? v.firstSeen : min, new Date().toISOString()),
    newest: [...seen.values()].reduce((max, v) =>
      v.firstSeen > max ? v.firstSeen : max, ""),
  };
}

/**
 * Clear all seen jobs (reset).
 * @param {string} filePath - Path to seen.json
 */
export function clearSeenJobs(filePath = DEFAULT_SEEN_FILE) {
  saveSeenJobs(new Map(), filePath);
}
