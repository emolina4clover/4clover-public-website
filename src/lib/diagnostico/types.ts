/**
 * Modelo de datos del auto-diagnóstico.
 *
 * Un diagnóstico es 100 % declarativo: el texto de cada pregunta, sus opciones y
 * cuánto aporta cada opción al puntaje viven en un archivo de datos
 * (src/data/diagnosticos/*.ts). La página, el cifrado y el visor no conocen
 * preguntas concretas.
 */

/** Aporte de una opción al puntaje de madurez: 0 a 1. `null` = no puntúa (N/A, contexto). */
export type Score = number | null;

export interface Option {
  value: string;
  label: string;
  /** Explicación corta (p. ej. "Implementado y operando"). */
  hint?: string;
  /** Si se omite, la opción no puntúa. */
  score?: Score;
  /** En preguntas de selección múltiple: elegirla desmarca las demás (p. ej. "Ninguno"). */
  exclusive?: boolean;
}

export type QuestionType = 'scale' | 'choice' | 'multi' | 'text';

export interface Question {
  /** Numeración del documento original, p. ej. "2.1". */
  id: string;
  text: string;
  type: QuestionType;
  options?: Option[];
  /** Placeholder del campo "detalle". `false` = sin campo de detalle. */
  detail?: string | false;
  /** Placeholder para preguntas abiertas (type: 'text'). */
  placeholder?: string;
}

export interface Block {
  id: string;
  number: number;
  /** Título completo, como en el documento. */
  title: string;
  /** Nombre corto para la navegación. */
  short: string;
  /** Etiqueta muy corta para el gráfico de resultados. */
  chartLabel: string;
  intro: string;
  /** `false` = bloque de contexto, no entra al puntaje de madurez. */
  scored: boolean;
  questions: Question[];
}

export interface Diagnostico {
  /** Identificador interno (aparece en el asunto del correo y en el visor). */
  id: string;
  /** Segmento de URL. Incluye un token aleatorio para que la URL no sea adivinable. */
  slug: string;
  /** Versión del cuestionario; viaja en cada respuesta. */
  version: string;
  company: string;
  title: string;
  subtitle: string;
  purpose: string;
  estimate: string;
  howTo: string;
  /** Asunto del correo que llega vía Formspree (texto plano: no poner datos sensibles). */
  emailSubject: string;
  blocks: Block[];
  priorities: {
    title: string;
    intro: string;
    domains: string[];
  };
  closing: {
    title: string;
    intro: string;
    questions: Question[];
  };
  thanks: string;
}

/* ------------------------------------------------------------------ */
/* Respuesta descifrada (lo que lee el visor)                          */
/* ------------------------------------------------------------------ */

export interface AnswerOut {
  id: string;
  text: string;
  type: QuestionType;
  /** Valor(es) crudo(s) elegidos. */
  value: string | string[] | null;
  /** Etiqueta(s) legibles. */
  answer: string | null;
  score: Score;
  detail: string | null;
}

export interface BlockOut {
  id: string;
  number: number;
  title: string;
  short: string;
  scored: boolean;
  /** 0 a 100, o null si no hay respuestas que puntúen. */
  score: number | null;
  level: string | null;
  questions: AnswerOut[];
}

export interface SubmissionPayload {
  v: 1;
  diagnostico: { id: string; version: string; company: string; title: string };
  submittedAt: string;
  ident: {
    empresa: string;
    nombre: string;
    cargo: string;
    correo: string;
    telefono: string;
  };
  consent: boolean;
  summary: {
    overall: number | null;
    level: string | null;
    answered: number;
    total: number;
    unknown: number;
  };
  blocks: BlockOut[];
  priorities: {
    reordered: boolean;
    ranking: { rank: number; domain: string; why: string | null }[];
  };
  closing: AnswerOut[];
}
