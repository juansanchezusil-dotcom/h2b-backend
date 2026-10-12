import { NextResponse } from 'next/server';
import { adminClient } from '../../../../src/admin/auth';
import { readLeadAccessToken } from '../../../../src/email/unsubscribe';
import { allowRequest } from '../../../../src/auth/rateLimit';

export const dynamic = 'force-dynamic';

// Entrega las respuestas del cuestionario a quien trae el enlace firmado que le llegó al correo.
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: Request) {
  if (!(await allowRequest(request, 'mapa_respuestas', 30, 3600))) {
    return NextResponse.json({ error: 'Demasiados intentos. Intenta de nuevo en un rato.' }, { status: 429, headers });
  }
  const leadId = readLeadAccessToken(new URL(request.url).searchParams.get('t'));
  if (!leadId) return NextResponse.json({ error: 'El enlace venció o no es válido. Pide uno nuevo.' }, { status: 400, headers });

  const { data, error } = await adminClient().from('map_leads').select('answers').eq('id', leadId).maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'No encontramos tu mapa.' }, { status: 404, headers });
  return NextResponse.json({ answers: data.answers }, { status: 200, headers });
}
