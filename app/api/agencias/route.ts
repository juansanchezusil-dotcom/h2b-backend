export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const filePath = process.argv[2] || './DataSheet.xlsx'
  console.log(`📂 Leyendo archivo: ${filePath}`)

  const workbook = XLSX.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName])

  console.log(`📊 ${rows.length} filas encontradas en el Excel. Procesando agencias...`)

  const agenciesData = rows.map((row) => ({
    name: row.name || row.Nombre || row.agency_name || 'Agencia sin nombre',
    country: row.country || row.Pais || row.País || 'No especificado',
    website: row.website || row.Web || row.SitioWeb || '#',
  }))

  console.log('🚀 Subiendo a Supabase...')
  
  // Subir en bloques de 500 por seguridad
  const batchSize = 500
  for (let i = 0; i < agenciesData.length; i += batchSize) {
    const batch = agenciesData.slice(i, i + batchSize)
    const { error } = await supabase.from('agencies').upsert(batch, { onConflict: 'name' })

    if (error) {
      console.error(`❌ Error en bloque ${i / batchSize + 1}:`, error.message)
    } else {
      console.log(`✅ Bloque ${i / batchSize + 1} guardado (${batch.length} agencias)`)
    }
  }

  console.log('🎉 ¡Importación de agencias finalizada con éxito!')
}

run()