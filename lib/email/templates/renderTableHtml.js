export function renderJobsTableHtml(jobs = []) {
  const columns = ["id", "title", "company", "location", "postedAt"];
  const escapeHtml = (input) => String(input ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const safe = (v) => escapeHtml(v);

  const headerCells = columns
    .map((c) => `<th style="text-align:left;padding:8px;border-bottom:1px solid #ddd;">${safe(c)}</th>`) 
    .join("");

  const bodyRows = jobs
    .map((r) => {
      const tds = columns
        .map((c) => `<td style=\"padding:8px;border-bottom:1px solid #f0f0f0;vertical-align:top;\">${safe(r[c])}</td>`) 
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  return `<!doctype html><meta charset="utf-8"><div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;">
  <h2 style="margin:0 0 8px;">JobFinderJS Results</h2>
  <div style="font-size:14px;color:#555;">${jobs.length} jobs</div>
  <table role="table" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;max-width:1024px;margin-top:12px;">
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</div>`;
}
