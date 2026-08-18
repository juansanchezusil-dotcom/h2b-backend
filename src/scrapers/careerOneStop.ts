import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Credenciales de Supabase no encontradas.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function cleanCompanyName(name: string): string {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(/\s+d\/b\/a\s+.*/i, '')
    .replace(/\b(inc|llc|corp|co|ltd)\b/gi, '')
    .replace(/[^a-z0-9]/gi, '')
    .trim()
}

function isValidJobTitle(title: string): boolean {
  if (!title) return false
  const lower = title.toLowerCase().trim()
  return !(
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.includes('careeronestop.org') ||
    lower.includes('naswa.org') ||
    lower.includes('directemployers.org') ||
    lower.includes('this information was retrieved') ||
    lower.length > 120
  )
}

async function forceImport() {
  const filePath = path.join(process.cwd(), 'careeronestop.xlsx')
  console.log(`📂 Leyendo archivo desde: ${filePath}`)

  const workbook = XLSX.readFile(filePath, { sheetStubs: true })
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:E100')

  let headerRowIndex = -1
  for (let R = range.s.r; R <= range.e.r; ++R) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: 0 })]
    if (cell?.v?.toString().trim().toLowerCase() === 'job title') {
      headerRowIndex = R
      break
    }
  }

  if (headerRowIndex === -1) {
    console.error('❌ No se encontró la cabecera "Job Title".')
    return
  }

  // Cargar ofertas existentes para comparar con nombres normalizados
  const { data: existingJobs } = await supabase.from('jobs').select('title, employer_name')
  const existingMap = new Set<string>()
  existingJobs?.forEach(j => {
    existingMap.add(`${cleanCompanyName(j.employer_name)}|${j.title?.toLowerCase().trim()}`)
  })

  const rawRecordsMap = new Map<string, any>()

  for (let R = headerRowIndex + 1; R <= range.e.r; ++R) {
    const titleCell = worksheet[XLSX.utils.encode_cell({ r: R, c: 0 })]
    const companyCell = worksheet[XLSX.utils.encode_cell({ r: R, c: 1 })]
    const locationCell = worksheet[XLSX.utils.encode_cell({ r: R, c: 2 })]
    const dateCell = worksheet[XLSX.utils.encode_cell({ r: R, c: 3 })]

    if (!titleCell || !titleCell.v) continue
    const jobTitle = titleCell.v.toString().trim()
    if (!isValidJobTitle(jobTitle)) continue

    const company = companyCell?.v ? companyCell.v.toString().trim() : 'Empleador Registrado'
    const normalizedKey = `${cleanCompanyName(company)}|${jobTitle.toLowerCase()}`

    // Ignorar si ya existe una versión limpia en la base de datos
    if (existingMap.has(normalizedKey)) continue

    const rawLocation = locationCell?.v ? locationCell.v.toString().trim() : ''
    let city = '', state = ''
    if (rawLocation.includes(',')) {
      const parts = rawLocation.split(',')
      state = parts.pop()?.trim() || ''
      city = parts.join(',').trim()
    } else {
      city = rawLocation
    }

    let datePosted = null
    if (dateCell?.v) {
      const rawDate = dateCell.v.toString().trim()
      const parts = rawDate.split('/')
      if (parts.length === 3) {
        datePosted = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
      }
    }

    const exactKey = `${company.toLowerCase()}|${jobTitle.toLowerCase()}`
    if (!rawRecordsMap.has(exactKey)) {
      rawRecordsMap.set(exactKey, {
        title: jobTitle,
        employer_name: company,
        city,
        state,
        start_date: datePosted,
        link: titleCell.l ? titleCell.l.Target : null,
        visa_type: 'H-2B',
        source: 'CareerOneStop'
      })
    }
  }

  const toInsert = Array.from(rawRecordsMap.values())

  if (toInsert.length === 0) {
    console.log('ℹ️ No hay ofertas nuevas. Todas las ofertas del Excel ya existen en la base de datos.')
    return
  }

  const { error } = await supabase
    .from('jobs')
    .upsert(toInsert, { onConflict: 'employer_name,title' })

  if (error) {
    console.error('❌ Error al procesar en Supabase:', error)
  } else {
    console.log(`✅ ¡Se procesaron ${toInsert.length} ofertas en Supabase correctamente!`)
  }
}

forceImport()