export async function fetchSeasonalJobs() {
  try {
    const res = await fetch("https://seasonaljobs.dol.gov/api/casemanagement/v1/jobs?page=1&limit=20", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json"
      }
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items = data.data || data.hits || [];
    return items.map((item: any) => ({
      title: item.job_title || item.title || "Trabajo H-2B",
      employer_name: item.employer_name || item.employer || "Desconocido",
      location: item.worksite_city ? `${item.worksite_city}, ${item.worksite_state || ""}` : "EE. UU.",
      source: "SeasonalJobs"
    }));
  } catch (e) {
    console.error("Error en SeasonalJobs:", e);
    return [];
  }
}