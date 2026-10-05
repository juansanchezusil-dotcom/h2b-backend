import { renderKnowledgeForCv, renderKnowledgeForInterview } from './bankKnowledge';

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
  // 'high' = el puesto suele exigir inglés avanzado o fluido (atención directa a clientes o huéspedes)
  englishDemand?: 'high';
}

export const BANKS: Bank[] = [
  {
    id: 'bartender',
    label: 'Barman / Bartender',
    match: /barman|bartend|cantiner|mixolog/i,
    englishDemand: 'high',
    sections: [
      {
        title: 'Experiencia',
        questions: [
          '¿Has trabajado como barman, bartender, ayudante de barra o en bares, restaurantes, hoteles, discotecas o eventos?',
          '¿Qué tipo de lugar era y cuánto tiempo trabajaste ahí?',
          '¿Atendías la barra tú solo o con otras personas?',
        ],
      },
      {
        title: 'Bebidas',
        questions: [
          '¿Qué bebidas preparabas: cócteles, cerveza, vino, bebidas sin alcohol, café?',
          '¿Qué cócteles sabes preparar de memoria?',
          '¿Seguías recetas o preparabas libremente? ¿Servías cerveza de barril o vino?',
        ],
      },
      {
        title: 'Operación',
        questions: [
          '¿Cuántos clientes o bebidas atendías en horas de mucho movimiento?',
          '¿Usabas un sistema de caja (POS)? ¿Manejabas efectivo y propinas?',
          '¿Llevabas inventario o hacías pedidos de bebidas?',
          '¿Preparabas y limpiabas la barra, los vasos y las herramientas (coctelera, medidor)?',
        ],
      },
      {
        title: 'Clientes',
        questions: [
          '¿Cómo tratabas a un cliente difícil o molesto?',
          '¿Verificabas la edad o la identificación de los clientes?',
          '¿Recomendabas bebidas a los clientes?',
        ],
      },
      {
        title: 'Capacitación',
        questions: ['¿Hiciste algún curso o certificación de bartender o de servicio responsable de alcohol? (nunca lo asumas)'],
      },
      {
        title: 'Inglés (este puesto suele exigirlo avanzado o fluido)',
        questions: [
          '¿Has atendido clientes en inglés? ¿En qué situaciones (tomar pedidos, explicar el menú, resolver quejas)?',
          '¿Puedes mantener una conversación en inglés sin ayuda de nadie?',
          '¿Has trabajado en un lugar donde se hablara inglés a diario?',
          '¿Entiendes pedidos hablados rápido en inglés? (no asumas ni subas su nivel)',
        ],
      },
    ],
    rules: [
      'Nunca asumas certificaciones de bartender ni de servicio responsable de alcohol: pregunta si existen.',
      'No asumas que sabe preparar cócteles por conocer su nombre: pregunta cuáles prepara de verdad.',
      'No inventes volumen de clientes ni bebidas por hora.',
    ],
  },
  {
    id: 'server',
    label: 'Mesero / Server',
    match: /\bserver\b|waiter|waitress|mesero|mesera|camarer[oa]\b(?! de (piso|habitaci))|hostess|banquet/i,
    englishDemand: 'high',
    sections: [
      {
        title: 'Experiencia',
        questions: [
          '¿Has trabajado de mesero en restaurantes, hoteles, cafeterías, banquetes o eventos?',
          '¿Qué tipo de lugar era y cuánto tiempo trabajaste ahí?',
          '¿Cuántas mesas o personas atendías a la vez?',
        ],
      },
      {
        title: 'Tareas',
        questions: [
          '¿Tomabas pedidos y los pasabas a la cocina?',
          '¿Llevabas platos y bebidas, y montabas o recogías mesas?',
          '¿Explicabas el menú o recomendabas platos?',
          '¿Cobrabas, usabas caja o POS y manejabas propinas?',
          '¿Atendías buffets, banquetes o eventos grandes?',
          '¿Cómo manejabas una queja o un error en un pedido?',
        ],
      },
      {
        title: 'Ritmo y equipo',
        questions: [
          '¿Cómo era un turno de mucho movimiento y cuántas horas estabas de pie?',
          '¿Te coordinabas con cocina y con otros meseros?',
        ],
      },
      {
        title: 'Conocimiento',
        questions: [
          '¿Conocías bien el menú, los ingredientes y los alérgenos?',
          '¿Servías bebidas, vino o cerveza? (no asumas capacitación)',
        ],
      },
      {
        title: 'Inglés (este puesto suele exigirlo avanzado o fluido)',
        questions: [
          '¿Has atendido clientes en inglés? ¿En qué situaciones (tomar pedidos, explicar el menú, resolver quejas)?',
          '¿Puedes mantener una conversación en inglés sin ayuda de nadie?',
          '¿Has trabajado en un lugar donde se hablara inglés a diario?',
          '¿Entiendes pedidos hablados rápido en inglés? (no asumas ni subas su nivel)',
        ],
      },
    ],
    rules: [
      'No inventes cantidad de mesas ni de comensales: solo si la persona la dio.',
      'No asumas certificaciones de manejo de alimentos ni de servicio de alcohol.',
    ],
  },
  {
    id: 'frontdesk',
    label: 'Front desk / Recepción',
    match: /front desk|frontdesk|reception|recepci[oó]n|recepcionista|hotel clerk|night audit|concierge|guest (service|relation)/i,
    englishDemand: 'high',
    sections: [
      {
        title: 'Experiencia',
        questions: [
          '¿Has trabajado en la recepción de un hotel, oficina, clínica, gimnasio u otro lugar de atención al cliente?',
          '¿Qué tipo de lugar era y cuánto tiempo trabajaste ahí?',
          '¿Trabajabas turnos de noche o fines de semana?',
        ],
      },
      {
        title: 'Tareas',
        questions: [
          '¿Hacías check-in y check-out de huéspedes o clientes?',
          '¿Manejabas reservas, llamadas telefónicas o correos?',
          '¿Cobrabas, manejabas caja o hacías cierres de turno?',
          '¿Informabas a los clientes sobre servicios, horarios o lugares cercanos?',
          '¿Resolvías quejas o problemas? ¿Puedes contarme un caso?',
          '¿Te coordinabas con limpieza, mantenimiento u otras áreas?',
        ],
      },
      {
        title: 'Sistemas y computadora',
        questions: [
          '¿Qué programas o sistemas usabas (de reservas, Excel, Word, correo)? No asumas ninguno: pregunta cuáles.',
          '¿Qué tan cómodo eres usando computadora y escribiendo en inglés?',
        ],
      },
      {
        title: 'Inglés (este puesto suele exigirlo avanzado o fluido)',
        questions: [
          '¿Has atendido clientes en inglés? ¿En qué situaciones (tomar pedidos, explicar el menú, resolver quejas)?',
          '¿Puedes mantener una conversación en inglés sin ayuda de nadie?',
          '¿Has trabajado en un lugar donde se hablara inglés a diario?',
          '¿Entiendes pedidos hablados rápido en inglés? (no asumas ni subas su nivel)',
        ],
      },
    ],
    rules: [
      'No asumas que sabe usar ningún software de reservas por conocer su nombre: pregunta qué usó y para qué.',
      'No inventes cantidad de huéspedes, llamadas ni reservas.',
      'El teléfono y el correo en inglés son centrales en este puesto: pregunta con honestidad y no subas su nivel.',
    ],
  },
  {
    id: 'bellhop',
    label: 'Botones / Bellhop',
    match: /bell ?(hop|man|boy|attendant|staff)|botones|\bporter\b|maletero|baggage|luggage/i,
    englishDemand: 'high',
    sections: [
      {
        title: 'Experiencia',
        questions: [
          '¿Has trabajado de botones, maletero, portero o en atención a huéspedes en un hotel o resort?',
          '¿Qué tipo de lugar era y cuánto tiempo trabajaste ahí?',
        ],
      },
      {
        title: 'Tareas',
        questions: [
          '¿Recibías y saludabas a los huéspedes?',
          '¿Cargabas y llevabas el equipaje, con o sin carrito?',
          '¿Acompañabas a los huéspedes a su habitación y les explicabas algo?',
          '¿Dabas indicaciones o información sobre el hotel o la zona?',
          '¿Coordinabas con recepción, o ayudabas con taxis y transporte?',
          '¿Te encargabas de mantener ordenada la entrada o el lobby?',
        ],
      },
      {
        title: 'Condiciones',
        questions: [
          '¿Levantabas peso y cuántas horas pasabas de pie o caminando?',
          '¿Trabajabas al aire libre o con clima difícil?',
        ],
      },
      {
        title: 'Servicio',
        questions: ['¿Cómo trataste una situación difícil con un huésped?'],
      },
      {
        title: 'Inglés (este puesto suele exigirlo avanzado o fluido)',
        questions: [
          '¿Has atendido clientes en inglés? ¿En qué situaciones (tomar pedidos, explicar el menú, resolver quejas)?',
          '¿Puedes mantener una conversación en inglés sin ayuda de nadie?',
          '¿Has trabajado en un lugar donde se hablara inglés a diario?',
          '¿Entiendes pedidos hablados rápido en inglés? (no asumas ni subas su nivel)',
        ],
      },
    ],
    rules: [
      'No inventes cantidad de maletas ni de huéspedes atendidos.',
      'Este puesto es de trato directo con huéspedes: no subas el nivel de inglés de la persona.',
    ],
  },
  {
    id: 'driver',
    label: 'Conductor / Driver',
    match: /\bdriver|chofer|chófer|conductor|\btruck|\bshuttle|chauffeur|\bvalet|repartidor/i,
    sections: [
      {
        title: 'Experiencia',
        questions: [
          '¿Has trabajado como conductor de camión, camioneta, bus, taxi, reparto o transporte de personal?',
          '¿Qué tipo de vehículo manejabas y durante cuánto tiempo?',
          '¿Trabajabas para una empresa o por tu cuenta?',
        ],
      },
      {
        title: 'Licencia',
        questions: [
          '¿Qué licencia de conducir tienes y de qué país es? (no asumas licencia de EE. UU. ni CDL)',
          '¿Hace cuánto tiempo la tienes? ¿Es de alguna categoría especial (carga, pasajeros)?',
        ],
      },
      {
        title: 'Tareas',
        questions: [
          '¿Seguías rutas fijas o decidías tú el recorrido? ¿Usabas GPS o una aplicación?',
          '¿Cargabas y descargabas mercancía o equipaje?',
          '¿Transportabas pasajeros o hacías entregas a clientes?',
          '¿Llevabas registros, documentos o recibos de lo que transportabas?',
          '¿Revisabas el vehículo antes de salir o hacías mantenimiento básico?',
        ],
      },
      {
        title: 'Condiciones',
        questions: [
          '¿Cuántas horas manejabas al día y a qué distancias?',
          '¿Trabajabas de noche, con mal clima o en turnos largos?',
        ],
      },
    ],
    rules: [
      'Nunca asumas licencia de EE. UU., CDL ni ninguna habilitación especial: escribe exactamente la licencia que la persona tiene y de qué país.',
      'No inventes kilómetros, años manejando ni cantidad de entregas.',
      'Recuérdale con tacto que antes de postular debe confirmar el tipo de licencia que pide el empleador.',
    ],
  },
  {
    id: 'electrician',
    label: 'Electricista / Electrician',
    match: /electrician|electricist|electricidad|\bwiring|instalaciones el[eé]ctricas/i,
    sections: [
      {
        title: 'Experiencia',
        questions: [
          '¿Has trabajado como electricista, ayudante de electricista o en instalaciones eléctricas?',
          '¿Era obra residencial, comercial o industrial?',
          '¿Trabajabas para una empresa, un contratista o por tu cuenta, y durante cuánto tiempo?',
        ],
      },
      {
        title: 'Tareas',
        questions: [
          '¿Instalabas cableado, tomas, interruptores o iluminación?',
          '¿Trabajabas con tableros, breakers o canalizaciones (conduit)?',
          '¿Hacías mantenimiento o reparaciones eléctricas?',
          '¿Diagnosticabas fallas? ¿Cómo averiguabas qué estaba mal?',
          '¿Leías planos o diagramas eléctricos?',
          '¿Trabajabas con motores o equipos eléctricos?',
        ],
      },
      {
        title: 'Herramientas',
        questions: [
          '¿Qué herramientas y equipos de medición usabas (multímetro, pelacables, taladro)?',
          '¿Cuáles usabas tú directamente y desde hace cuánto?',
        ],
      },
      {
        title: 'Nivel real',
        questions: [
          '¿Qué trabajos hacías tú solo y en cuáles solo ayudabas?',
          '¿Trabajabas bajo la supervisión de un electricista con licencia?',
        ],
      },
      {
        title: 'Seguridad y licencias',
        questions: [
          '¿Cortabas la corriente y bloqueabas el circuito antes de trabajar? ¿Usabas equipo de protección?',
          '¿Tienes alguna licencia, certificado o curso eléctrico? ¿De qué país? (nunca lo asumas)',
        ],
      },
    ],
    rules: [
      'Si dice "ayudaba con electricidad", pregunta qué tareas específicas hacía y NUNCA lo conviertas en Electrician: usa Electrician Helper o Electrical Assistant según lo que haya dicho.',
      'Nunca asumas licencias. Una licencia de otro país no se presenta como válida en EE. UU.',
      'No asumas nivel de voltaje, tipo de instalación ni equipos que no mencionó.',
    ],
  },
  {
    id: 'carpenter',
    label: 'Carpintero / Carpenter',
    match: /carpent|carpinter|woodwork|ebanist|cabinet ?mak|framer|framing/i,
    sections: [
      {
        title: 'Experiencia',
        questions: [
          '¿Has trabajado de carpintero, ebanista o ayudante de carpintero?',
          '¿Era carpintería de obra (estructuras, encofrados, techos), de acabados (puertas, closets, molduras) o de taller (muebles)?',
          '¿Trabajabas para una empresa, un contratista o por tu cuenta, y durante cuánto tiempo?',
        ],
      },
      {
        title: 'Tareas',
        questions: [
          '¿Medías y cortabas madera u otros materiales?',
          '¿Armabas estructuras o marcos de madera (framing)?',
          '¿Instalabas puertas, ventanas, pisos o molduras?',
          '¿Fabricabas muebles, closets o gabinetes?',
          '¿Hacías encofrados para concreto o reparaciones de carpintería?',
          '¿Lijabas y aplicabas acabados (barniz, pintura)?',
          '¿Leías planos o trabajabas con medidas y dibujos?',
        ],
      },
      {
        title: 'Herramientas',
        questions: [
          '¿Qué herramientas usabas (sierra circular, sierra de inglete, sierra de mesa, taladro, router, pistola de clavos, nivel, escuadra)?',
          '¿Cuáles usabas tú directamente y desde hace cuánto?',
        ],
      },
      {
        title: 'Precisión y nivel real',
        questions: [
          '¿Cómo te asegurabas de que las medidas y los cortes fueran exactos?',
          '¿Puedes contarme un trabajo del que te sientas orgulloso y qué hiciste tú?',
          '¿Trabajabas solo o ayudabas a un maestro carpintero?',
        ],
      },
      {
        title: 'Seguridad',
        questions: ['¿Usabas protecciones y guardas en las sierras, y equipo de protección? ¿Recibiste alguna capacitación? (no asumas)'],
      },
    ],
    rules: [
      'Distingue carpintería de obra, de acabados y de taller: no mezcles ni subas el nivel.',
      'No asumas herramientas ni maquinaria de taller que no mencionó.',
      'No presentes como oficio independiente lo que fue ayuda a un maestro.',
    ],
  },
  {
    id: 'foodprocessing',
    label: 'Procesador de alimentos / Planta / Empaque',
    match: /food process|food production|procesador|procesamiento|processing (plant|worker)|\bpacking|\bpacker|packaging|empaque|empacador|seafood|meat (cutter|process)|poultry|slaughter|production line|l[ií]nea de producci[oó]n/i,
    sections: [
      {
        title: 'Experiencia',
        questions: [
          '¿Has trabajado en una planta de procesamiento de alimentos, empacadora, fábrica, pesquera o línea de producción?',
          '¿Qué producto procesaban: carne, pollo, pescado y mariscos, frutas, verduras, lácteos, panadería?',
          '¿Cuánto tiempo trabajaste ahí y era un trabajo de temporada?',
        ],
      },
      {
        title: 'Tareas',
        questions: [
          '¿Clasificabas o seleccionabas producto?',
          '¿Cortabas, deshuesabas, filetabas o limpiabas producto?',
          '¿Empacabas, etiquetabas o sellabas?',
          '¿Trabajabas en una línea de producción? ¿En qué puesto de la línea?',
          '¿Hacías control de calidad o inspección visual?',
          '¿Pesabas producto con báscula o contabas cajas?',
          '¿Cargabas o movías cajas y bandejas?',
          '¿Limpiabas el equipo y el área al terminar?',
        ],
      },
      {
        title: 'Equipos',
        questions: [
          '¿Qué equipos usabas (cintas transportadoras, cortadoras, básculas, selladoras)?',
          '¿Usabas cuchillos o herramientas de corte?',
          '¿Manejabas montacargas o carretillas elevadoras? (no asumas licencia)',
        ],
      },
      {
        title: 'Ritmo y condiciones',
        questions: [
          '¿Era trabajo repetitivo y de pie durante todo el turno? ¿Cuántas horas?',
          '¿Trabajabas en ambiente frío, húmedo o con ruido?',
          '¿Levantabas peso? ¿Tenías metas de producción por turno?',
        ],
      },
      {
        title: 'Higiene y seguridad',
        questions: [
          '¿Seguías reglas de higiene (guantes, cofia, delantal, lavado de manos)?',
          '¿Has recibido capacitación de higiene, seguridad alimentaria o seguridad en el trabajo? (nunca asumas certificaciones)',
        ],
      },
    ],
    rules: [
      'No inventes cantidades ni metas de producción: solo si la persona las dio.',
      'No asumas certificaciones (BPM, HACCP, manejo de alimentos) ni licencias de montacargas.',
      'Valora con honestidad el trabajo repetitivo y de ritmo constante: es experiencia real y relevante.',
    ],
  },
  {
    id: 'housekeeping',
    label: 'Housekeeping / Hotel',
    match: /housekeep|\bmaids?\b|room attendant|janitor|cleaner|cleaning|limpieza|camarera de (piso|habitaci)|aseo|hosped/i,
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
          '¿Usabas máquinas como pulidora o fregadora de pisos, o limpiabas oficinas y espacios comerciales?',
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
    match: /construct|\blaborer|\bmason|drywall|\broof|\bpainter|\bpainting|concrete|\bobra\b|albañil|albanil|construcci|pintor|techo/i,
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
    match: /\bcook|kitchen|\bchef|dishwash|\bbaker|cafeter|cocin|panader|comida|lavaplatos|restaurant|\bfood/i,
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
    match: /maintenan|handyman|repair|mechanic|mantenim|reparaci|plomer|tecnico|técnico/i,
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
const ENGLISH_BLOCK = `ESTE PUESTO SUELE EXIGIR INGLÉS AVANZADO O FLUIDO (atención directa a clientes o huéspedes).
- Pregunta por su inglés con naturalidad y sin presionar, y sin esperar al final. Guarda en "englishLevel" EXACTAMENTE lo que la persona diga; nunca lo infieras ni lo subas.
- Solo guarda experiencia atendiendo en inglés si de verdad la tuvo y dio un ejemplo concreto.
- Si su nivel es básico o intermedio, díselo UNA sola vez, con respeto: este tipo de puesto suele pedir inglés fluido y es probable que el empleador haga la entrevista en inglés; el CV mostrará su nivel real sin exagerarlo, y puede continuar si quiere. No la desanimes ni le prometas nada.`;

// Aviso honesto, armado por código (no por el modelo), para puestos que suelen exigir inglés avanzado
// cuando la persona no declaró ese nivel.
export function englishWarning(targetRole: string, industry: string, englishLevel: string): string | null {
  const bank = pickBank(targetRole, industry);
  if (bank?.englishDemand !== 'high') return null;
  if (/avanz|fluid|fluent|advanced|nativ|native/i.test(englishLevel)) return null;
  const level = englishLevel.trim().toLowerCase();
  const base = `Los puestos de ${bank.label} suelen exigir inglés avanzado o fluido, porque atiendes directamente a clientes o huéspedes, y es probable que el empleador te entreviste en inglés.`;
  return level
    ? `Indicaste inglés ${level}. ${base} Tu CV muestra tu nivel real sin exagerarlo. Puedes reforzarlo practicando con el Simulador de Entrevista, y mientras tanto considera también puestos con menos contacto con clientes.`
    : `No indicaste tu nivel de inglés. ${base} Antes de postular confirma tu nivel real, porque el CV no lo va a exagerar.`;
}

export function renderBankPrompt(targetRole: string, industry: string): string {
  const bank = pickBank(targetRole, industry);
  const universal = `MÓDULO UNIVERSAL (úsalo con cualquier puesto, para cada experiencia importante):\n${renderSections(UNIVERSAL)}`;
  if (!bank) {
    return `No hay un banco específico para este puesto: guíate por el módulo universal y por lo que el puesto pida.\n\n${universal}`;
  }
  const english = bank.englishDemand === 'high' ? `\n\n${ENGLISH_BLOCK}` : '';
  const knowledge = renderKnowledgeForInterview(bank.id);
  return `BANCO DE PREGUNTAS DEL PUESTO — ${bank.label} (menú de temas: elige UNO por turno según lo que falte o lo que la respuesta anterior abrió; nunca los hagas todos):\n${renderSections(bank.sections)}\n\nREGLAS DE ESTE OFICIO:\n${bank.rules.map((r) => `  - ${r}`).join('\n')}${english}${knowledge ? `\n\n${knowledge}` : ''}\n\n${universal}`;
}

// Palabras clave y habilidades transferibles del puesto para el prompt del CV ('' si no hay banco)
export function keywordsForCv(targetRole: string, industry: string): string {
  const bank = pickBank(targetRole, industry);
  return bank ? renderKnowledgeForCv(bank.id) : '';
}
