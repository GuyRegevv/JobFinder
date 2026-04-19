const DEFAULT_NTFY_SERVER = "https://ntfy.sh";

/**
 * Send a notification via ntfy.
 * @param {object} options
 * @param {string} options.topic - ntfy topic name
 * @param {string} options.message - notification body
 * @param {string} [options.title] - notification title
 * @param {string} [options.priority] - min, low, default, high, urgent
 * @param {string[]} [options.tags] - emoji tags (e.g., ["briefcase", "tada"])
 * @param {string} [options.click] - URL to open when notification is clicked
 * @param {string} [options.server] - ntfy server URL
 */
export async function sendNtfyNotification({
  topic,
  message,
  title,
  priority = "default",
  tags = [],
  click,
  server = DEFAULT_NTFY_SERVER,
}) {
  if (!topic) throw new Error("ntfy topic is required");
  if (!message) throw new Error("ntfy message is required");

  const url = `${server}/${topic}`;

  const headers = {
    "Content-Type": "text/plain",
  };

  if (title) headers["Title"] = title;
  if (priority) headers["Priority"] = priority;
  if (tags.length > 0) headers["Tags"] = tags.join(",");
  if (click) headers["Click"] = click;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: message,
  });

  if (!response.ok) {
    throw new Error(`ntfy request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Format jobs into a notification message.
 * @param {Array} jobs - Array of job objects
 * @param {number} [maxJobs=5] - Maximum jobs to include in message
 */
export function formatJobsMessage(jobs) {
  if (!jobs || jobs.length === 0) {
    return "No new jobs found.";
  }

  const lines = jobs.map((job) => {
    const title = (job.title || "Unknown").trim();
    const company = job.company || "Unknown";
    const location = job.location || "";
    return `• ${title} @ ${company}\n  ${location}`;
  });

  return lines.join("\n\n");
}

/**
 * Send a notification about new jobs.
 * @param {Array} jobs - Array of new job objects
 * @param {object} options - ntfy options (topic, server, click)
 */
export async function notifyNewJobs(jobs, options = {}) {
  const { topic, server, clickUrl, label = "Job", tags = ["briefcase"] } = options;

  if (!topic) {
    console.log("[ntfy] No topic configured, skipping notification");
    return null;
  }

  if (!jobs || jobs.length === 0) {
    console.log("[ntfy] No new jobs, skipping notification");
    return null;
  }

  const message = formatJobsMessage(jobs);
  const title = `${jobs.length} New ${label}${jobs.length > 1 ? "s" : ""} Found`;

  console.log(`[ntfy] Sending notification: ${title}`);

  return sendNtfyNotification({
    topic,
    message,
    title,
    tags,
    click: clickUrl,
    server,
  });
}
