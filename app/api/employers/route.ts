export const dynamic = 'force-dynamic';
import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('sponsor_companies')
      .select('*')
      .limit(500)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const formattedCompanies = (data || []).map((item) => ({
      id: item.id,
      employer: item.employer_name,
      name: item.employer_name,
      state: item.state || item.city || 'N/A',
      worker_requested: item.petition_count ?? 0,
      worker_approved: item.total_approved ?? 0, 
      year: item.fiscal_year || '2026',
      industry: item.naics ? `NAICS: ${item.naics}` : 'N/A',
      wage: item.wage_range || 'No especificado',
      location: [item.city, item.state].filter(Boolean).join(', ') || 'EE. UU.',
      naics: item.naics || '',
      soc: item.soc || ''
    }))

    return NextResponse.json(formattedCompanies, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}