export function normalizeJob(job: any) {
  return {
    title: job.title || '',
    employer: job.employer || '',
    location: job.location || '',
    start_date: job.startDate || null,
    end_date: job.endDate || null,
    wage: job.wage || '',
    url: job.url || '',
    source: 'seasonaljobs'
  };
}

export function normalizeEmployer(emp: any) {
  return {
    employer: emp.employer || '',
    state: emp.state || '',
    workers_requested: emp.workersRequested || 0,
    workers_approved: emp.workersApproved || 0,
    year: emp.year || ''
  };
}
