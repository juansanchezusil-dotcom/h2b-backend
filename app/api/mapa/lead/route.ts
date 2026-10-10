import { NextResponse } from 'next/server';
import { adminClient } from '../../../../src/admin/auth';

// Mapa H2B público: guarda el correo de quien completó el cuestionario y aceptó que le escriban.
// Es una ruta abierta (no hay cuenta), por eso valida todo y solo guarda lo mínimo.
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Respuestas permitidas del cuestionario (todo lo demás se descarta)
const EXPERIENCE = ['directa', 'parecida', 'informal', 'ninguna'];
const ENGLISH = ['Básico', 'Intermedio', 'Avanzado'];
const YESNO = ['si', 'no', 'no_se'];

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  // Campo trampa: las personas no lo ven; si viene lleno es un programa
  if (clip(body.website, 100)) return NextResponse.json({ ok: true }, { status: 200, headers });

  const email = clip(body.email, 254).toLowerCase();
  if (!EMAIL.test(email)) return NextResponse.json({ error: 'Escribe un correo válido.' }, { status: 400, headers });
  if (body.consent !== true) {
    return NextResponse.json({ error: 'Necesitamos tu autorización para escribirte.' }, { status: 400, headers });
  }

  const a = body.answers && typeof body.answers === 'object' ? body.answers : {};
  const role = clip(a.role, 80);
  const answers = {
    role,
    experience: EXPERIENCE.includes(a.experience) ? a.experience : '',
    english: ENGLISH.includes(a.english) ? a.english : '',
    hasCv: YESNO.includes(a.hasCv) ? a.hasCv : '',
    passport: YESNO.includes(a.passport) ? a.passport : '',
  };

  const { error } = await adminClient()
    .from('map_leads')
    .upsert(
      {
        email,
        nombre: clip(body.nombre, 80) || null,
        consent_at: new Date().toISOString(),
        role: role || null,
        industry: role || null,
        stage: clip(body.stage, 20) || null,
        answers,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    );
  if (error) {
    console.error('Error guardando el correo del Mapa público:', error);
    return NextResponse.json({ error: 'No pudimos guardar tu correo. Intenta de nuevo.' }, { status: 500, headers });
  }
  return NextResponse.json({ ok: true }, { status: 200, headers });
}
