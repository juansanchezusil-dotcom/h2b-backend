import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const RETENCION_DIAS = 90;

export interface PreguntaGuardada {
  pregunta: string;
  respuesta: string;
  deriva: boolean;
  pantalla: string;
}

// Guarda la pregunta y la respuesta del asistente, sin ningún dato de la persona. Nunca lanza: si falla,
// solo avisa en el log y la persona recibe su respuesta igual.
export async function guardarPregunta(p: PreguntaGuardada): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    const { error } = await createClient(url, key)
      .from('asistente_preguntas')
      .insert({ pregunta: p.pregunta.slice(0, 600), respuesta: p.respuesta.slice(0, 1200), deriva: p.deriva, pantalla: p.pantalla || null });
    if (error) console.warn('No se pudo guardar la pregunta del asistente:', error.message);
  } catch (err) {
    console.warn('No se pudo guardar la pregunta del asistente:', err);
  }
}

// Borra lo que supera la retención. Lo llama el proceso diario.
export async function borrarPreguntasViejas(supabase: SupabaseClient, now = Date.now()): Promise<number> {
  const limite = new Date(now - RETENCION_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from('asistente_preguntas').delete().lt('created_at', limite).select('id');
  if (error) {
    console.warn('No se pudieron borrar las preguntas viejas del asistente:', error.message);
    return 0;
  }
  return data?.length ?? 0;
}
