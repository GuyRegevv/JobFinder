import { buildJobCardsUrl } from "./buildQuery.js";
import { normalizeFromCards } from "./normalize.js";
import { createHttpClient, defaultClient } from "../api/httpClient.js";

/**
 * Orchestrates building the URL, sending the request, and returning
 * both the raw payload and the normalized jobs list.
 */
export async function searchJobs(params = {}, options = {}) {
  const client = options.client || defaultClient || createHttpClient();
  const url = buildJobCardsUrl(params);

  console.log("GET", url);
  const res = await client.get(url);

  const jobs = normalizeFromCards(res.data);
  return { jobs, url, raw: res.data };
}


