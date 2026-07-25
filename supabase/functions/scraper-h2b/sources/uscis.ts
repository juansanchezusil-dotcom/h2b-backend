import { parse } from "https://deno.land/std@0.208.0/csv/parse.ts";

export async function fetchUscisData() {
  try {
    // URL directa al archivo CSV oficial de USCIS H-2B Data Hub
    const csvUrl = "https://www.uscis.gov/sites/default/files/document/data/h2b_data_hub.csv";
    const res = await fetch(csvUrl, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!res.ok) return [];

    const text = await res.text();
    const records = parse(text, { skipFirstRow: true });

    // Tomamos una muestra de los últimos registros procesados
    return records.slice(0, 20).map((row: any) => ({
      title: "Petición Aprobada/Procesada H-2B",
      employer_name: row[0] || row["Employer Name"] || "Empleador USCIS",
      location: row[1] ? `${row[1]}, ${row[2] || ""}` : "EE. UU.",
      source: "USCIS Data Hub"
    }));
  } catch (e) {
    console.error("Error en USCIS Data Hub:", e);
    return [];
  }
}