export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabase } from '@/src/db/supabase';

export async function GET() {
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