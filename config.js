// Default high-level query params used by the CLI entry point. Adjust as needed.
export const DEFAULT_QUERY_PARAMS = {
  keywords: ["software developer", "software engineer", "backend", "frontend", "junior"],
  //keywords: ["software developer"],
  experience: ["2"], // Entry level
  timePostedRange: ["r86400"], // Last 24 hours
  count: 100,
  start: 0,
};

// Shahak's LinkedIn search params — update keywords/experience to match what he's looking for.
export const SHAHAK_QUERY_PARAMS = {
  keywords: ["product manager", "project manager", "program manager"],
  experience: ["3", "4"], // Associate, Mid-Senior
  timePostedRange: ["r86400"], // Last 24 hours
  count: 100,
  start: 0,
};
