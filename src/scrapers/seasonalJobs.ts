import admZip from 'adm-zip';
import { supabase } from '../db/supabase';

export async function scrapeSeasonalJobs() {
  console.log('🚀 Descargando Feed Oficial de datos H-2B (DOL)...');

  try {
    const today = new Date().toISOString().split('T')[0];
    const url = `https://api.seasonaljobs.dol.gov/datahub-search/sjCaseData/zip/h2b/${today}`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    if (!response.ok) throw new Error(`El servidor devolvió status ${response.status}`);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const zip = new admZip(buffer);
    const zipEntries = zip.getEntries();
    if (zipEntries.length === 0) throw new Error('El archivo ZIP está vacío.');

    const jsonFile = zipEntries[0];
    const rawData = JSON.parse(jsonFile.getData().toString('utf8'));
    const records: any[] = Array.isArray(rawData) ? rawData : (rawData.data || rawData.cases || []);

    console.log(`🔎 Se obtuvieron ${records.length} registros. Procesando datos...`);

    if (records.length === 0) return;

    // Extractor profundo capaz de leer propiedades directas, anidadas u objetos anidables
    const getDeepVal = (item: any, keysToSearch: string[]) => {
      if (!item) return null;

      // 1. Revisa todas las llaves de la raíz (ignorando mayúsculas/minúsculas)
      const rootKeys = Object.keys(item);
      for (const targetKey of keysToSearch) {
        const cleanTarget = targetKey.toLowerCase();
        const foundKey = rootKeys.find(k => k.toLowerCase() === cleanTarget);
        if (foundKey && item[foundKey] !== null && item[foundKey] !== undefined && item[foundKey] !== '') {
          return item[foundKey];
        }
      }

      // 2. Respaldo: si el dato no está en la raíz, revisa el primer worksite
      // adicional (employmentLocations), que usa el prefijo apdxa*
      const subContainers = [
        Array.isArray(item.employmentLocations) ? item.employmentLocations[0] : null
      ].filter(Boolean);

      for (const container of subContainers) {
        if (typeof container === 'object') {
          const containerKeys = Object.keys(container);
          for (const targetKey of keysToSearch) {
            const cleanTarget = targetKey.toLowerCase();
            const foundKey = containerKeys.find(k => k.toLowerCase() === cleanTarget);
            if (foundKey && container[foundKey] !== null && container[foundKey] !== undefined && container[foundKey] !== '') {
              return container[foundKey];
            }
          }
        }
      }

      return null;
    };

    const jobsToSave = records.map((item: any) => {
      const caseNum = getDeepVal(item, ['caseNumber', 'casenumber', 'case_number', 'id']);
      if (!caseNum) return null;

      // Título
      const title = getDeepVal(item, ['tempneedJobtitle', 'jobTitle', 'jobtitle', 'tempneedSocTitle', 'title']) || 'Trabajador H-2B';

      // Empresa — nombre real confirmado por diagnóstico: empBusinessName
      const employer = getDeepVal(item, [
        'empBusinessName', 'empTradeName', 'empName', 'employerName'
      ]) || 'Empresa Registrada';

      // Salario — nombres reales confirmados: wageFrom, wageTo, wagePer (root, no anidado)
      const wageVal = getDeepVal(item, ['wageFrom', 'wageTo']);
      const wageUnit = getDeepVal(item, ['wagePer']) || 'hr';
      const wageFormatted = wageVal ? `$${wageVal} / ${String(wageUnit).toLowerCase()}` : 'Salario no especificado';

      // Ubicación — nombres reales confirmados: jobCity, jobState (worksite principal)
      const city = getDeepVal(item, ['jobCity', 'empCity', 'apdxaCity']) || '';
      const state = getDeepVal(item, ['jobState', 'empState', 'apdxaState']) || '';
      const location = city && state ? `${city}, ${state}` : (state || city || 'EE. UU.');

      // Contacto y detalles — nombres reales confirmados
      const phone = getDeepVal(item, ['emppocPhone', 'empPhone']) || null;
      const email = getDeepVal(item, ['emppocEmail']) || null;
      const duties = getDeepVal(item, ['tempneedDescription', 'jobDuties', 'jobDescription']) || null;
      const workers = getDeepVal(item, ['tempneedWkrPos', 'nbrWorkersRequested', 'numberOfWorkersRequested', 'workersRequested']) || 0;
      const fullTime = getDeepVal(item, ['fullTimePosition', 'fullTime']) || 'Yes';

      // Fechas
      const beginDate = getDeepVal(item, ['tempneedStart', 'jobstartdate', 'begin_date', 'jobStartDate']);
      const endDate = getDeepVal(item, ['tempneedEnd', 'jobenddate', 'end_date', 'jobEndDate']);

      const pdfUrl = getDeepVal(item, ['jobOrderUrl', 'pdfUrl']) || `https://seasonaljobs.dol.gov/job-order/${caseNum}`;

      return {
        title: String(title),
        employer_name: String(employer),
        location: String(location),
        wage: String(wageFormatted),
        begin_date: beginDate ? String(beginDate) : null,
        end_date: endDate ? String(endDate) : null,
        case_number: String(caseNum),
        job_order_pdf_url: String(pdfUrl),
        phone_to_apply: phone ? String(phone) : null,
        email_to_apply: email ? String(email) : null,
        job_duties: duties ? String(duties) : null,
        workers_requested: Number(workers) || 0,
        full_time: String(fullTime)
      };
    }).filter(Boolean);

    // Muestra los primeros 2 elementos transformados para verificar en terminal
    console.log('\n--- MUESTRA DE DATOS MAPEADOS ---');
    console.log(jobsToSave.slice(0, 2));

    console.log(`\n📦 Guardando/Actualizando ${jobsToSave.length} ofertas en Supabase...`);

    const batchSize = 300;
    for (let i = 0; i < jobsToSave.length; i += batchSize) {
      const batch = jobsToSave.slice(i, i + batchSize);
      const { error } = await supabase.from('jobs').upsert(batch, { onConflict: 'case_number' });

      if (error) {
        console.error(`❌ Error en bloque ${i / batchSize + 1}:`, error.message);
      }
    }

    console.log(`✅ ¡Sincronización completada!`);

  } catch (err: any) {
    console.error('❌ Error durante la ejecución:', err.message || err);
  }
}