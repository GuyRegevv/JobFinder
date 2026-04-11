import "dotenv/config.js";
import { fetchJobDetails } from "../lib/jobs/fetchJobDetails.js";

// Test with a known job ID from recent results
const TEST_JOB_ID = process.argv[2] || "4351152130";

(async () => {
  try {
    console.log(`Fetching details for job ${TEST_JOB_ID}...\n`);
    const details = await fetchJobDetails(TEST_JOB_ID);

    console.log("--- Normalized Details ---");
    console.log("Title:", details.title);
    console.log("Location:", details.location);
    console.log("Workplace Type:", details.workplaceType);
    console.log("Remote Allowed:", details.workRemoteAllowed);
    console.log("Job State:", details.jobState);
    console.log("Listed At:", details.listedAt);
    console.log("Apply URL:", details.applyUrl);
    console.log("Description:", details.description?.substring(0, 300) + "...");

  } catch (err) {
    console.error("Failed:", err.response?.status, err.message);
    if (err.response?.data) {
      console.error("Response:", JSON.stringify(err.response.data, null, 2));
    }
  }
})();
