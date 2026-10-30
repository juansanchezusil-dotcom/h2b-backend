// Datos que llegan de fuera (respuesta del modelo, cuerpo del pedido, APIs externas) sin forma garantizada.
// Se leen campo por campo y cada campo se valida donde se usa, en vez de confiar en un `any`.
export type Raw = Record<string, unknown>;

export const asRaw = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {});

export const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
