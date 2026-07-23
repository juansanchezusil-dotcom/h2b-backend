import playwright from 'playwright';

export async function scrapeSeasonalJobs() {
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(
    'https://seasonaljobs.dol.gov/jobs?job_type=H-2B&sort=relevancy',
    { waitUntil: 'networkidle' }
  );

  const jobs = await page.$$eval('.job-listing', listings =>
    listings.map(job => ({
      title: job.querySelector('.job-title')?.textContent || '',
      employer: job.querySelector('.employer')?.textContent || '',
      location: job.querySelector('.location')?.textContent || '',
      startDate: job.querySelector('.start-date')?.textContent || '',
      endDate: job.querySelector('.end-date')?.textContent || '',
      wage: job.querySelector('.wage')?.textContent || '',
      url: job.querySelector('a')?.href || ''
    }))
  );

  await browser.close();
  return jobs;
}
