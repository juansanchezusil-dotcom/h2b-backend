// Bancos de preguntas por puesto para la entrevista del CV. Son un MENÚ de temas que el
// modelo consulta para elegir la siguiente pregunta; no un cuestionario: se hace UNA pregunta
// por turno y solo de lo que falta o de lo que la respuesta anterior abrió.

export interface QuestionSection {
  title: string;
  questions: string[];
}

export interface Bank {
  id: string;
  label: string;
  // Palabras (en español e inglés) que, dentro del puesto o la industria, activan este banco
  match: RegExp;
  sections: QuestionSection[];
  // Reglas de veracidad propias de este oficio
  rules: string[];
}

export const BANKS: Bank[] = [
  {
    id: 'housekeeping',
    label: 'Housekeeping / Hotel',
    match: /housekeep|\bmaids?\b|room attendant|janitor|cleaner|limpieza|camarer|aseo|hosped/i,
    sections: [
      {
        title: 'Experiencia general',
        questions: [
          '¿Has trabajado en hoteles, moteles, resorts, casas, apartamentos o empresas de limpieza?',
          '¿Qué tipo de lugares has limpiado y durante cuánto tiempo?',
          '¿Era un trabajo formal, familiar, independiente, temporal o por cuenta propia?',
          '¿Cuántas habitaciones, casas o espacios atendías en un día normal?',
        ],
      },
      {
        title: 'Tareas',
        questions: [
          '¿Limpiabas habitaciones, baños, pisos, ventanas o espejos?',
          '¿Cambiabas sábanas y hacías las camas?',
          '¿Aspirabas, barrías o trapeabas?',
          '¿Sacabas la basura y reponías papel, jabón, toallas u otros suministros?',
          '¿Hacías limpieza profunda o te encargabas de áreas comunes?',
          '¿Lavabas o doblabas ropa de cama y toallas (lavandería)?',
          '¿Usabas un carrito de limpieza para organizar tu turno?',
          '¿Reportabas daños, objetos perdidos o cosas por reparar?',
        ],
      },
      {
        title: 'Herramientas y productos',
        questions: [
          '¿Qué herramientas usabas? ¿Aspiradora, trapeador, carrito de limpieza?',
          '¿Qué productos de limpieza usabas y para qué superficie (baños, vidrios, pisos, desinfección)?',
        ],
      },
      {
        title: 'Ritmo y estándares',
        questions: [
          '¿Tenías que terminar cierta cantidad de habitaciones por turno? ¿Trabajabas con presión de tiempo?',
          '¿Cómo te asegurabas de que una habitación quedara bien limpia?',
          '¿Alguna vez tuviste que corregir una limpieza que no cumplía el estándar?',
          '¿Tenías contacto con huéspedes o clientes? ¿Qué hacías si pedían algo?',
          '¿Trabajabas solo o en equipo?',
        ],
      },
      {
        title: 'Experiencia transferible',
        questions: [
          '¿Has limpiado tu casa o la de familiares de forma regular y exigente?',
          '¿Has ayudado en un negocio familiar con la limpieza?',
          '¿Has limpiado oficinas, restaurantes, tiendas, escuelas u otros espacios?',
          '¿Has hecho trabajos físicos exigentes durante varias horas seguidas?',
        ],
      },
    ],
    rules: [
      'No asumas que sabe usar productos químicos o máquinas por conocer su nombre: pregunta qué usó y para qué.',
      'Nunca inventes cantidad de habitaciones: solo úsala si la persona la dio.',
    ],
  },
  {
    id: 'landscaping',
    label: 'Landscaping / Jardinería',
    match: /landscap|\blawn|\bgrounds(keep|man|worker)|\bgardener|\bgardening|jardin|césped|cesped|\byard\b|\btrees?\b|arbol|árbol|paisaj|\bmow/i,
    sections: [
      {
        title: 'Experiencia general',
        questions: [
          '¿Has trabajado en jardinería, landscaping, mantenimiento de terrenos o trabajos al aire libre?',
          '¿Dónde lo hacías y durante cuánto tiempo?',
          '¿Trabajabas para una empresa, un negocio familiar, una finca o por cuenta propia?',
        ],
      },
      {
        title: 'Tareas',
        questions: [
          '¿Cortabas césped? ¿Con qué máquina o herramienta?',
          '¿Recortabas arbustos o árboles?',
          '¿Plantabas árboles, flores o plantas y preparabas la tierra?',
          '¿Quitabas maleza o regabas?',
          '¿Aplicabas mulch, o movías tierra, piedras u otros materiales?',
          '¿Limpiabas hojas y ramas, o hacías mantenimiento general de patios y terrenos?',
          '¿Instalabas o mantenías jardines? ¿Ayudabas con sistemas de riego?',
          '¿Colocabas césped en rollos, muros de piedra, caminos o bordes (hardscape)?',
          '¿Has removido nieve o hecho trabajos de temporada en invierno?',
          '¿Aplicabas fertilizantes o pesticidas? Si sí, ¿con qué capacitación? (no asumas licencias)',
        ],
      },
      {
        title: 'Herramientas y equipos',
        questions: [
          '¿Qué herramientas usabas? ¿Lawn mower, string trimmer, leaf blower, hedge trimmer, chainsaw?',
          '¿Palas, rastrillos, azadones u otras herramientas manuales?',
          '¿Has usado algún equipo que requiera capacitación específica?',
          '¿Has manejado camioneta, remolque o tractor de trabajo?',
        ],
      },
      {
        title: 'Condiciones de trabajo',
        questions: [
          '¿Trabajabas bajo sol, calor, lluvia o frío? ¿Cuántas horas al aire libre?',
          '¿Hacías trabajo físico pesado o levantabas materiales y herramientas?',
          '¿Trabajabas en equipo?',
        ],
      },
      {
        title: 'Experiencia transferible',
        questions: [
          '¿Has trabajado en agricultura o ayudado en una finca familiar?',
          '¿Has mantenido terrenos de tu familia o cuidado jardines de vecinos o clientes?',
          '¿Has hecho trabajos físicos al aire libre con frecuencia?',
        ],
      },
    ],
    rules: [
      'Si menciona una herramienta o máquina, pregunta si la usó él o ella directamente, y cuánto tiempo. No asumas experiencia solo porque conoce el nombre.',
      'Una motosierra, pesticidas u otros equipos con riesgo o regulación: pregunta qué hacía exactamente y nunca asumas capacitación ni licencia.',
    ],
  },
  {
    id: 'construction',
    label: 'Construction / Construcción',
    match: /construct|\blaborer|carpent|\bmason|drywall|\broof|\bpainter|\bpainting|concrete|\bobra\b|albañil|albanil|construcci|pintor|techo/i,
    sections: [
      {
        title: 'Experiencia',
        questions: [
          '¿Has trabajado en construcción? ¿De qué tipo: residencial, comercial, remodelación, obra civil?',
          '¿Cuál era tu función y cuánto tiempo la hiciste?',
          '¿Trabajabas para una empresa, un contratista, un familiar o por cuenta propia?',
        ],
      },
      {
        title: 'Tareas',
        questions: [
          '¿Preparabas el área de trabajo o la limpiabas al terminar?',
          '¿Movías o cargabas materiales (madera, cemento, bloques, herramientas)?',
          '¿Ayudabas en demolición, a medir o a cortar materiales?',
          '¿Ayudabas con drywall, pintura, concreto, pisos, techos (roofing) o carpintería?',
          '¿Ayudabas con plomería o con trabajo eléctrico? Si sí, ¿qué tareas específicas hacías tú?',
          '¿Has trabajado en alturas, con escaleras o andamios?',
        ],
      },
      {
        title: 'Herramientas y maquinaria',
        questions: [
          '¿Qué herramientas manuales usabas? ¿Martillo, cinta métrica, nivel, pala, carretilla?',
          '¿Qué herramientas eléctricas usabas? ¿Taladro, sierra circular?',
          '¿Qué maquinaria has usado, y la manejabas tú o solo trabajabas cerca?',
        ],
      },
      {
        title: 'Seguridad',
        questions: [
          '¿Usabas equipo de protección? ¿Cuál (casco, guantes, botas, lentes, arnés)?',
          '¿Seguías instrucciones de seguridad y trabajabas cerca de maquinaria pesada?',
          '¿Has recibido alguna capacitación de seguridad? (no asumas certificaciones)',
        ],
      },
      {
        title: 'Experiencia informal',
        questions: [
          '¿Has ayudado a familiares en proyectos de construcción o reparado algo en tu propia casa?',
          '¿Has ayudado a un maestro de obra o contratista, o hecho remodelaciones?',
          '¿Qué tareas hacías personalmente y cuáles solo observabas?',
        ],
      },
    ],
    rules: [
      'Distingue siempre entre experiencia directa, auxiliar e informal.',
      'Si dice "ayudaba con electricidad/plomería/etc.", pregunta qué tareas específicas hacía y NUNCA lo conviertas en el oficio (Electrician, Plumber...).',
      'No asumas maquinaria, certificaciones ni nivel de supervisión.',
    ],
  },
  {
    id: 'cook',
    label: 'Cook / Cocina / Food service',
    match: /\bcook|kitchen|\bchef|\bfood|restaurant|dishwash|\bbaker|\bprep (cook|worker)|cafeter|cocin|mesero|\bserver\b|bartend|panader|comida|lavaplatos/i,
    sections: [
      {
        title: 'Experiencia',
        questions: [
          '¿Has trabajado como cocinero, ayudante de cocina o en restaurantes, hoteles, cafeterías o comedores?',
          '¿Has cocinado en un negocio familiar o vendido comida por tu cuenta?',
          '¿Qué tipo de cocina o menú era y cuánto tiempo lo hiciste?',
        ],
      },
      {
        title: 'Preparación',
        questions: [
          '¿Qué alimentos sabes preparar? ¿Carnes, pollo, pescado, vegetales, arroz, sopas, salsas, desayunos?',
          '¿Hacías panadería o repostería?',
          '¿Preparabas ingredientes antes del servicio (cortar, porcionar, marinar)?',
          '¿Lavabas platos o mantenías limpia la cocina?',
          '¿Recibías o almacenabas mercancía, o llevabas inventario?',
        ],
      },
      {
        title: 'Técnicas y equipos',
        questions: [
          '¿Qué técnicas de cocina usas?',
          '¿Qué equipos has usado? ¿Grill, freidoras, horno, estufa, plancha, procesador de alimentos?',
        ],
      },
      {
        title: 'Volumen y ritmo',
        questions: [
          '¿Para cuántas personas cocinabas normalmente?',
          '¿Trabajaste en horas de mucho volumen o con varias cosas a la vez?',
          '¿Trabajabas con órdenes o tickets? ¿Con presión de tiempo?',
          '¿Atendías clientes o servías mesas?',
        ],
      },
      {
        title: 'Seguridad e higiene',
        questions: [
          '¿Cómo mantienes limpia tu área? ¿Usabas guantes, delantal, gorro?',
          '¿Cómo evitas la contaminación cruzada?',
          '¿Has seguido procedimientos de seguridad alimentaria o recibido alguna capacitación?',
        ],
      },
    ],
    rules: [
      'Nunca asumas certificaciones (food handler, etc.): pregunta si existen.',
      'Nunca inventes cantidad de personas atendidas ni volumen: solo si la persona la dio.',
    ],
  },
  {
    id: 'maintenance',
    label: 'Maintenance / Mantenimiento',
    match: /maintenan|handyman|repair|mechanic|mantenim|reparaci|plomer|electric|tecnico|técnico/i,
    sections: [
      {
        title: 'Experiencia general',
        questions: [
          '¿Has hecho mantenimiento o reparaciones en casas, edificios, negocios, fincas o propiedades?',
          '¿Para una empresa o por tu cuenta, y desde hace cuánto?',
          '¿Qué tipo de problemas solías resolver?',
          '¿Atendías pedidos de otras personas (clientes, vecinos, inquilinos) o llevabas un registro de reparaciones?',
        ],
      },
      {
        title: 'Reparaciones',
        questions: [
          '¿Has reparado puertas, ventanas, cerraduras, paredes, pisos, techos o muebles?',
          '¿Has hecho pintura, drywall, plomería básica o electricidad básica?',
          '¿Has reparado electrodomésticos o hecho tareas básicas de climatización (aire acondicionado)?',
        ],
      },
      {
        title: 'Herramientas',
        questions: [
          '¿Qué herramientas manuales usas? ¿Martillo, destornilladores, llaves, nivel, serrucho?',
          '¿Qué herramientas eléctricas usas? ¿Taladro, multímetro?',
        ],
      },
      {
        title: 'Diagnóstico',
        questions: [
          'Cuando algo se daña, ¿cómo averiguas cuál es el problema?',
          '¿Puedes contarme un problema que hayas diagnosticado y reparado? ¿Qué pasos seguiste?',
          '¿Lo resolviste solo o necesitaste ayuda?',
        ],
      },
      {
        title: 'Mantenimiento preventivo',
        questions: [
          '¿Revisabas equipos regularmente, o limpiabas y lubricabas maquinaria?',
          '¿Detectabas problemas antes de que fallaran?',
        ],
      },
      {
        title: 'Límites de experiencia',
        questions: [
          '¿Qué reparaciones puedes hacer completamente solo?',
          '¿En cuáles solo has ayudado?',
          '¿Cuáles no sabes hacer?',
        ],
      },
    ],
    rules: [
      'Muchas personas dicen "no tengo experiencia en mantenimiento" y luego resulta que llevan años reparando cosas en casas, fincas o negocios familiares: explora esa experiencia informal con cuidado.',
      'Siempre cierra con los límites: lo que hace solo, en lo que solo ayuda y lo que no sabe. Lo que no sabe hacer NUNCA va al CV.',
    ],
  },
];

