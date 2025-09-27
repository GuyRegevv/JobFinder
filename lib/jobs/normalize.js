/**
 * Normalize a voyager job cards response to a simple array of items.
 * Only fields present in the JobPostingCard decoration are emitted.
 */
export function normalizeFromCards(payload) {
  const root = payload?.data ?? payload ?? {};
  const elements = root?.elements ?? root?.data?.elements ?? [];
  const included = payload?.included ?? root?.included ?? [];

  const byCardUrn = new Map();
  for (const o of included) {
    if (o?.entityUrn && typeof o?.$type === "string" && o.$type.includes("jobs.JobPostingCard")) {
      byCardUrn.set(o.entityUrn, o);
    }
  }

  const out = [];
  for (const el of elements) {
    const cardUrn = el?.jobCardUnion?.["*jobPostingCard"];
    if (!cardUrn) continue;

    const card = byCardUrn.get(cardUrn);
    if (!card) continue;

    const jobPostingUrn = card?.jobPostingUrn || null;
    const id = jobPostingUrn ? jobPostingUrn.split(":").pop() : null;

    out.push({
      id,
      title: card?.title?.text ?? null,
      company: card?.primaryDescription?.text ?? null,
      location: card?.secondaryDescription?.text ?? null,
      postedAt: null,
      workplaceType: null,
      jobType: null,
      url: null,
      _debug: { cardUrn, jobPostingUrn },
    });
  }

  return out;
}


