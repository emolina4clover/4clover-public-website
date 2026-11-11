import type { Diagnostico } from '../../lib/diagnostico/types';
import { choice, multi, o, open, scale, SI_NO } from './_helpers';

/**
 * Cuestionario "Diagnóstico de Ciberseguridad" para Triconos Mineros S.A.
 * Fuente: Cuestionario-Ciberseguridad-Triconos-Mineros.docx
 *
 * Se respeta el texto y la numeración del documento. Las preguntas donde la
 * escala Sí/Parcial/No no tiene sentido (cantidades, "¿cuál?", riesgos donde
 * "Sí" es malo) usan opciones propias; las informativas no puntúan.
 */
export const triconosMineros: Diagnostico = {
  id: 'triconos-mineros',
  // El token aleatorio evita que la URL se pueda adivinar. Para revocar el enlace,
  // cambia el token y vuelve a desplegar.
  slug: 'triconos-mineros-yjbr6uvi32uq',
  version: '2026-11',
  company: 'Triconos Mineros S.A.',
  title: 'Diagnóstico de ciberseguridad',
  subtitle: 'Levantamiento de seguridad, protección de datos y procesos',
  purpose:
    'Este cuestionario busca dimensionar el estado actual de la empresa en ciberseguridad, protección de datos y procesos de seguridad, e identificar qué conviene abordar primero. No es una auditoría ni requiere entregar información sensible.',
  estimate: '20 a 30 minutos',
  howTo:
    'En cada pregunta elige una opción y, si quieres, agrega detalle (herramienta, responsable, documento o excepción). Si algo es confidencial, basta con marcar la opción.',
  emailSubject: 'Diagnóstico de ciberseguridad · Triconos Mineros S.A.',
  thanks: 'El equipo de 4Clover revisará tus respuestas y te contactará para entregarte el diagnóstico completo.',

  blocks: [
    {
      id: 'b1',
      number: 1,
      title: 'Contexto de la empresa y del encargo',
      short: 'Contexto',
      chartLabel: 'Contexto',
      intro: 'Nos permite dimensionar el alcance y entender qué motivó esta necesidad.',
      scored: false,
      questions: [
        choice(
          '1.1',
          '¿Cuántas personas trabajan en la empresa? (oficina + faena/terreno)',
          [o('1 a 10'), o('11 a 50'), o('51 a 200'), o('201 a 500'), o('Más de 500')],
          'Ej.: 40 en oficina y 120 en faena',
        ),
        choice(
          '1.2',
          '¿Cuántos usuarios o equipos usan computador o sistemas corporativos?',
          [o('1 a 10'), o('11 a 25'), o('26 a 50'), o('51 a 150'), o('Más de 150')],
        ),
        choice(
          '1.3',
          '¿Qué tan dependiente es la operación de los sistemas de TI (ERP, facturación, correo, planificación)? ¿Qué pasa si caen un día?',
          [
            o('Baja', undefined, { hint: 'Seguimos operando casi normal' }),
            o('Media', undefined, { hint: 'Hay retrasos y molestias' }),
            o('Alta', undefined, { hint: 'Se detiene parte de la operación' }),
            o('Crítica', undefined, { hint: 'Se detiene la operación' }),
          ],
          '¿Qué pasa si caen un día?',
        ),
        choice(
          '1.4',
          '¿Tienen personal interno de TI o es externalizado? ¿Cuántas personas y qué rol?',
          [o('Interno'), o('Externalizado'), o('Mixto'), o('No tenemos TI')],
          '¿Cuántas personas y qué rol?',
        ),
        multi(
          '1.5',
          '¿Qué motivó este levantamiento?',
          [
            o('Exigencia de un cliente'),
            o('Incidente'),
            o('Auditoría'),
            o('Iniciativa propia'),
            o('Seguro'),
            o('Regulación'),
            o('Otro'),
          ],
          'Cuéntanos más, si quieres',
        ),
        choice(
          '1.6',
          '¿Conectan equipos o personal propio a redes de clientes mineros en faena (Codelco, Anglo, Teck, Collahuasi, etc.)?',
          [o('Sí'), o('A veces'), o('No'), o('No sé')],
          '¿A qué clientes?',
        ),
      ],
    },
    {
      id: 'b2',
      number: 2,
      title: 'Gobierno, políticas y cumplimiento',
      short: 'Gobierno y políticas',
      chartLabel: 'Gobierno',
      intro: 'Cómo se organiza y gobierna la seguridad hoy.',
      scored: true,
      questions: [
        scale('2.1', '¿Existe un responsable o encargado de ciberseguridad/TI formalmente designado?', '¿Quién?'),
        scale('2.2', '¿Hay políticas o normas de seguridad documentadas? (uso aceptable, contraseñas, respaldo)', '¿Cuáles?'),
        choice('2.3', '¿La seguridad tiene presupuesto asignado o se resuelve caso a caso?', [
          o('Presupuesto asignado', 1),
          o('En parte', 0.5),
          o('Caso a caso', 0),
          o('No sé', 0),
        ]),
        scale('2.4', '¿La gerencia revisa temas de seguridad de forma periódica?', '¿Con qué frecuencia?'),
        scale('2.5', '¿Han hecho antes alguna evaluación, diagnóstico o auditoría de ciberseguridad? ¿Cuándo?', '¿Cuándo y quién la hizo?'),
        scale('2.6', '¿Conocen su situación frente a la Ley 21.719 (protección de datos) y la Ley 21.663 (marco de ciberseguridad)?'),
        choice(
          '2.7',
          'Ya cuentan con ISO 9001/14001/45001. ¿Interesaría extender ese modelo de gestión a seguridad de la información (ISO 27001)?',
          [o('Sí, nos interesa'), o('Tal vez'), o('No'), o('No sé')],
        ),
      ],
    },
    {
      id: 'b3',
      number: 3,
      title: 'Protección de datos y privacidad',
      short: 'Datos y privacidad',
      chartLabel: 'Datos',
      intro: 'Qué datos personales manejan y cómo los protegen (clave frente a la Ley 21.719).',
      scored: true,
      questions: [
        multi('3.1', '¿Qué datos personales manejan?', [
          o('Trabajadores'),
          o('Clientes'),
          o('Contactos'),
          o('Postulantes'),
          o('Proveedores'),
          o('Otros'),
        ]),
        multi(
          '3.2',
          '¿Manejan datos sensibles?',
          [
            o('Salud / exámenes ocupacionales'),
            o('Acreditaciones de faena'),
            o('Biométricos'),
            o('Ninguno', undefined, { exclusive: true }),
            o('No sé', undefined, { exclusive: true }),
          ],
        ),
        scale('3.3', '¿Saben dónde residen esos datos (servidores, nube, planillas, correo) y quién accede?'),
        scale('3.4', '¿Tienen cláusulas de protección de datos / confidencialidad con trabajadores y proveedores?'),
        scale(
          '3.5',
          '¿Cuentan con política de privacidad y una forma de atender solicitudes de los titulares? (acceso, rectificación, eliminación)',
        ),
        choice(
          '3.6',
          '¿Comparten datos con terceros o los transfieren fuera de Chile? (nube, casa matriz, proveedores)',
          SI_NO(),
          '¿Con quién o hacia dónde?',
        ),
      ],
    },
    {
      id: 'b4',
      number: 4,
      title: 'Infraestructura: endpoints, servidores, nube y red',
      short: 'Infraestructura',
      chartLabel: 'Infraestructura',
      intro: 'El inventario tecnológico que hay que proteger.',
      scored: true,
      questions: [
        scale('4.1', '¿Tienen un inventario actualizado de equipos? (PC, notebooks, servidores, móviles)'),
        scale('4.2', '¿Todos los equipos tienen antivirus/EDR y están actualizados/parchados?', '¿Qué antivirus o EDR?'),
        choice(
          '4.3',
          '¿Usan servidores propios, nube (AWS/Azure/GCP, Microsoft 365, Google) o un modelo mixto?',
          [o('Servidores propios'), o('Nube'), o('Mixto'), o('No sé')],
          '¿Qué servicios?',
        ),
        choice(
          '4.4',
          '¿El correo corporativo es Microsoft 365 / Google Workspace u otro? ¿Con filtro antiphishing?',
          [
            o('Con filtro antiphishing', 1),
            o('Solo el filtro básico', 0.5),
            o('Sin filtro', 0),
            o('No sé', 0),
          ],
          '¿Qué plataforma de correo usan?',
        ),
        scale('4.5', '¿La red cuenta con firewall, segmentación y WiFi separado para invitados?'),
        choice(
          '4.6',
          '¿Hay equipos sin soporte (Windows antiguos) o software sin licencia/actualización?',
          [o('Sí, varios', 0), o('Algunos', 0.5), o('No', 1), o('No sé', 0)],
          '¿Cuáles?',
        ),
      ],
    },
    {
      id: 'b5',
      number: 5,
      title: 'Identidad y control de accesos',
      short: 'Identidad y accesos',
      chartLabel: 'Accesos',
      intro: 'Quién entra a qué, y cómo se controla.',
      scored: true,
      questions: [
        scale('5.1', '¿Usan autenticación multifactor (MFA) en correo, VPN y sistemas críticos?', '¿En qué sistemas?'),
        choice(
          '5.2',
          '¿Cómo gestionan altas y bajas de usuarios cuando alguien ingresa o se va?',
          [o('Proceso formal', 1), o('Informal, caso a caso', 0.5), o('No hay proceso', 0), o('No sé', 0)],
          '¿Cómo lo hacen?',
        ),
        scale('5.3', '¿Las cuentas con privilegios de administrador están controladas y limitadas?'),
        choice(
          '5.4',
          '¿Hay acceso remoto (VPN, escritorio remoto) y cómo se protege?',
          [
            o('Sí, con VPN y MFA', 1),
            o('Sí, con protección básica', 0.5),
            o('Sí, sin protección clara', 0),
            o('No hay acceso remoto', null),
            o('No sé', 0),
          ],
          '¿Qué herramienta usan?',
        ),
        choice('5.5', '¿Comparten contraseñas o usan un gestor de contraseñas?', [
          o('Usamos gestor', 1),
          o('Mixto', 0.5),
          o('Se comparten o anotan', 0),
          o('No sé', 0),
        ]),
        scale('5.6', '¿El personal en faena accede a sistemas corporativos de forma segura?'),
      ],
    },
    {
      id: 'b6',
      number: 6,
      title: 'Detección, respuesta a incidentes y monitoreo',
      short: 'Detección y respuesta',
      chartLabel: 'Detección',
      intro: 'Capacidad de ver y reaccionar ante un ataque.',
      scored: true,
      questions: [
        scale('6.1', '¿Monitorean eventos o alertas de seguridad? (quién lo hace y con qué herramienta)', '¿Quién y con qué herramienta?'),
        scale('6.2', '¿Existe un procedimiento de respuesta a incidentes y alguien a quien escalar?'),
        choice(
          '6.3',
          '¿Han sufrido incidentes en los últimos 2 años? (phishing, ransomware, fraude, fuga, cuenta comprometida)',
          [o('Sí'), o('Lo sospechamos'), o('No'), o('No sé')],
          '¿Qué ocurrió? (sin detalles sensibles)',
        ),
        scale('6.4', '¿Sabrían a quién reportar un incidente grave, interno y a la autoridad (CSIRT/ANCI)?'),
        scale('6.5', '¿Tienen contratado algún servicio de seguridad gestionada (SOC/MSSP) o soporte externo ante incidentes?', '¿Con quién?'),
      ],
    },
    {
      id: 'b7',
      number: 7,
      title: 'Continuidad, respaldos y resiliencia',
      short: 'Continuidad y respaldos',
      chartLabel: 'Continuidad',
      intro: 'Qué tan rápido se recuperan de una caída o un ataque.',
      scored: true,
      questions: [
        scale('7.1', '¿Realizan respaldos de la información crítica? ¿Con qué frecuencia?', '¿Con qué frecuencia?'),
        scale('7.2', '¿Los respaldos están aislados/offline y se ha probado restaurarlos?', '¿Cuándo fue la última prueba?'),
        scale('7.3', '¿Existe un plan de continuidad o de recuperación ante desastres documentado?'),
        choice(
          '7.4',
          '¿Cuánto tiempo podría operar la empresa sin sistemas antes de un impacto serio?',
          [o('Menos de 4 horas'), o('Un día'), o('Varios días'), o('Una semana o más'), o('No sé')],
        ),
        choice('7.5', '¿Cuentan con un ciberseguro o lo están evaluando?', [
          o('Sí, contratado', 1),
          o('Lo estamos evaluando', 0.5),
          o('No', 0),
          o('No sé', 0),
        ]),
      ],
    },
    {
      id: 'b8',
      number: 8,
      title: 'Terceros, cadena de suministro y exigencias de clientes',
      short: 'Terceros y clientes',
      chartLabel: 'Terceros',
      intro: 'Especialmente relevante al ser proveedor de la gran minería.',
      scored: true,
      questions: [
        choice(
          '8.1',
          '¿Sus clientes mineros les exigen requisitos de ciberseguridad, cuestionarios o cláusulas? ¿Cuáles?',
          [o('Sí'), o('Algunos'), o('No'), o('No sé')],
          '¿Cuáles?',
        ),
        choice(
          '8.2',
          '¿Han arriesgado o perdido negocio por no cumplir requisitos de seguridad de un cliente?',
          [o('Sí, lo perdimos'), o('Lo arriesgamos'), o('No'), o('No sé')],
        ),
        scale('8.3', '¿Evalúan la seguridad de sus propios proveedores de TI, software o servicios?'),
        choice(
          '8.4',
          '¿Dependen de proveedores críticos (ERP, nube, soporte TI) con acceso a sus sistemas o datos?',
          SI_NO(),
          '¿Cuáles?',
        ),
        scale('8.5', '¿Tienen acuerdos de nivel de servicio (SLA) y confidencialidad con esos proveedores?'),
      ],
    },
    {
      id: 'b9',
      number: 9,
      title: 'Operación en faena y tecnología OT/automatización',
      short: 'Faena y OT',
      chartLabel: 'Faena / OT',
      intro: 'Operaciones en terreno y equipos automatizados (p. ej. robots cambiadores de triconos).',
      scored: true,
      questions: [
        choice('9.1', '¿Operan equipos automatizados, sensores o tecnología conectada en faena? (IoT/OT)', SI_NO(), '¿Qué equipos?'),
        choice(
          '9.2',
          '¿Esos equipos se conectan a internet o a redes del cliente? ¿Quién los administra?',
          [o('Sí'), o('No'), o('No sé'), o('No aplica')],
          '¿Quién los administra?',
        ),
        choice('9.3', '¿Se actualizan y protegen esos sistemas, o quedan «como vienen de fábrica»?', [
          o('Se actualizan y protegen', 1),
          o('A veces', 0.5),
          o('Quedan de fábrica', 0),
          o('No sé', 0),
          o('No aplica', null),
        ]),
        choice('9.4', '¿Circulan datos operacionales o de clientes desde la faena hacia la oficina?', SI_NO(), '¿Cómo viajan?'),
        scale('9.5', '¿Los equipos de terreno (notebooks, tablets, móviles) tienen protección y cifrado?'),
      ],
    },
    {
      id: 'b10',
      number: 10,
      title: 'Personas y cultura de seguridad',
      short: 'Personas y cultura',
      chartLabel: 'Personas',
      intro: 'El factor humano, origen de la mayoría de los incidentes.',
      scored: true,
      questions: [
        scale('10.1', '¿Capacitan a los trabajadores en ciberseguridad? (phishing, contraseñas) ¿Con qué frecuencia?', '¿Con qué frecuencia?'),
        scale('10.2', '¿Han hecho campañas o simulacros de phishing?'),
        scale('10.3', '¿Los trabajadores saben cómo y a quién reportar algo sospechoso?'),
        scale('10.4', '¿Hay control sobre uso de dispositivos personales, USB y correo personal en equipos de trabajo?'),
        scale('10.5', '¿Gerencia y áreas sensibles (finanzas, RR.HH.) conocen los fraudes dirigidos? (BEC / «fraude del CEO»)'),
      ],
    },
  ],

  priorities: {
    title: 'Priorización de dominios',
    intro:
      'El bloque más importante: define por dónde partir. Ordena los dominios del más urgente (1) al menos urgente (10) según tu realidad.',
    domains: [
      'Gobierno y políticas',
      'Protección de datos (Ley 21.719)',
      'Endpoints e infraestructura',
      'Identidad y accesos (MFA)',
      'Detección y respuesta a incidentes',
      'Continuidad y respaldos',
      'Terceros y exigencias de clientes',
      'Operación en faena / OT',
      'Cultura y capacitación',
      'Cumplimiento regulatorio',
    ],
  },

  closing: {
    title: 'Preguntas de cierre',
    intro: 'Lo que define el alcance del trabajo.',
    questions: [
      open('11.1', 'Si pudieran resolver UNA sola cosa de seguridad este año, ¿cuál sería?'),
      multi(
        '11.2',
        '¿Qué escenario les preocupa más?',
        [
          o('Ransomware que detiene la operación'),
          o('Fuga de datos'),
          o('Fraude o transferencia'),
          o('Perder un cliente por no cumplir'),
          o('Multa regulatoria'),
        ],
        'Otro escenario o contexto',
      ),
      open(
        '11.3',
        '¿Hay algún plazo o hito concreto? (auditoría de un cliente, renovación de contrato, licitación, requisito legal)',
      ),
      choice(
        '11.4',
        '¿Existe presupuesto asignado o aún por definir para seguridad este año?',
        [o('Asignado'), o('Por definir'), o('No hay presupuesto'), o('No sé')],
        'Rango aproximado, si es posible',
      ),
      open('11.5', '¿Quién toma la decisión y quién la patrocina internamente?'),
      choice(
        '11.6',
        '¿En qué plazo esperarían ver resultados?',
        [o('30 días'), o('90 días'), o('180 días'), o('Más adelante')],
      ),
      open('11.7', '¿Cómo se vería el «éxito» de este trabajo para ustedes?'),
    ],
  },
};