// Módulo universal: aplica a cualquier puesto, también cuando no hay banco específico.
export const UNIVERSAL: QuestionSection[] = [
  {
    title: 'Responsabilidad',
    questions: [
      '¿Qué era exactamente tu responsabilidad y qué hacías tú personalmente?',
      '¿Qué hacía otra persona? ¿Trabajabas solo o acompañado? ¿Supervisabas a alguien?',
    ],
  },
  {
    title: 'Frecuencia',
    questions: ['¿Lo hacías todos los días, varias veces por semana u ocasionalmente? ¿Durante cuánto tiempo?'],
  },
  {
    title: 'Herramientas',
    questions: ['¿Qué herramientas usabas personalmente, con qué frecuencia y para qué?'],
  },
  {
    title: 'Evidencia',
    questions: ['Dame un ejemplo concreto de una tarea que hayas hecho: ¿cuál era la situación, qué hiciste y cuál fue el resultado?'],
  },
  {
    title: 'Nivel real',
    questions: [
      '¿Podrías hacer esta tarea sin supervisión, necesitabas instrucciones o solo ayudabas?',
      '¿Has recibido entrenamiento para hacerla?',
    ],
  },
];

export function pickBank(targetRole: string, industry: string): Bank | null {
  const text = `${targetRole} ${industry}`;
  return BANKS.find((b) => b.match.test(text)) || null;
}

function renderSections(sections: QuestionSection[]): string {
  return sections.map((s) => `${s.title}:\n${s.questions.map((q) => `  - ${q}`).join('\n')}`).join('\n');
}

// Texto que se agrega al prompt de la entrevista: el banco del puesto (si lo hay) y el módulo universal.
export function renderBankPrompt(targetRole: string, industry: string): string {
  const bank = pickBank(targetRole, industry);
  const universal = `MÓDULO UNIVERSAL (úsalo con cualquier puesto, para cada experiencia importante):\n${renderSections(UNIVERSAL)}`;
  if (!bank) {
    return `No hay un banco específico para este puesto: guíate por el módulo universal y por lo que el puesto pida.\n\n${universal}`;
  }
  return `BANCO DE PREGUNTAS DEL PUESTO — ${bank.label} (menú de temas: elige UNO por turno según lo que falte o lo que la respuesta anterior abrió; nunca los hagas todos):\n${renderSections(bank.sections)}\n\nREGLAS DE ESTE OFICIO:\n${bank.rules.map((r) => `  - ${r}`).join('\n')}\n\n${universal}`;
}
