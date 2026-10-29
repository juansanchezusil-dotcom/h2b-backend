// Mensaje de un error atrapado. Lo que llega a un catch puede ser cualquier cosa (Error, texto, objeto);
// si no trae mensaje devuelve '' para que cada caso ponga su texto de respaldo con ||.
export function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') return err.message;
  return '';
}
