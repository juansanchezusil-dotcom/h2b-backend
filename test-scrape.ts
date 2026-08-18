import dotenv from 'dotenv'
import fetch from 'node-fetch'

dotenv.config()

const USER_ID = process.env.CAREERONESTOP_USER_ID?.trim()
const API_KEY = process.env.CAREERONESTOP_API_KEY?.trim()

async function testCareerOneStop() {
  console.log(`Ejecutando consulta con USER_ID: "${USER_ID}"`)

  const keyword = 'H2B'
  const location = 'US'
  const radius = '0'
  const sortColumns = '0'
  const sortOrder = '0'
  const startRecord = '0'
  const pageSize = '10'
  const days = '0'

  const url = `https://api.careeronestop.org/v1/jobsearch/${USER_ID}/${encodeURIComponent(keyword)}/${location}/${radius}/${sortColumns}/${sortOrder}/${startRecord}/${pageSize}/${days}`

  // Opción 1: Bearer estándar
  console.log('Probrando Opción 1 (Authorization: Bearer)...')
  let res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    }
  })

  // Opción 2: Cabecera custom de CareerOneStop
  if (!res.ok) {
    console.log('Probrando Opción 2 (Header userId + APIKey)...')
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'userId': `${USER_ID}`,
        'APIKey': `${API_KEY}`
      }
    })
  }

  // Opción 3: Token directo sin Bearer
  if (!res.ok) {
    console.log('Probrando Opción 3 (Authorization: Key)...')
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${API_KEY}`
      }
    })
  }

  if (!res.ok) {
    console.error(`❌ Ningún formato funcionó. Error HTTP ${res.status}: ${res.statusText}`)
    const errorText = await res.text()
    console.error('Detalle:', errorText)
    return
  }

  const data = await res.json()
  console.log('✅ Conexión exitosa a CareerOneStop!')
  console.log(`Ofertas encontradas: ${data.Jobs?.length || 0}`)
  console.log(JSON.stringify(data.Jobs?.slice(0, 2), null, 2))
}

testCareerOneStop()