export function renderJobsTableHtml(jobs = []) {
  const escapeHtml = (input) => String(input ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  const headerStyle = "text-align:left;padding:8px;border-bottom:1px solid #ddd;";
  const cellStyle = "padding:8px;border-bottom:1px solid #f0f0f0;vertical-align:top;";

  const headers = ["Title", "Company", "Location", "First Seen"];

  const headerCells = headers.map((h) => `<th style="${headerStyle}">${h}</th>`).join("");

  const bodyRows = jobs
    .map((job) => {
      // Handle both camelCase (from normalize) and snake_case (from db)
      const url = job.url || job.url;
      const title = job.title || "";
      const company = job.company || "";
      const companyPageUrl = job.companyPageUrl || job.company_page_url;
      const location = job.location || "";
      const firstSeen = job.first_seen_at || job.firstSeen || "";

      const titleCell = url
        ? `<a href="${escapeHtml(url)}" target="_blank" style="color:#0066cc;">${escapeHtml(title)}</a>`
        : escapeHtml(title);

      const companyCell = companyPageUrl
        ? `<a href="${escapeHtml(companyPageUrl)}" target="_blank" style="color:#0066cc;">${escapeHtml(company)}</a>`
        : escapeHtml(company);

      const seenDate = firstSeen ? new Date(firstSeen).toLocaleString() : "";

      return `<tr>
        <td style="${cellStyle}">${titleCell}</td>
        <td style="${cellStyle}">${companyCell}</td>
        <td style="${cellStyle}">${escapeHtml(location)}</td>
        <td style="${cellStyle}">${escapeHtml(seenDate)}</td>
      </tr>`;
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
