import "dotenv/config.js";
import { searchJobs } from "./lib/jobs/searchJobs.js";
import { saveJson, createRunDir, saveHtml } from "./lib/storage/persist.js";
import { renderJobsTableHtml } from "./lib/email/templates/renderTableHtml.js";
import { upsertJobs, getVisibleJobs, closeDb } from "./lib/db/index.js";
import { DEFAULT_QUERY_PARAMS } from "./config.js";

(async () => {
  try {
    const params = { ...DEFAULT_QUERY_PARAMS };
    const { jobs, raw } = await searchJobs(params);

    // Upsert jobs into database (tracks new vs updated)
    const { newJobs, updatedCount } = upsertJobs(jobs);

    // Get all visible jobs (within TTL window)
    const visibleJobs = getVisibleJobs({ ttlHours: 24 });

    const runDir = createRunDir("./results");
    const rawFile = saveJson("response", raw, { dir: runDir });
    const normFile = saveJson("normalized", visibleJobs, { dir: runDir });

    const html = renderJobsTableHtml(visibleJobs);
    const tableFile = saveHtml("table", html, { dir: runDir });

    console.log(`\nFetched ${jobs.length} jobs (${newJobs.length} new, ${updatedCount} updated)`);
    console.log(`Showing ${visibleJobs.length} jobs (within 24h window)`);
    console.log("Saved files:");
    console.log(" -", rawFile);
    console.log(" -", normFile);
    console.log(" -", tableFile);

    closeDb();

  } catch (err) {
    closeDb();
    const code = err.response?.status;
    console.error("Request failed", code || "", err.message);
    if (code === 401) console.error("→ Auth expired. Update cookies in .env");
    if (code === 403) console.error("→ Challenge/CSRF. Check headers/cookies or re-login");
    if (code === 404) console.error("→ Endpoint/decorationId not valid for this session; copy exact one from DevTools");
    if (code === 429) console.error("→ Rate-limited. Back off with random delays");
    if (err.response?.data) saveJson("error", err.response.data);
  }
})();
