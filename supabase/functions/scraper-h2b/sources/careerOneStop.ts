export async function fetchCareerOneStop() {
  try {
    const userId = Deno.env.get("CAREERONESTOP_USER_ID")?.trim();
    let apiKey = Deno.env.get("CAREERONESTOP_API_KEY")?.trim();

    if (!userId || !apiKey) {
      console.log("CareerOneStop: Omitido (sin API Key configurada)");
      return [];
    }

    // Si el secret reemplazó el '+' por espacios, lo corregimos
    apiKey = apiKey.replace(/ /g, "+");

    const url = `https://api.careeronestop.org/v1/jobsearch/${userId}/H2B/US/0/0/DESC/1/10/30`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${apiKey}`
      }
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`CareerOneStop API Error ${res.status}: ${errorText}`);
      return [];
    }

    const data = await res.json();
    const jobsList = data.JobsList || data.Jobs || [];

    console.log(`CareerOneStop: ${jobsList.length} ofertas obtenidas.`);

    return jobsList.map((item: any) => ({
      title: item.JobTitle || "Trabajo H-2B",
      employer_name: item.Company || "Empleador CareerOneStop",
      location: item.Location || "EE. UU.",
      source: "CareerOneStop API"
    }));
  } catch (e: any) {
    console.error("Error en CareerOneStop API:", e.message);
    return [];
  }
}