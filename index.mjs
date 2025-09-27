import "dotenv/config.js";
import { searchJobs } from "./lib/jobs/searchJobs.js";
import { saveJson, createRunDir, saveHtml } from "./lib/storage/persist.js";
import { renderJobsTableHtml } from "./lib/email/templates/renderTableHtml.js";
import { DEFAULT_QUERY_PARAMS } from "./config.js";

(async () => {
  try {
    const params = { ...DEFAULT_QUERY_PARAMS };
    const { jobs, url, raw } = await searchJobs(params);

    const runDir = createRunDir("./results");
    const rawFile = saveJson("response", raw, { dir: runDir });
    const normFile = saveJson("normalized", jobs, { dir: runDir });

    const html = renderJobsTableHtml(jobs);
    const tableFile = saveHtml("table", html, { dir: runDir });

    console.log(`\nFetched ${jobs.length} jobs`);
    console.log("Saved files:");
    console.log(" -", rawFile);
    console.log(" -", normFile);
    console.log(" -", tableFile);

  } catch (err) {
    const code = err.response?.status;
    console.error("Request failed", code || "", err.message);
    if (code === 401) console.error("→ Auth expired. Update cookies in .env");
    if (code === 403) console.error("→ Challenge/CSRF. Check headers/cookies or re-login");
    if (code === 404) console.error("→ Endpoint/decorationId not valid for this session; copy exact one from DevTools");
    if (code === 429) console.error("→ Rate-limited. Back off with random delays");
    if (err.response?.data) saveJson("error", err.response.data);
  }
})();
