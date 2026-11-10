import type { Miembro } from './radar';
import { initials, maskEmail } from './panel';

const DAY = 24 * 60 * 60 * 1000;

export interface LogEnvio {
  user_id: string;
  kind: string;
  created_at: string;
}

export interface CorreosMiembro {
  quien: string;
  correo: string;
  estado: string;
  diasSinEntrar: number | null;
  enviados: { tipo: string; en: string }[];
  sinRespuesta: number; // correos enviados después de su última visita
  baja: boolean;
  contactadoEl: string | null;
  veredicto: { tono: 'ok' | 'aviso' | 'alto'; texto: string };
}

// Cruza el registro de correos enviados (email_log) con la actividad de cada miembro. Un correo "sin
// respuesta" es uno enviado después de la última vez que la persona entró a la app. No sabemos si lo abrió:
// el registro solo guarda el envío.
export function correosPorMiembro(
  miembros: Miembro[],
  userIdByEmail: Map<string, string>,
  logs: LogEnvio[],
  optout: Set<string>,
  now: number,
  mostrar: boolean
): CorreosMiembro[] {
  const byUser = new Map<string, LogEnvio[]>();
  for (const l of logs) {
    const list = byUser.get(l.user_id) || [];
    list.push(l);
    byUser.set(l.user_id, list);
  }

  const rows = miembros.map((m): CorreosMiembro => {
    const userId = userIdByEmail.get(m.email);
    const propios = (userId ? byUser.get(userId) || [] : [])
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const sinRespuesta =
      m.diasSinEntrar === null
        ? propios.length
        : propios.filter((l) => (now - new Date(l.created_at).getTime()) / DAY < m.diasSinEntrar!).length;
    const baja = !!userId && optout.has(userId);

    let veredicto: CorreosMiembro['veredicto'];
    if (baja) veredicto = { tono: 'aviso', texto: 'Se dio de baja de los correos. No se le escribe.' };
    else if (sinRespuesta >= 2) veredicto = { tono: 'alto', texto: `${sinRespuesta} correos sin que vuelva. El correo ya no funciona con esta persona: escríbele tú.` };
    else if (sinRespuesta === 1) veredicto = { tono: 'aviso', texto: '1 correo sin que vuelva todavía.' };
    else if (propios.length) veredicto = { tono: 'ok', texto: 'Volvió a entrar después del último correo.' };
    else veredicto = { tono: 'ok', texto: 'No se le ha enviado ningún correo automático.' };

    return {
      quien: mostrar ? m.nombre || m.email : initials(m.nombre || m.email),
      correo: mostrar ? m.email : maskEmail(m.email),
      estado: m.estado,
      diasSinEntrar: m.diasSinEntrar,
      enviados: propios.slice(0, 8).map((l) => ({ tipo: l.kind, en: l.created_at })),
      sinRespuesta,
      baja,
      contactadoEl: m.contactadoEl,
      veredicto,
    };
  });

  const peso = { alto: 0, aviso: 1, ok: 2 } as const;
  return rows.sort((a, b) => peso[a.veredicto.tono] - peso[b.veredicto.tono] || b.sinRespuesta - a.sinRespuesta);
}
