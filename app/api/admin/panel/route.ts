import { NextResponse } from 'next/server';
import { adminClient, requireAdmin } from '../../../../src/admin/auth';
import { loadPanelData, saveSnapshot } from '../../../../src/admin/loadPanel';
import { buildPanel, parseFilters } from '../../../../src/admin/panel';

export const dynamic = 'force-dynamic';

const VISTAS = ['resumen', 'miembros', 'radar', 'operacion'];

// Datos de las 4 vistas del panel (resumen, miembros, radar, operación). Solo administradores.
// Parámetros: vista, dias, plan, estado, etapa, puesto, pais, cohorte, mostrar=1 (muestra correos y nombres).
// Por defecto los correos salen enmascarados.
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const vista = params.get('vista') || 'resumen';
  if (!VISTAS.includes(vista)) return NextResponse.json({ error: 'Vista no reconocida' }, { status: 400 });
  const filters = parseFilters(params);

  try {
    const supabase = adminClient();
    const data = await loadPanelData(supabase, Date.now(), filters.dias);
    // La primera visita del día deja la foto diaria, por si el cron no corrió. Un fallo aquí no rompe el panel.
    if (vista === 'resumen') {
      await saveSnapshot(supabase, data).catch((err) => console.warn('No se pudo guardar la foto diaria:', err?.message || err));
    }
    return NextResponse.json(buildPanel(data, filters, vista, params.get('mostrar') === '1'));
  } catch (err) {
    console.error('Error calculando el panel:', err);
    return NextResponse.json({ error: 'No se pudo cargar el panel.' }, { status: 500 });
  }
}
