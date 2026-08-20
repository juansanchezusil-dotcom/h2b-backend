export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabase } from '@/src/db/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase.from('agencies').select('*');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}