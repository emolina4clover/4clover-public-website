import type { Option, Question, Score } from './types';

/** Escala estándar del documento: Sí / Parcial / No / No sé / N/A. */
export const SCALE: Option[] = [
  { value: 'si', label: 'Sí', hint: 'Implementado y operando', score: 1 },
  { value: 'parcial', label: 'Parcial', hint: 'Existe, pero incompleto o informal', score: 0.5 },
  { value: 'no', label: 'No', hint: 'No existe', score: 0 },
  // "No sé" cuenta como brecha: lo que no se conoce, no se está gestionando.
  { value: 'nose', label: 'No sé', hint: 'Se desconoce', score: 0 },
  { value: 'na', label: 'N/A', hint: 'No aplica a la empresa', score: null },
];

export const LEVELS = [
  { min: 0, label: 'Inicial', text: 'La seguridad depende de personas y buena voluntad; faltan controles básicos.' },
  { min: 25, label: 'En desarrollo', text: 'Hay controles, pero informales o incompletos.' },
  { min: 50, label: 'Definido', text: 'Los controles principales existen y se aplican de forma consistente.' },
  { min: 75, label: 'Avanzado', text: 'Controles maduros, revisados y medidos.' },
] as const;

export function levelFor(pct: number | null): string | null {
  if (pct === null) return null;
  let label: string = LEVELS[0].label;
  for (const l of LEVELS) if (pct >= l.min) label = l.label;
  return label;
}

export function optionsOf(q: Question): Option[] {
  return q.type === 'scale' ? SCALE : (q.options ?? []);
}

/** ¿La pregunta aporta al puntaje? (tiene al menos una opción con puntaje numérico). */
export function isScored(q: Question): boolean {
  if (q.type === 'multi' || q.type === 'text') return false;
  return optionsOf(q).some((o) => typeof o.score === 'number');
}

/** Puntaje de una respuesta: 0..1, o null si no puntúa / sin responder. */
export function scoreOf(q: Question, value: string | string[] | undefined | null): Score {
  if (!isScored(q) || typeof value !== 'string') return null;
  const o = optionsOf(q).find((x) => x.value === value);
  return typeof o?.score === 'number' ? o.score : null;
}

/** Promedio en porcentaje (0..100, entero) o null si no hay valores. */
export function averagePct(values: Score[]): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number');
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100);
}
