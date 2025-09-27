import axios from "axios";
import "dotenv/config.js";

/**
 * Create an Axios client configured to mimic a real browser and carry
 * the authenticated LinkedIn cookies. Provide cookies explicitly or rely
 * on environment variables LI_AT and JSESSIONID.
 */
export function createHttpClient({ liAt, jsessionId, timeout = 20000 } = {}) {
  const userAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

  const resolvedLiAt = liAt ?? process.env.LI_AT;
  const resolvedJsessionId = jsessionId ?? process.env.JSESSIONID;

  const cookies = `li_at=${resolvedLiAt}; JSESSIONID=${resolvedJsessionId}`;

  return axios.create({
    headers: {
      "user-agent": userAgent,
      accept: "application/vnd.linkedin.normalized+json+2.1",
      "csrf-token": String(resolvedJsessionId).replace(/"/g, ""),
      cookie: cookies,
      "accept-language": "en-US,en;q=0.9",
      "x-restli-protocol-version": "2.0.0",
    },
    timeout,
  });
}

export function getAuthCookiesFromEnv() {
  return {
    liAt: process.env.LI_AT,
    jsessionId: process.env.JSESSIONID,
  };
}

export const defaultClient = createHttpClient();


