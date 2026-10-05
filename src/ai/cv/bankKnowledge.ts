// Fase 2.1: conocimiento por puesto, además de las preguntas de industryBanks.ts.
// Para cada puesto define cuándo aplica cada ruta (A/B/C), qué respuestas deben hacer profundizar
// (posible exageración), qué habilidades transfieren de verdad, qué evidencia concreta vale la pena
// pedir y qué palabras clave del puesto se pueden usar en el CV (solo si los datos las respaldan).

export interface BankKnowledge {
  routes: { A: string; B: string; C: string };
  redFlags: string[];
  transferable: string[];
  evidence: string[];
  keywords: string[]; // en inglés, para el CV
}

export const KNOWLEDGE: Record<string, BankKnowledge> = {
  housekeeping: {
    routes: {
      A: 'limpió habitaciones o espacios de alojamiento (hotel, motel, resort) de forma regular',
      B: 'limpieza en otros lugares (restaurantes, oficinas, negocios) o trabajo de servicio con tareas parecidas',
      C: 'limpieza de su casa o la de familiares, o ayuda ocasional en un negocio familiar',
    },
    redFlags: [
      'dice "hice de todo" sin detallar tareas',
      'da cifras de habitaciones sin explicar el ritmo del turno',
      'afirma usar productos o máquinas profesionales sin decir cuáles',
      'dice que "supervisaba" sin decir a quién',
    ],
    transferable: [
      'limpieza de cocina o restaurante',
      'limpieza de casas o de un negocio familiar',
      'orden y limpieza en una tienda',
      'trabajo físico de varias horas',
      'seguir una lista de tareas por turno',
    ],
    evidence: [
      'una habitación o un turno típico, paso a paso',
      'qué producto usaba para baños y cuál para vidrios',
      'cuántas habitaciones hacía en un turno normal y con qué ritmo',
      'una vez que tuvo que repetir una limpieza y por qué',
    ],
    keywords: ['housekeeping', 'room cleaning', 'bed making', 'linen change', 'sanitizing', 'vacuuming', 'restocking supplies', 'guest rooms', 'attention to detail'],
  },
  landscaping: {
    routes: {
      A: 'mantuvo jardines, césped o áreas verdes como trabajo regular',
      B: 'agricultura, finca o trabajo exterior con herramientas manuales o máquinas',
      C: 'cuidado de terrenos de la familia o ayuda ocasional en jardines',
    },
    redFlags: [
      'nombra máquinas sin decir si las usó él o ella',
      'dice "landscaper" sin describir tareas',
      'menciona motosierra o pesticidas sin hablar de capacitación',
      'confunde trabajo agrícola con landscaping',
    ],
    transferable: [
      'agricultura o trabajo de finca',
      'mantenimiento de terrenos familiares',
      'trabajo al aire libre con herramientas manuales',
      'cuidado de jardines de vecinos',
      'trabajo físico con sol, lluvia o frío',
    ],
    evidence: [
      'una jornada típica de trabajo',
      'qué máquina usaba, directamente o no, y por cuánto tiempo',
      'qué hacía con la maleza y los restos',
      'trabajos de temporada que haya hecho',
    ],
    keywords: ['landscaping', 'lawn mowing', 'string trimmer', 'leaf blower', 'hedge trimming', 'planting', 'mulching', 'weeding', 'grounds maintenance', 'outdoor work', 'hand tools'],
  },
  construction: {
    routes: {
      A: 'trabajó en obra como empleado o ayudante de forma regular',
      B: 'oficios relacionados (pintura, carpintería, mantenimiento) o ayuda a un maestro de obra',
      C: 'proyectos en su casa o con familiares',
    },
    redFlags: [
      '"ayudaba con electricidad" o "con plomería" sin decir qué hacía',
      '"de todo" sin concretar',
      'maquinaria pesada sin decir si la manejaba',
      'certificaciones de seguridad que no confirma',
    ],
    transferable: [
      'carpintería o pintura informal',
      'reparaciones en casa propia o de familiares',
      'trabajo físico pesado',
      'ayudante de un maestro de obra',
      'uso de herramientas manuales y eléctricas',
    ],
    evidence: [
      'una obra concreta y qué hizo él o ella personalmente',
      'qué herramientas usó directamente',
      'qué hacía solo y en qué solo ayudaba',
      'medidas de seguridad que seguía',
    ],
    keywords: ['construction laborer', 'site preparation', 'material handling', 'demolition', 'concrete', 'drywall', 'framing', 'painting', 'hand tools', 'power tools', 'safety procedures'],
  },
  cook: {
    routes: {
      A: 'cocinó en restaurante, hotel o comedor como empleo',
      B: 'ayudante de cocina, panadería o venta de comida',
      C: 'cocina familiar o para eventos ocasionales',
    },
    redFlags: [
      'dice "chef" sin describir tareas',
      'da cifras de personas atendidas sin explicarlas',
      'certificaciones de manejo de alimentos que no confirma',
      'dice dominar técnicas que no puede describir',
    ],
    transferable: [
      'cocina de un negocio familiar o venta de comida',
      'preparar comida para muchas personas en casa o eventos',
      'cocina de una iglesia o comedor comunitario',
      'limpieza de cocina',
    ],
    evidence: [
      'un servicio de mucho movimiento',
      'qué platos preparaba y para cuántas personas',
      'cómo evitaba la contaminación cruzada',
      'qué equipos manejaba',
    ],
    keywords: ['food preparation', 'line cook', 'prep cook', 'grill', 'fryer', 'kitchen sanitation', 'food safety', 'knife skills', 'high-volume kitchen', 'dishwashing'],
  },
  maintenance: {
    routes: {
      A: 'trabajó en mantenimiento de edificios o propiedades',
      B: 'oficios afines (construcción, carpintería, mecánica) o mantenimiento informal frecuente',
      C: 'reparaciones en su hogar o con familiares',
    },
    redFlags: [
      '"arreglo todo" sin ejemplos',
      'dice electricidad o plomería sin precisar qué hace',
      'no distingue lo que hace solo de lo que solo ayuda',
      'menciona herramientas de diagnóstico sin explicar su uso',
    ],
    transferable: [
      'reparaciones de casa propia o de la familia',
      'mantenimiento de una finca o negocio familiar',
      'mecánica o carpintería informal',
      'instalaciones básicas',
    ],
    evidence: [
      'un problema que diagnosticó y reparó, con los pasos',
      'qué reparaciones hace completamente solo',
      'cuáles no sabe hacer',
      'mantenimiento preventivo que haya hecho',
    ],
    keywords: ['general maintenance', 'preventive maintenance', 'repairs', 'troubleshooting', 'painting', 'drywall repair', 'basic plumbing', 'basic electrical', 'hand tools', 'work orders'],
  },
  bartender: {
    routes: {
      A: 'trabajó en una barra como empleado',
      B: 'servicio de mesa, cafetería o ventas con atención directa al cliente',
      C: 'atención informal al público',
    },
    redFlags: [
      'dice saber cócteles que no puede describir',
      'certificaciones de servicio de alcohol que no confirma',
      'dice inglés "fluido" sin ningún ejemplo',
      'inventa volumen de clientes o bebidas',
    ],
    transferable: ['servicio de mesa o atención al cliente', 'atención en tiendas o restaurantes', 'preparar bebidas en un negocio familiar', 'manejo de caja'],
    evidence: [
      'un servicio de mucho movimiento',
      'cócteles que prepara sin receta',
      'cómo manejó un cliente difícil',
      'una conversación real en inglés con clientes',
    ],
    keywords: ['bartending', 'cocktail preparation', 'bar service', 'POS system', 'cash handling', 'inventory', 'customer service', 'glassware', 'high-volume bar'],
  },
  server: {
    routes: {
      A: 'sirvió mesas como empleado en restaurante, hotel o eventos',
      B: 'atención al público o ayudante en un restaurante',
      C: 'servicio ocasional en eventos o negocio familiar',
    },
    redFlags: [
      'inventa la cantidad de mesas o comensales',
      'dice inglés fluido sin ningún ejemplo',
      'capacitación de alcohol que no confirma',
    ],
    transferable: ['atención al cliente en tienda o negocio familiar', 'cafetería', 'eventos', 'ayudante de cocina que también sirve'],
    evidence: ['cuántas mesas atendía a la vez', 'cómo tomaba un pedido', 'cómo manejó una queja', 'una conversación real en inglés con comensales'],
    keywords: ['server', 'table service', 'taking orders', 'POS', 'customer service', 'menu knowledge', 'banquet service', 'bussing', 'teamwork'],
  },
  frontdesk: {
    routes: {
      A: 'trabajó en recepción de hotel, clínica u oficina',
      B: 'atención al cliente o administración con computadora',
      C: 'atención informal en un negocio familiar',
    },
    redFlags: [
      'dice conocer un software de reservas sin haberlo usado',
      'dice ser "bilingüe" sin ejemplos',
      'inventa cifras de llamadas o reservas',
    ],
    transferable: ['atención al cliente en tienda, oficina o clínica', 'recepción o secretaría en un negocio familiar', 'call center', 'tareas administrativas con computadora'],
    evidence: ['cómo hacía un check-in', 'qué programa usaba y para qué', 'cómo manejó una queja', 'llamadas o correos reales en inglés'],
    keywords: ['front desk', 'guest check-in', 'check-out', 'reservations', 'customer service', 'phone etiquette', 'cash handling', 'problem solving'],
  },
  bellhop: {
    routes: {
      A: 'trabajó de botones, maletero o portero en un hotel',
      B: 'atención al público con trabajo físico',
      C: 'ayuda ocasional en un hotel o negocio familiar',
    },
    redFlags: ['dice inglés fluido sin ningún ejemplo', 'inventa la cantidad de huéspedes o maletas'],
    transferable: ['atención al público', 'cargar y entregar mercancía', 'portero o valet', 'trabajo físico de pie'],
    evidence: ['cómo recibía a un huésped', 'una situación difícil con un huésped', 'indicaciones que haya dado en inglés'],
    keywords: ['bellhop', 'luggage handling', 'guest services', 'lobby', 'customer service', 'teamwork', 'physical stamina', 'hospitality'],
  },
  driver: {
    routes: {
      A: 'trabajó como conductor profesional (empleo)',
      B: 'reparto o transporte ocasional con vehículo de trabajo',
      C: 'manejo personal o familiar',
    },
    redFlags: ['asume licencia de EE. UU. o CDL', 'inventa kilómetros o años manejando', 'no confirma el tipo de vehículo'],
    transferable: ['reparto informal', 'transporte de un negocio o de la familia', 'mensajería', 'manejo de vehículos de trabajo'],
    evidence: ['tipo de vehículo y rutas', 'cómo revisaba el vehículo antes de salir', 'qué licencia exacta tiene y de qué país'],
    keywords: ['driver', 'delivery driver', 'route planning', 'GPS navigation', 'vehicle inspection', 'loading and unloading', 'safe driving', 'logbook'],
  },
  electrician: {
    routes: {
      A: 'trabajó como electricista o ayudante de electricista de forma regular',
      B: 'mantenimiento o construcción con tareas eléctricas',
      C: 'instalaciones eléctricas básicas en su hogar',
    },
    redFlags: [
      '"ayudaba con electricidad" sin tareas concretas',
      'presenta una licencia de otro país como válida en EE. UU.',
      'no confirma voltajes ni equipos',
    ],
    transferable: ['ayudante de electricista', 'mantenimiento con electricidad básica', 'instalaciones del hogar', 'mecánica o electrónica informal'],
    evidence: ['una instalación o falla concreta y los pasos', 'qué medía con un multímetro', 'cómo cortaba la corriente antes de trabajar'],
    keywords: ['electrical installation', 'wiring', 'circuit breakers', 'conduit', 'troubleshooting', 'multimeter', 'lockout/tagout', 'electrician helper'],
  },
  carpenter: {
    routes: {
      A: 'trabajó como carpintero, empleado o independiente, de forma regular',
      B: 'construcción o ayudante de carpintería',
      C: 'proyectos de madera en su casa',
    },
    redFlags: [
      'dice usar herramientas de taller sin uso real',
      'presenta la ayuda a un maestro como oficio independiente',
      'no explica cómo lograba precisión',
    ],
    transferable: ['ayudante de carpintería', 'construcción', 'fabricación informal de muebles', 'reparaciones en casa'],
    evidence: ['un proyecto y qué hizo él o ella', 'cómo se aseguraba de que las medidas fueran exactas', 'qué herramientas manejaba solo'],
    keywords: ['carpentry', 'framing', 'finish carpentry', 'cabinetry', 'measuring and cutting', 'power tools', 'blueprint reading', 'woodworking'],
  },
  foodprocessing: {
    routes: {
      A: 'trabajó en una planta de alimentos o empacadora',
      B: 'producción, bodega o cocina industrial',
      C: 'trabajo repetitivo informal (empaque familiar, por ejemplo)',
    },
    redFlags: [
      'dice tener BPM o HACCP sin confirmarlo',
      'menciona montacargas sin licencia confirmada',
      'inventa metas de producción',
    ],
    transferable: ['línea de producción de otra industria', 'empaque o bodega', 'cocina industrial', 'trabajo físico repetitivo'],
    evidence: ['qué puesto tenía en la línea', 'qué producto y a qué ritmo', 'qué reglas de higiene seguía', 'en qué ambiente trabajaba (frío, húmedo)'],
    keywords: ['food processing', 'production line', 'packing', 'sorting', 'quality inspection', 'sanitation', 'cold environment', 'repetitive tasks', 'physical stamina'],
  },
};

