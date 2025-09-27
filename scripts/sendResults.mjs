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

async function main() {
  const latestDir = getLatestResultsDir("./results");
  const htmlPath = `${latestDir}/table.html`;
  const html = fs.readFileSync(htmlPath, "utf8");
  const normalizedPath = `${latestDir}/normalized.json`;
  const jobs = JSON.parse(fs.readFileSync(normalizedPath, "utf8"));
  const date = new Date().toLocaleDateString();
  await sendEmail({
    subject: `JobFinderJS ${date}: ${jobs.length} results`,
    html,
    attachments: [
      { filename: "table.html", content: html },
      { filename: "normalized.json", content: fs.readFileSync(normalizedPath) },
    ],
  });

  console.log("Email sent for", latestDir);
}

main().catch((err) => {
  console.error("Failed to send results email:", err?.stack || err?.message || err);
  process.exitCode = 1;
});
