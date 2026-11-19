// Días de acceso que se dan por defecto al dar de alta a alguien en el panel.
// Normal: 30. Excepción de lanzamiento: las personas NUEVAS que entran del 25-nov al 30-nov-2026 (hora de Lima)
// reciben 35. Renovaciones y reactivaciones siempre son 30, igual que los fundadores que entraron antes del 25-nov.
export const DEFAULT_ACCESS_DAYS = 30;
export const LAUNCH_ACCESS_DAYS = 35;
// Hora de Lima = UTC-5, sin horario de verano.
export const LAUNCH_WINDOW = {
  from: Date.parse('2026-11-25T05:00:00Z'), // 25-nov 00:00 Lima
  until: Date.parse('2026-12-01T05:00:00Z'), // 1-dic 00:00 Lima (no incluido)
} as const;

export function defaultAccessDays(isNewMember: boolean, now: number = Date.now()): number {
  const inLaunch = now >= LAUNCH_WINDOW.from && now < LAUNCH_WINDOW.until;
  return isNewMember && inLaunch ? LAUNCH_ACCESS_DAYS : DEFAULT_ACCESS_DAYS;
}