const list = (items: string[]) => items.map((i) => `  - ${i}`).join('\n');

// Bloque para el prompt de la entrevista
export function renderKnowledgeForInterview(bankId: string): string {
  const k = KNOWLEDGE[bankId];
  if (!k) return '';
  return `CRITERIOS DE RUTA PARA ESTE PUESTO:
  - A: ${k.routes.A}
  - B: ${k.routes.B}
  - C: ${k.routes.C}
SEÑALES DE ALERTA (si aparecen, profundiza antes de guardar nada):
${list(k.redFlags)}
HABILIDADES TRANSFERIBLES LEGÍTIMAS (solo si la persona las respalda con algo real):
${list(k.transferable)}
EVIDENCIAS CONCRETAS QUE VALE LA PENA PEDIR (sin inducir la respuesta):
${list(k.evidence)}`;
}

// Bloque para el prompt del CV: palabras clave y habilidades transferibles, siempre sujetas a evidencia
export function renderKnowledgeForCv(bankId: string): string {
  const k = KNOWLEDGE[bankId];
  if (!k) return '';
  return `Palabras clave del puesto (úsalas SOLO si los datos del candidato las respaldan; sin evidencia, no las uses): ${k.keywords.join(', ')}
Habilidades transferibles legítimas (úsalas solo si hay datos que las respalden): ${k.transferable.join('; ')}
`;
}
