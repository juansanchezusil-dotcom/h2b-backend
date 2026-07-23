import { NextResponse } from 'next/server';
import { supabase } from '../../../src/db/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('employers')
    .select('*')
    .order('year', { ascending: false });

  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json(data);
}
