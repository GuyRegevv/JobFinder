/**
 * Build the Voyager Jobs JobCards URL from high-level search parameters.
 * We intentionally keep the Rest.li-style query segment structure to match
 * what the LinkedIn web app generates, avoiding experimental flags.
 */

export const DEFAULT_DECORATION_ID =
  "com.linkedin.voyager.dash.deco.jobs.search.JobSearchCardsCollectionLite-88";

function encodeKeywords(keywords) {
  if (Array.isArray(keywords)) {
    const parts = keywords
      .filter(Boolean)
      .map((k) => String(k).trim())
      .filter((k) => k.length > 0)
      .map((k) => (/[\s]/.test(k) ? `"${k}"` : k));
    return encodeURIComponent(parts.join(" OR "));
  }
  return encodeURIComponent(keywords ?? "");
}

function list(values) {
  if (!values || values.length === 0) return "List()";
  return `List(${values.join(",")})`;
}

function buildSelectedFilters({ experience, timePostedRange, workTypes, onSiteOrRemote } = {}) {
  const parts = [];
  if (experience && experience.length) parts.push(`experience:${list(experience)}`);
  if (timePostedRange && timePostedRange.length) parts.push(`timePostedRange:${list(timePostedRange)}`);
  if (workTypes && workTypes.length) parts.push(`workType:${list(workTypes)}`);
  if (onSiteOrRemote && onSiteOrRemote.length) parts.push(`onSiteOrRemote:${list(onSiteOrRemote)}`);
  if (!parts.length) return "";
  return `selectedFilters:(${parts.join(",")})`;
}

export function buildJobCardsUrl({
  keywords,
  experience = [],
  timePostedRange = [],
  workTypes = [],
  onSiteOrRemote = [],
  count = 25,
  start = 0,
  origin = "JOB_SEARCH_PAGE_JOB_FILTER",
  decorationId = DEFAULT_DECORATION_ID,
} = {}) {
  const selectedFilters = buildSelectedFilters({
    experience,
    timePostedRange,
    workTypes,
    onSiteOrRemote,
  });

  const queryParts = [
    `origin:${origin}`,
    keywords ? `keywords:${encodeKeywords(keywords)}` : null,
    selectedFilters || null,
  ].filter(Boolean);

  const querySegment = `(${queryParts.join(",")})`;

  const base = "https://www.linkedin.com/voyager/api/voyagerJobsDashJobCards";
  const url = `${base}?decorationId=${decorationId}&count=${count}&q=jobSearch&query=${querySegment}&start=${start}`;
  return url;
}


