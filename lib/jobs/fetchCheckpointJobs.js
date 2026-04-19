import * as cheerio from 'cheerio';

const BASE_URL =
  'https://careers.checkpoint.com/index.php?q=&module=cpcareers&a=search' +
  '&fa%5B%5D=country_ss:Israel&sort=date_published_display_s+desc';

/**
 * Scrape all Israel jobs from Check Point's careers site.
 * Paginates with &start=N (step 10) until a page returns no .save-job-btn elements.
 * @returns {{ jobs: Array<{id: string, title: string, link: string}> }}
 */
export async function fetchCheckpointJobs() {
  const allJobs = [];
  let start = 0;

  while (true) {
    const url = start === 0 ? BASE_URL : `${BASE_URL}&start=${start}`;
    console.log(`[checkpoint] Fetching page start=${start}`);

    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} fetching checkpoint page start=${start}`);
    }

    const html = await resp.text();
    const $ = cheerio.load(html);
    const buttons = $('.save-job-btn');

    if (buttons.length === 0) break;

    buttons.each((_, btn) => {
      const $btn = $(btn);
      const id = $btn.attr('data-id');
      const title = $btn.attr('data-title');
      const link = $btn.attr('data-link');
      if (id) allJobs.push({ id, title: title || '', link: link || '' });
    });

    start += 10;
  }

  console.log(`[checkpoint] Total jobs fetched: ${allJobs.length}`);
  return { jobs: allJobs };
}
