export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabase } from '@/src/db/supabase';
import { requireMember } from '@/src/auth/member';

export async function GET(request: Request) {
  // Estas rutas usan la llave de servicio (no pasan por RLS): sin esto, cualquiera descargaba el catálogo
  const blocked = await requireMember(request);
  if (blocked) return blocked;

  try {
    const { data, error } = await supabase.from('sponsor_agencies').select('*').limit(2000);

    if (error) {
      console.error('Error leyendo agencias:', error);
      return NextResponse.json({ error: 'No se pudieron cargar las agencias.' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error en /api/agencias:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}