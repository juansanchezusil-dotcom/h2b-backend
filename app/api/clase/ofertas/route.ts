import { NextResponse } from 'next/server';
import { adminClient } from '../../../../src/admin/auth';

// Ofertas de la clase, para el dashboard de la masterclass (página pública: quienes asisten no siempre
// tienen cuenta). Solo devuelve lo que el administrador publicó: puesto, empresa, estado, enlace y nota.
// No hay datos de personas.
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}

export async function GET() {
  const { data, error } = await adminClient()
    .from('class_offers')
    .select('id, job_title, company_name, state, url, note, created_at')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) {
    console.error('Error leyendo las ofertas de la clase:', error);
    return NextResponse.json({ ofertas: [] }, { status: 200, headers });
  }
  return NextResponse.json({ ofertas: data || [] }, { status: 200, headers });
}
