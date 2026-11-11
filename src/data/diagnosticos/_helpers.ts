import type { Option, Question } from '../../lib/diagnostico/types';

/** Valor estable a partir de la etiqueta: "No sé" -> "no-se". */
function slug(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Opción. `score` omitido = no puntúa. */
export function o(label: string, score?: number | null, extra: Partial<Option> = {}): Option {
  return { value: slug(label), label, ...(score === undefined ? {} : { score }), ...extra };
}

/** Pregunta con la escala estándar Sí / Parcial / No / No sé / N/A (puntúa). */
export function scale(id: string, text: string, detail?: string): Question {
  return { id, text, type: 'scale', detail: detail ?? '' };
}

/** Selección única con opciones propias. Puntúa si alguna opción trae puntaje. */
export function choice(id: string, text: string, options: Option[], detail?: string): Question {
  return { id, text, type: 'choice', options, detail: detail ?? '' };
}

/** Selección múltiple (no puntúa). */
export function multi(id: string, text: string, options: Option[], detail?: string): Question {
  return { id, text, type: 'multi', options, detail: detail ?? '' };
}

/** Pregunta abierta. */
export function open(id: string, text: string, placeholder?: string): Question {
  return { id, text, type: 'text', detail: false, placeholder };
}

/** Sí / No / No sé informativo (no puntúa). */
export const SI_NO = (): Option[] => [o('Sí'), o('No'), o('No sé')];
