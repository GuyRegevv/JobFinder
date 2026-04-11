import { createHttpClient, defaultClient } from "../api/httpClient.js";

const JOB_DETAILS_DECORATION =
  "com.linkedin.voyager.deco.jobs.web.shared.WebLightJobPosting-23";

const WORKPLACE_TYPE_MAP = {
  "urn:li:fs_workplaceType:1": "On-site",
  "urn:li:fs_workplaceType:2": "Remote",
  "urn:li:fs_workplaceType:3": "Hybrid",
};

/**
 * Fetch detailed job posting info including description.
 * @param {string} jobId - The job posting ID
 * @param {object} options - Optional client override
 * @returns {Promise<object>} Job details with description
 */
export async function fetchJobDetails(jobId, options = {}) {
  const client = options.client || defaultClient || createHttpClient();

  const url = `https://www.linkedin.com/voyager/api/jobs/jobPostings/${jobId}?decorationId=${JOB_DETAILS_DECORATION}`;

  console.log("GET", url);
  const res = await client.get(url);

  return normalizeJobDetails(res.data, jobId);
}

/**
 * Fetch details for multiple jobs (with delay to avoid rate limiting)
 * @param {string[]} jobIds - Array of job IDs
 * @param {object} options - Optional settings
 * @returns {Promise<Map<string, object>>} Map of jobId -> details
 */
export async function fetchMultipleJobDetails(jobIds, options = {}) {
  const { delayMs = 500, client } = options;
  const results = new Map();

  for (const jobId of jobIds) {
    try {
      const details = await fetchJobDetails(jobId, { client });
      results.set(jobId, details);
    } catch (err) {
      console.error(`Failed to fetch details for job ${jobId}:`, err.message);
      results.set(jobId, { error: err.message });
    }

    // Delay between requests to avoid rate limiting
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

function normalizeJobDetails(payload, jobId) {
  const data = payload?.data ?? payload ?? {};

  // Parse workplace type from URN array
  const workplaceTypeUrns = data?.workplaceTypes ?? [];
  const workplaceType = workplaceTypeUrns
    .map((urn) => WORKPLACE_TYPE_MAP[urn])
    .filter(Boolean)
    .join(", ") || null;

  // Convert listedAt timestamp to ISO date
  const listedAtMs = data?.listedAt;
  const listedAt = listedAtMs ? new Date(listedAtMs).toISOString() : null;

  return {
    id: jobId,
    title: data?.title ?? null,
    description: data?.description?.text ?? null,
    location: data?.formattedLocation ?? null,
    workplaceType,
    workRemoteAllowed: data?.workRemoteAllowed ?? null,
    applyUrl: data?.applyMethod?.companyApplyUrl ?? null,
    jobState: data?.jobState ?? null,
    listedAt,
    _raw: data,
  };
}
