import "dotenv/config.js";
import fs from "node:fs";
import { getLatestResultsDir } from "../lib/storage/resultsUtils.js";
import { sendEmail } from "../lib/email/mailer.js";
 
function escapeHtml(input) {
  return String(input).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function renderHtmlTable(rows, columns) {
  const safe = (v) => escapeHtml(v ?? "");
  const headerCells = columns.map((c) => `<th style="text-align:left;padding:8px;border-bottom:1px solid #ddd;">${safe(c)}</th>`).join("");
  const bodyRows = rows.map((r) => {
    const tds = columns.map((c) => `<td style="padding:8px;border-bottom:1px solid #f0f0f0;vertical-align:top;">${safe(r[c])}</td>`).join("");
    return `<tr>${tds}</tr>`;
  }).join("");
  return `<table role="table" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;max-width:1024px;margin-top:12px;">
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>`;
}

function formatDateTime(dt) {
  const pad = (n) => String(n).padStart(2, "0");
  const year = dt.getFullYear();
  const month = pad(dt.getMonth() + 1);
  const day = pad(dt.getDate());
  const hours = pad(dt.getHours());
  const minutes = pad(dt.getMinutes());
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

async function main() {
  const latestDir = getLatestResultsDir("./results");
  const normalizedPath = `${latestDir}/normalized.json`;
  const jobs = JSON.parse(fs.readFileSync(normalizedPath, "utf8"));
  // Use the run directory mtime as the run timestamp for the email subject
  const runTime = new Date(fs.statSync(latestDir).mtimeMs);
  const date = formatDateTime(runTime);

  // Trim to only the requested fields
  const trimmed = Array.isArray(jobs)
    ? jobs.map((j) => ({ id: j?.id ?? "", title: j?.title ?? "", company: j?.company ?? "", location: j?.location ?? "" }))
    : [];
  const columns = ["id", "title", "company", "location"];
  const table = renderHtmlTable(trimmed, columns);

  // Clean, minimal email wrapper
  const emailHtml = `<!doctype html><meta charset="utf-8"><div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;line-height:1.45;">
  <h2 style="margin:0 0 6px;">JobFinderJS Results</h2>
  <div style="font-size:14px;color:#555;margin-bottom:8px;">${trimmed.length} jobs · ${escapeHtml(date)}</div>
  ${table}
  <div style="margin-top:12px;color:#888;font-size:12px;">Source: normalized.json in ${escapeHtml(latestDir)}</div>
</div>`;

  await sendEmail({
    subject: `JobFinderJS · ${date} · ${jobs.length} jobs`,
    html: emailHtml,
  });

  console.log("Email sent for", latestDir);
}

main().catch((err) => {
  console.error("Failed to send results email:", err?.stack || err?.message || err);
  process.exitCode = 1;
});
