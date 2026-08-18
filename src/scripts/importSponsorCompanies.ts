import * as XLSX from 'xlsx';
import { supabase } from '../db/supabase';

const filePath = process.argv[2] || './DataSheet.xlsx';

if (!filePath) {
  console.error('❌ Debes indicar la ruta del archivo Excel.');
  process.exit(1);
}

interface CompanyAgg {
  employer_name: string;
  tax_id_last4: string;
  fiscal_year: string;
  naics: string;
  soc: string;
  city: string;
  state: string;
  zip_code: string;
  worksite_states: Set<string>;
  wage_ranges: Set<string>;
  cap_types: Set<string>;
  consular_processed: string;
  total_approved: number;
  total_denied: number;
  petition_count: number;
}

async function run() {
  console.log(`📂 Leyendo archivo: ${filePath}`);
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  // Leer la matriz cruda de celdas por posición (Fila x Columna)
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  console.log(`🔎 Procesando ${rawRows.length - 1} filas del Excel...`);

  const companies = new Map<string, CompanyAgg>();

  // MAPEO DE COLUMNAS EXACTAS DE TU EXCEL:
  // Col B (1): Fiscal Year
  // Col C (2): Cap Type
  // Col D (3): Employer (Petitioner) Name
  // Col E (4): Tax ID
  // Col F (5): Industry (NAICS) Code
  // Col G (6): Occupation (SOC) Code
  // Col H (7): Petitioner City
  // Col I (8): Petitioner State
  // Col J (9): Petitioner Zip Code
  // Col K (10): Work Site State
  // Col L (11): Consular_Processed
  // Col M (12): Hourly Wage
  // Col O (14): Total Approved Visas

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    const name = String(row[3] || '').trim();

    // Filtro de seguridad: ignora encabezados repetidos o celdas vacías
    if (!name || name.toLowerCase().includes('employer') || name.toLowerCase().includes('petitioner')) continue;

    const taxId = String(row[4] || '').trim();
    const key = `${name}__${taxId}`;

    const fiscalYear = String(row[1] || '').trim();
    const capType = String(row[2] || '').trim();
    const naics = String(row[5] || '').trim();
    const soc = String(row[6] || '').trim();
    const city = String(row[7] || '').trim();
    const state = String(row[8] || '').trim();
    const zipCode = String(row[9] || '').trim();
    const worksiteState = String(row[10] || '').trim();
    const consular = String(row[11] || '').trim();
    const wage = String(row[12] || '').trim();
    const approvedVisas = Number(row[14]) || 1;

    if (!companies.has(key)) {
      companies.set(key, {
        employer_name: name,
        tax_id_last4: taxId,
        fiscal_year: fiscalYear,
        naics: naics,
        soc: soc,
        city: city,
        state: state,
        zip_code: zipCode,
        worksite_states: new Set(),
        wage_ranges: new Set(),
        cap_types: new Set(),
        consular_processed: consular,
        total_approved: 0,
        total_denied: 0,
        petition_count: 0,
      });
    }

    const c = companies.get(key)!;
    c.total_approved += approvedVisas;
    c.petition_count += 1;

    if (worksiteState) c.worksite_states.add(worksiteState);
    if (wage) c.wage_ranges.add(wage);
    if (capType) c.cap_types.add(capType);
  }

  console.log(`📦 ${companies.size} empresas únicas consolidadas correctamente. Guardando en Supabase...`);

  const records = Array.from(companies.values()).map(c => ({
    company_key: `${c.employer_name}__${c.tax_id_last4}`,
    employer_name: c.employer_name,
    tax_id_last4: c.tax_id_last4,
    fiscal_year: c.fiscal_year,
    naics: c.naics,
    soc: c.soc,
    city: c.city,
    state: c.state,
    zip_code: c.zip_code,
    worksite_states: Array.from(c.worksite_states).sort().join(', '),
    wage_range: Array.from(c.wage_ranges).sort().join(', '),
    cap_type: Array.from(c.cap_types).sort().join(', '),
    consular_processed: c.consular_processed,
    total_approved: c.total_approved,
    total_denied: c.total_denied,
    petition_count: c.petition_count,
  }));

  const batchSize = 500;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase.from('sponsor_companies').upsert(batch, { onConflict: 'company_key' });
    if (error) {
      console.error(`❌ Error en bloque ${Math.floor(i / batchSize) + 1}:`, error.message);
    } else {
      console.log(`   ✅ Bloque ${Math.floor(i / batchSize) + 1} guardado (${batch.length} empresas)`);
    }
  }

  console.log('🎉 ¡Importación completada y columnas alineadas correctamente!');
}

run().catch(err => {
  console.error('❌ Error en la ejecución:', err.message || err);
});