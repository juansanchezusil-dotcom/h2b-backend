import axios from 'axios';
import csv from 'csvtojson';

export async function scrapeUSCIS() {
  const url =
    'https://www.uscis.gov/sites/default/files/document/data/h-2b-employer-data-hub.csv';

  const response = await axios.get(url);
  const json = await csv().fromString(response.data);

  return json.map(row => ({
    employer: row['Employer'],
    state: row['State'],
    workersRequested: Number(row['Workers Requested'] || 0),
    workersApproved: Number(row['Workers Approved'] || 0),
    year: row['Fiscal Year']
  }));
}
