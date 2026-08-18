import XLSX from 'xlsx'
import path from 'path'
import { supabase } from '../db/supabase.js'

async function importAgencies() {
  try {
    const filePath = path.resolve(process.cwd(), 'agencias2026.xlsx')
    console.log(`📂 Leyendo archivo: ./${path.basename(filePath)}`)

    const workbook = XLSX.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    const rows: any[] = XLSX.utils.sheet_to_json(worksheet)
    console.log(`📊 ${rows.length} filas encontradas. Procesando agencias...`)

    const agenciasMap = new Map<string, any>()

    for (const row of rows) {
      const reclutador = (row['Nombre completo del Reclutador'] || '').toString().trim()
      const agencyName = (row['Nombre de la Agencia'] || '').toString().trim()
      const country = (row['País'] || row['Pais'] || '').toString().trim()
      const website = (row['Página web oficial'] || row['Pagina web oficial'] || '').toString().trim()

      if (!agencyName && !reclutador) continue

      const finalAgencyName = agencyName || reclutador
      const key = `${finalAgencyName.toLowerCase()}_${country.toLowerCase()}`

      if (!agenciasMap.has(key)) {
        agenciasMap.set(key, {
          agency_name: reclutador && agencyName ? `${agencyName} (${reclutador})` : finalAgencyName,
          country: country || 'N/A',
          website: website || null // <--- ¡AHORA SÍ LO ENVÍA A SUPABASE!
        })
      }
    }

    const agenciasToInsert = Array.from(agenciasMap.values())
    console.log(`📦 ${agenciasToInsert.length} agencias/reclutadores únicos listos para insertar.`)

    if (agenciasToInsert.length === 0) {
      console.log('⚠️ No se encontraron agencias válidas para procesar.')
      return
    }

    console.log('🚀 Subiendo a Supabase...')

    const BATCH_SIZE = 100
    for (let i = 0; i < agenciasToInsert.length; i += BATCH_SIZE) {
      const chunk = agenciasToInsert.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('sponsor_agencies').insert(chunk)

      if (error) {
        console.error(`❌ Error en bloque ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message)
      } else {
        console.log(`✅ Bloque ${Math.floor(i / BATCH_SIZE) + 1} insertado con éxito.`)
      }
    }

    console.log('🎉 ¡Importación de agencias realizada con éxito!')
  } catch (error: any) {
    console.error('❌ Error general durante la importación:', error.message || error)
  }
}

importAgencies()