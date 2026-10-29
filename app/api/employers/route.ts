export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabase } from '@/src/db/supabase';
import { requireMember } from '@/src/auth/member';

export async function GET(request: Request) {
  // Estas rutas usan la llave de servicio (no pasan por RLS): sin esto, cualquiera descargaba el catálogo
  const blocked = await requireMember(request);
  if (blocked) return blocked;

  try {
    const { data, error } = await supabase
      .from('sponsor_companies')
      .select('id, employer_name, state, city, petition_count, total_approved, fiscal_year, naics, wage_range, soc')
      .limit(500);

    if (error) {
      console.error('Error leyendo empresas:', error);
      return NextResponse.json({ error: 'No se pudieron cargar las empresas.' }, { status: 500 });
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
    }));

    return NextResponse.json(formattedCompanies, { status: 200 });
  } catch (err) {
    console.error('Error en /api/employers:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}