/**
 * Lógica del auto-diagnóstico (cliente). La página llega completa desde el
 * servidor; aquí se manejan estado, navegación, avance local, puntaje y envío.
 *
 * Seguridad:
 * - Nunca se envía texto plano: si el cifrado falla, no se envía nada.
 * - Todo texto que se inserta como HTML pasa por esc().
 * - El avance se guarda solo en localStorage de este navegador y se borra al enviar.
 */
import { cryptoAvailable, encryptForRecipient } from '../lib/diagnostico/crypto';
import { LEVELS, averagePct, levelFor, optionsOf, scoreOf } from '../lib/diagnostico/scoring';
import { iconSvg } from '../lib/diagnostico/icons';
import type { AnswerOut, BlockOut, Diagnostico, Question, SubmissionPayload } from '../lib/diagnostico/types';

// El cifrado (Web Crypto) solo existe en HTTPS. nginx ya redirige; esto es el respaldo.
if (location.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
  location.replace(`https://${location.host}${location.pathname}${location.search}${location.hash}`);
}

/* ------------------------------------------------------------------ */
/* Config y estado                                                     */
/* ------------------------------------------------------------------ */

type Config = Pick<Diagnostico, 'id' | 'version' | 'company' | 'title' | 'emailSubject' | 'thanks' | 'blocks' | 'priorities' | 'closing'> & {
  publicKey: string;
  endpoint: string;
  calendly: string;
  contactEmail: string;
};

type IdentKey = 'empresa' | 'nombre' | 'cargo' | 'correo' | 'telefono';
interface Answer {
  v?: string | string[];
  d?: string;
}
interface State {
  v: 1;
  step: string;
  ident: Record<IdentKey, string>;
  answers: Record<string, Answer>;
  prio: { order: string[]; why: Record<string, string>; touched: boolean };
  consent: boolean;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const cfg: Config = JSON.parse($('dg-config').textContent || '{}');

const STORAGE_KEY = `4clover-diagnostico:${cfg.id}:${cfg.version}`;
const IDENT_KEYS: IdentKey[] = ['empresa', 'nombre', 'cargo', 'correo', 'telefono'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const blockStep = (n: number) => `bloque-${n}`;
const STEPS = ['identificacion', ...cfg.blocks.map((b) => blockStep(b.number)), 'prioridades', 'cierre', 'revision'];
const STEP_QUESTIONS: Record<string, Question[]> = {
  ...Object.fromEntries(cfg.blocks.map((b) => [blockStep(b.number), b.questions])),
  cierre: cfg.closing.questions,
};
const ALL_QUESTIONS = Object.values(STEP_QUESTIONS).flat();
const Q_BY_ID = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));

function freshState(): State {
  return {
    v: 1,
    step: STEPS[0],
    ident: { empresa: cfg.company, nombre: '', cargo: '', correo: '', telefono: '' },
    answers: {},
    prio: { order: [...cfg.priorities.domains], why: {}, touched: false },
    consent: false,
  };
}

function loadDraft(): State | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as State;
    if (s?.v !== 1 || typeof s.answers !== 'object') return null;
    const base = freshState();
    // Si cambió la lista de dominios, se conserva el orden de los que siguen existiendo.
    const known = new Set(base.prio.order);
    const order = (s.prio?.order ?? []).filter((x) => known.has(x));
    for (const x of base.prio.order) if (!order.includes(x)) order.push(x);
    return {
      ...base,
      ...s,
      ident: { ...base.ident, ...s.ident },
      prio: { order, why: s.prio?.why ?? {}, touched: !!s.prio?.touched },
      step: STEPS.includes(s.step) ? s.step : base.step,
    };
  } catch {
    return null;
  }
}

/** ¿Hay algo que valga la pena retomar? (navegar sin responder no cuenta). */
function hasContent(s: State): boolean {
  const filled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : typeof v === 'string' && v.trim().length > 0);
  return (
    Object.values(s.answers).some((a) => filled(a.v) || filled(a.d)) ||
    ['nombre', 'cargo', 'correo', 'telefono'].some((k) => filled(s.ident[k as IdentKey])) ||
    Object.values(s.prio.why).some(filled) ||
    s.prio.touched
  );
}

let state: State = loadDraft() ?? freshState();
let current = 'intro';
let submitted = false;
let lastArmored: string | null = null;

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function isAnswered(q: Question): boolean {
  const v = state.answers[q.id]?.v;
  if (Array.isArray(v)) return v.length > 0;
  return typeof v === 'string' && v.trim().length > 0;
}

function identValid(): { nombre: boolean; correo: boolean } {
  return { nombre: state.ident.nombre.trim().length > 1, correo: EMAIL_RE.test(state.ident.correo.trim()) };
}

function stepCounts(step: string): { done: number; total: number } | null {
  const qs = STEP_QUESTIONS[step];
  if (!qs) return null;
  return { done: qs.filter(isAnswered).length, total: qs.length };
}

function stepComplete(step: string): boolean {
  if (step === 'identificacion') {
    const v = identValid();
    return v.nombre && v.correo;
  }
  if (step === 'prioridades') return state.prio.touched;
  const c = stepCounts(step);
  return !!c && c.done === c.total;
}

function stepLabel(step: string): string {
  const a = document.querySelector<HTMLElement>(`[data-nav="${step}"] .truncate`);
  return a?.textContent?.trim() ?? step;
}

/* ------------------------------------------------------------------ */
/* Guardado local                                                      */
/* ------------------------------------------------------------------ */

const saveEl = $('dg-save');
let saveTimer: number | undefined;
let saveMsgTimer: number | undefined;

function writeDraft(showStatus: boolean): void {
  window.clearTimeout(saveTimer);
  saveTimer = undefined;
  if (submitted) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    return; /* almacenamiento bloqueado (modo privado, etc.): se sigue sin guardar */
  }
  if (!showStatus) return;
  saveEl.innerHTML = `${iconSvg('check', 'w-3.5 h-3.5 text-dg-brand')}<span class="hidden sm:inline">Avance guardado</span>`;
  saveEl.classList.replace('hidden', 'inline-flex');
  window.clearTimeout(saveMsgTimer);
  saveMsgTimer = window.setTimeout(() => saveEl.classList.replace('inline-flex', 'hidden'), 1800);
}

function save(): void {
  if (submitted) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => writeDraft(true), 350);
}

/** Guarda de inmediato lo pendiente si el usuario cierra o cambia de pestaña. */
function flushSave(): void {
  if (saveTimer !== undefined) writeDraft(false);
}
window.addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSave();
});

function clearDraft(): void {
  window.clearTimeout(saveTimer);
  saveTimer = undefined;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nada */
  }
}

/* ------------------------------------------------------------------ */
/* Formulario <-> estado                                               */
/* ------------------------------------------------------------------ */

const form = $<HTMLFormElement>('dg-form');

function fieldsetOf(qid: string): HTMLFieldSetElement | null {
  return document.querySelector<HTMLFieldSetElement>(`fieldset[data-qid="${CSS.escape(qid)}"]`);
}

function revealDetail(container: Element | null, focus = false): void {
  if (!container) return;
  const btn = container.querySelector<HTMLButtonElement>('.dg-detail-toggle');
  const panelId = btn?.getAttribute('aria-controls');
  const panel = panelId ? document.getElementById(panelId) : null;
  if (!btn || !panel) return;
  panel.hidden = false;
  btn.hidden = true;
  btn.setAttribute('aria-expanded', 'true');
  if (focus) panel.querySelector<HTMLElement>('textarea, input')?.focus();
}

function markAnswered(qid: string): void {
  const q = Q_BY_ID.get(qid);
  const fs = fieldsetOf(qid);
  if (q && fs) fs.dataset.answered = String(isAnswered(q));
}

function hydrate(): void {
  for (const k of IDENT_KEYS) {
    const el = form.elements.namedItem(`i-${k}`) as HTMLInputElement | null;
    if (el) el.value = state.ident[k] ?? '';
  }
  for (const q of ALL_QUESTIONS) {
    const a = state.answers[q.id] ?? {};
    const fs = fieldsetOf(q.id);
    if (!fs) continue;
    if (q.type === 'text') {
      const ta = fs.querySelector<HTMLTextAreaElement>('textarea[name^="t-"]');
      if (ta) ta.value = typeof a.v === 'string' ? a.v : '';
    } else {
      const vals = Array.isArray(a.v) ? a.v : typeof a.v === 'string' ? [a.v] : [];
      fs.querySelectorAll<HTMLInputElement>(`input[name="q-${CSS.escape(q.id)}"]`).forEach((inp) => {
        inp.checked = vals.includes(inp.value);
      });
    }
    const det = fs.querySelector<HTMLTextAreaElement>('textarea[name^="d-"]');
    if (det) {
      det.value = a.d ?? '';
      if (det.value) revealDetail(fs);
    }
    markAnswered(q.id);
  }
  // Prioridades
  const list = $<HTMLOListElement>('dg-prio');
  for (const dom of state.prio.order) {
    const li = list.querySelector<HTMLLIElement>(`li[data-domain="${CSS.escape(dom)}"]`);
    if (li) list.appendChild(li);
    const inp = li?.querySelector<HTMLInputElement>('input');
    if (inp) {
      inp.value = state.prio.why[dom] ?? '';
      if (inp.value) revealDetail(li!);
    }
  }
  renumberPrio();
  syncPrioOk();
  $<HTMLInputElement>('dg-consent').checked = state.consent;
}

function onFieldChange(e: Event): void {
  const el = e.target as HTMLInputElement | HTMLTextAreaElement;
  const name = el.name ?? '';
  if (!name || name === '_gotcha') return;

  if (name.startsWith('i-')) {
    const k = name.slice(2) as IdentKey;
    if (IDENT_KEYS.includes(k)) state.ident[k] = el.value;
    if (k === 'nombre' || k === 'correo') clearIdentError(k);
  } else if (name.startsWith('q-')) {
    const qid = name.slice(2);
    const q = Q_BY_ID.get(qid);
    if (!q) return;
    const a = (state.answers[qid] ??= {});
    if (q.type === 'multi') {
      const fs = fieldsetOf(qid)!;
      const boxes = [...fs.querySelectorAll<HTMLInputElement>(`input[name="q-${CSS.escape(qid)}"]`)];
      const changed = el as HTMLInputElement;
      if (changed.checked) {
        const exclusive = changed.dataset.exclusive === 'true';
        for (const b of boxes) {
          if (b === changed) continue;
          if (exclusive || b.dataset.exclusive === 'true') b.checked = false;
        }
      }
      a.v = boxes.filter((b) => b.checked).map((b) => b.value);
    } else {
      a.v = el.value;
    }
    markAnswered(qid);
  } else if (name.startsWith('t-')) {
    const qid = name.slice(2);
    (state.answers[qid] ??= {}).v = el.value;
    markAnswered(qid);
  } else if (name.startsWith('d-')) {
    (state.answers[name.slice(2)] ??= {}).d = el.value;
  } else if (name.startsWith('w-')) {
    state.prio.why[name.slice(2)] = el.value;
  } else if (name === 'consent') {
    state.consent = (el as HTMLInputElement).checked;
  }
  // Si hay errores de envío a la vista, se recalculan (no se ocultan todos de golpe).
  if (!$('dg-errors').hidden) renderErrors(validateForSubmit());
  updateProgress();
  save();
}

// Ambos eventos: el procesamiento es idempotente y así no depende de cómo cada navegador dispare "input" en radios.
form.addEventListener('input', onFieldChange);
form.addEventListener('change', onFieldChange);
form.addEventListener('submit', (e) => e.preventDefault());

// "Agregar detalle" / "¿Por qué?"
document.addEventListener('click', (e) => {
  const btn = (e.target as Element).closest<HTMLButtonElement>('.dg-detail-toggle');
  if (btn) revealDetail(btn.parentElement, true);
});

/* ------------------------------------------------------------------ */
/* Identificación                                                      */
/* ------------------------------------------------------------------ */

function setIdentError(k: 'nombre' | 'correo', on: boolean): void {
  const input = $<HTMLInputElement>(`i-${k}`);
  input.setAttribute('aria-invalid', String(on));
  $(`e-${k}`).hidden = !on;
}
function clearIdentError(k: 'nombre' | 'correo'): void {
  if ($(`e-${k}`).hidden) return;
  const v = identValid();
  if (v[k]) setIdentError(k, false);
}
function checkIdent(focus: boolean): boolean {
  const v = identValid();
  setIdentError('nombre', !v.nombre);
  setIdentError('correo', !v.correo);
  if (focus && (!v.nombre || !v.correo)) $(`i-${!v.nombre ? 'nombre' : 'correo'}`).focus();
  return v.nombre && v.correo;
}

/* ------------------------------------------------------------------ */
/* Prioridades: arrastrar y flechas                                    */
/* ------------------------------------------------------------------ */

const prioList = $<HTMLOListElement>('dg-prio');

function renumberPrio(): void {
  const items = [...prioList.children] as HTMLLIElement[];
  items.forEach((li, i) => {
    li.querySelector('[data-rank]')!.textContent = String(i + 1);
    (li.querySelector('[data-move="up"]') as HTMLButtonElement).disabled = i === 0;
    (li.querySelector('[data-move="down"]') as HTMLButtonElement).disabled = i === items.length - 1;
  });
}

function syncPrioOk(): void {
  const b = $('dg-prio-ok');
  b.innerHTML = state.prio.touched
    ? `${iconSvg('check', 'w-4 h-4')}<span>Orden confirmado</span>`
    : '<span>Este orden está bien</span>';
}

function commitPrio(announce?: HTMLLIElement): void {
  state.prio.order = ([...prioList.children] as HTMLLIElement[]).map((li) => li.dataset.domain!);
  state.prio.touched = true;
  renumberPrio();
  syncPrioOk();
  if (announce) {
    const pos = state.prio.order.indexOf(announce.dataset.domain!) + 1;
    $('dg-prio-live').textContent = `${announce.dataset.domain} en la posición ${pos}`;
  }
  updateProgress();
  save();
}

$('dg-prio-ok').addEventListener('click', () => {
  commitPrio();
  $('dg-prio-live').textContent = 'Orden de prioridades confirmado';
});

prioList.addEventListener('click', (e) => {
  const btn = (e.target as Element).closest<HTMLButtonElement>('[data-move]');
  if (!btn) return;
  const li = btn.closest('li')!;
  // Se mueve la vecina (no la fila) para no perder el foco del botón.
  if (btn.dataset.move === 'up' && li.previousElementSibling) prioList.insertBefore(li.previousElementSibling, li.nextSibling);
  if (btn.dataset.move === 'down' && li.nextElementSibling) prioList.insertBefore(li.nextElementSibling, li);
  commitPrio(li);
  // Mantener el foco en el mismo control tras moverlo (o en el otro si quedó deshabilitado).
  (btn.disabled ? li.querySelector<HTMLButtonElement>(`[data-move="${btn.dataset.move === 'up' ? 'down' : 'up'}"]`) : btn)?.focus();
});

prioList.addEventListener('pointerdown', (e) => {
  const grip = (e.target as Element).closest<HTMLButtonElement>('.dg-grip');
  if (!grip || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.preventDefault();
  const li = grip.closest('li')!;
  grip.setPointerCapture(e.pointerId);
  li.classList.add('dg-dragging');

  const midY = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2;
  };
  const onMove = (ev: PointerEvent) => {
    // Mueve la fila hasta que el puntero quede entre los centros de sus vecinas (cubre arrastres rápidos).
    let prevEl: Element | null;
    let nextEl: Element | null;
    // Se mueven las vecinas, nunca la fila arrastrada: sacarla del DOM soltaría la captura del puntero.
    while ((prevEl = li.previousElementSibling) && ev.clientY < midY(prevEl)) prioList.insertBefore(prevEl, li.nextSibling);
    while ((nextEl = li.nextElementSibling) && ev.clientY > midY(nextEl)) prioList.insertBefore(nextEl, li);
    // Desplazamiento automático cerca de los bordes (móvil)
    if (ev.clientY < 90) window.scrollBy(0, -10);
    else if (ev.clientY > window.innerHeight - 90) window.scrollBy(0, 10);
    renumberPrio();
  };
  const onEnd = (ev: PointerEvent) => {
    if (ev.type === 'pointerup') onMove(ev); // posición final, por si no llegó un último pointermove
    li.classList.remove('dg-dragging');
    grip.removeEventListener('pointermove', onMove);
    grip.removeEventListener('pointerup', onEnd);
    grip.removeEventListener('pointercancel', onEnd);
    commitPrio(li);
  };
  grip.addEventListener('pointermove', onMove);
  grip.addEventListener('pointerup', onEnd);
  grip.addEventListener('pointercancel', onEnd);
});

/* ------------------------------------------------------------------ */
/* Navegación                                                          */
/* ------------------------------------------------------------------ */

const intro = $('dg-intro');
const wizard = $('dg-wizard');
const result = $('dg-result');
const progressTrack = $('dg-progress-track');
const jump = $<HTMLSelectElement>('dg-jump');

function totalProgress(): number {
  const done = ALL_QUESTIONS.filter(isAnswered).length;
  return ALL_QUESTIONS.length ? done / ALL_QUESTIONS.length : 0;
}

function updateProgress(): void {
  $('dg-progress').style.transform = `scaleX(${totalProgress()})`;
  for (const step of STEPS) {
    const a = document.querySelector<HTMLElement>(`[data-nav="${step}"]`);
    if (!a) continue;
    const c = stepCounts(step);
    a.querySelector('[data-nav-count]')!.textContent = c ? `${c.done}/${c.total}` : '';
    (a.querySelector('[data-nav-mark]') as HTMLElement).dataset.done = String(step !== 'revision' && stepComplete(step));
    const opt = jump.querySelector<HTMLOptionElement>(`option[value="${step}"]`);
    if (opt) {
      opt.dataset.base ??= opt.textContent ?? '';
      opt.textContent = c ? `${opt.dataset.base} (${c.done}/${c.total})` : opt.dataset.base;
    }
  }
  if (current === 'revision') renderReview();
}

function show(id: string, opts: { push?: boolean; focus?: boolean } = {}): void {
  const { push = true, focus = true } = opts;
  if (submitted) id = 'resultado';
  current = id;

  intro.hidden = id !== 'intro';
  if (id === 'intro') renderIntro();
  wizard.hidden = !STEPS.includes(id);
  result.hidden = id !== 'resultado';
  progressTrack.hidden = !STEPS.includes(id);

  if (STEPS.includes(id)) {
    form.querySelectorAll<HTMLElement>('section[data-step]').forEach((s) => {
      const on = s.dataset.step === id;
      s.hidden = !on;
      if (on) {
        s.classList.remove('dg-step-enter');
        void s.offsetWidth;
        s.classList.add('dg-step-enter');
      }
    });
    document.querySelectorAll<HTMLElement>('[data-nav]').forEach((a) => {
      if (a.dataset.nav === id) a.setAttribute('aria-current', 'step');
      else a.removeAttribute('aria-current');
    });
    jump.value = id;
    const i = STEPS.indexOf(id);
    $('dg-stepinfo').innerHTML = `<span class="hidden min-[400px]:inline">Paso </span>${i + 1} de ${STEPS.length}`;
    $('dg-next').hidden = id === 'revision';
    $('dg-next-label').textContent = id === 'cierre' ? 'Revisar y enviar' : 'Siguiente';
    if (id === 'revision') renderReview();
    state.step = id;
    save();
  }

  if (push) history.pushState({ step: id }, '', `#${id}`);
  window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  if (focus) {
    const heading =
      id === 'resultado'
        ? $('h-result')
        : STEPS.includes(id)
          ? form.querySelector<HTMLElement>(`section[data-step="${id}"] h2`)
          : null;
    heading?.focus({ preventScroll: true });
  }
}

function next(): void {
  const i = STEPS.indexOf(current);
  if (current === 'identificacion' && !checkIdent(true)) return;
  if (i >= 0 && i < STEPS.length - 1) show(STEPS[i + 1]);
}
function prev(): void {
  const i = STEPS.indexOf(current);
  if (i > 0) show(STEPS[i - 1]);
  else show('intro');
}

$('dg-next').addEventListener('click', next);
$('dg-prev').addEventListener('click', prev);
jump.addEventListener('change', () => show(jump.value));
document.querySelectorAll<HTMLAnchorElement>('[data-nav]').forEach((a) =>
  a.addEventListener('click', (e) => {
    e.preventDefault();
    show(a.dataset.nav!);
  }),
);
window.addEventListener('popstate', () => {
  const id = location.hash.slice(1);
  show(STEPS.includes(id) ? id : 'intro', { push: false });
});

/** Lleva a una pregunta y la resalta un momento. */
function goToQuestion(qid: string): void {
  const step = Object.keys(STEP_QUESTIONS).find((s) => STEP_QUESTIONS[s].some((q) => q.id === qid));
  if (!step) return;
  show(step, { focus: false });
  const fs = fieldsetOf(qid);
  if (!fs) return;
  requestAnimationFrame(() => {
    fs.scrollIntoView({ block: 'center' });
    fs.dataset.flash = 'true';
    fs.querySelector<HTMLInputElement>('input, textarea')?.focus({ preventScroll: true });
    window.setTimeout(() => (fs.dataset.flash = 'false'), 1600);
  });
}

/* ------------------------------------------------------------------ */
/* Bienvenida                                                          */
/* ------------------------------------------------------------------ */

const resumable = () => hasContent(state);

function renderIntro(): void {
  const pct = Math.round(totalProgress() * 100);
  const resume = resumable();
  $('dg-start-label').textContent = resume ? `Continuar (${pct} %)` : 'Comenzar';
  $('dg-reset').hidden = !resume;
  const note = $('dg-draft-note');
  note.hidden = !resume;
  note.textContent = resume ? 'Encontramos un avance guardado en este navegador.' : '';
}

$('dg-start').addEventListener('click', () => show(resumable() ? state.step : STEPS[0]));

let resetArmed: number | undefined;
$('dg-reset').addEventListener('click', () => {
  const btn = $('dg-reset');
  const label = btn.querySelector('span')!;
  if (!resetArmed) {
    label.textContent = 'Confirmar: borrar avance';
    resetArmed = window.setTimeout(() => {
      label.textContent = 'Empezar de nuevo';
      resetArmed = undefined;
    }, 4000);
    return;
  }
  window.clearTimeout(resetArmed);
  resetArmed = undefined;
  label.textContent = 'Empezar de nuevo';
  clearDraft();
  state = freshState();
  form.reset();
  document.querySelectorAll<HTMLElement>('.dg-detail-toggle').forEach((b) => {
    b.hidden = false;
    b.setAttribute('aria-expanded', 'false');
    const p = document.getElementById(b.getAttribute('aria-controls') ?? '');
    if (p) p.hidden = true;
  });
  hydrate();
  updateProgress();
  renderIntro();
  $('dg-start').focus(); // el botón que tenía el foco quedó oculto
});

/* ------------------------------------------------------------------ */
/* Revisión                                                            */
/* ------------------------------------------------------------------ */

function renderReview(): void {
  const rows: string[] = [];
  for (const step of STEPS.slice(0, -1)) {
    const c = stepCounts(step);
    const ok = stepComplete(step);
    let status = '';
    let missing: string[] = [];
    if (step === 'identificacion') {
      const v = identValid();
      status = ok ? 'Completa' : `Falta ${[!v.nombre && 'nombre', !v.correo && 'correo'].filter(Boolean).join(' y ')}`;
    } else if (step === 'prioridades') {
      status = ok ? 'Ordenadas' : 'Sin ordenar (se enviará el orden actual)';
    } else if (c) {
      status = `${c.done} de ${c.total}`;
      missing = STEP_QUESTIONS[step].filter((q) => !isAnswered(q)).map((q) => q.id);
    }
    const required = step === 'identificacion' && !ok;
    const chips = missing
      .slice(0, 8)
      .map((id) => `<button type="button" data-goto-q="${esc(id)}" class="inline-flex items-center justify-center min-h-8 min-w-8 rounded-md bg-dg-sunken px-2 text-xs tabular-nums text-dg-muted hover:text-dg-ink hover:bg-dg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dg-brand">${esc(id)}</button>`)
      .join('');
    const more = missing.length > 8 ? `<span class="text-xs text-dg-muted">+${missing.length - 8}</span>` : '';
    rows.push(`
      <div class="flex items-center gap-3 px-4 py-3 sm:px-5">
        <span class="shrink-0 grid place-items-center w-6 h-6 rounded-full ${ok ? 'bg-dg-brand text-dg-on-brand' : required ? 'bg-dg-danger-soft text-dg-danger' : 'bg-dg-sunken text-dg-muted'}">
          ${ok ? iconSvg('check', 'w-3.5 h-3.5') : required ? iconSvg('alert', 'w-3.5 h-3.5') : '<span class="w-1.5 h-1.5 rounded-full bg-current"></span>'}
        </span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-dg-ink truncate">${esc(stepLabel(step))}</p>
          <p class="text-xs ${required ? 'text-dg-danger' : 'text-dg-muted'}">${esc(status)}</p>
          ${missing.length ? `<div class="mt-1.5 flex flex-wrap items-center gap-1"><span class="text-xs text-dg-muted mr-0.5">Sin responder:</span>${chips}${more}</div>` : ''}
        </div>
        <button type="button" data-goto-step="${step}" class="shrink-0 text-sm font-medium text-dg-brand hover:underline underline-offset-4 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dg-brand">${ok ? 'Ver' : 'Completar'}</button>
      </div>`);
  }
  $('dg-review').innerHTML = rows.join('');
}

$('dg-review').addEventListener('click', (e) => {
  const t = e.target as Element;
  const q = t.closest<HTMLElement>('[data-goto-q]');
  if (q) return goToQuestion(q.dataset.gotoQ!);
  const s = t.closest<HTMLElement>('[data-goto-step]');
  if (s) show(s.dataset.gotoStep!);
});

/* ------------------------------------------------------------------ */
/* Respuesta, puntaje y envío                                          */
/* ------------------------------------------------------------------ */

function answerOut(q: Question): AnswerOut {
  const a = state.answers[q.id] ?? {};
  const opts = optionsOf(q);
  const labelOf = (v: string) => opts.find((o) => o.value === v)?.label ?? v;
  let value: string | string[] | null = null;
  let answer: string | null = null;
  if (q.type === 'text') {
    value = typeof a.v === 'string' && a.v.trim() ? a.v.trim() : null;
    answer = value as string | null;
  } else if (q.type === 'multi') {
    const arr = Array.isArray(a.v) ? a.v : [];
    value = arr.length ? arr : null;
    answer = arr.length ? arr.map(labelOf).join(', ') : null;
  } else if (typeof a.v === 'string' && a.v) {
    value = a.v;
    answer = labelOf(a.v);
  }
  return { id: q.id, text: q.text, type: q.type, value, answer, score: scoreOf(q, value), detail: a.d?.trim() || null };
}

function buildPayload(): SubmissionPayload {
  const blocks: BlockOut[] = cfg.blocks.map((b) => {
    const questions = b.questions.map(answerOut);
    const score = b.scored ? averagePct(questions.map((q) => q.score)) : null;
    return { id: b.id, number: b.number, title: b.title, short: b.short, scored: b.scored, score, level: levelFor(score), questions };
  });
  const closing = cfg.closing.questions.map(answerOut);
  const scored = blocks.filter((b) => b.score !== null).map((b) => b.score as number);
  const overall = scored.length ? Math.round(scored.reduce((x, y) => x + y, 0) / scored.length) : null;
  const all = [...blocks.flatMap((b) => b.questions), ...closing];
  return {
    v: 1,
    diagnostico: { id: cfg.id, version: cfg.version, company: cfg.company, title: cfg.title },
    submittedAt: new Date().toISOString(),
    ident: {
      empresa: state.ident.empresa.trim(),
      nombre: state.ident.nombre.trim(),
      cargo: state.ident.cargo.trim(),
      correo: state.ident.correo.trim(),
      telefono: state.ident.telefono.trim(),
    },
    consent: state.consent,
    summary: {
      overall,
      level: levelFor(overall),
      answered: all.filter((a) => a.value !== null).length,
      total: all.length,
      unknown: all.filter((a) => a.answer === 'No sé').length,
    },
    blocks,
    priorities: {
      reordered: state.prio.touched,
      ranking: state.prio.order.map((domain, i) => ({ rank: i + 1, domain, why: state.prio.why[domain]?.trim() || null })),
    },
    closing,
  };
}

const submitBtn = $<HTMLButtonElement>('dg-submit');

function setBusy(text: string | null): void {
  submitBtn.disabled = !!text;
  $('dg-submit-label').textContent = text ?? 'Cifrar y enviar';
  $('dg-submit-icon').innerHTML = text ? iconSvg('loader', 'w-4 h-4 dg-spin') : iconSvg('send', 'w-4 h-4');
  $('dg-submit-status').textContent = text ?? ''; // para lectores de pantalla
}

function showFail(title: string, text: string, canDownload: boolean): void {
  $('dg-fail-title').textContent = title;
  $('dg-fail-text').textContent = text;
  $('dg-download-enc').hidden = !canDownload;
  $('dg-fail').hidden = false;
  // Centrado para que la barra fija inferior no tape los botones; el foco va al aviso.
  $('dg-fail').scrollIntoView({ block: 'center', behavior: 'smooth' });
  $('dg-fail-title').focus({ preventScroll: true });
}

function validateForSubmit(): string[] {
  const errs: string[] = [];
  const v = identValid();
  if (!v.nombre) errs.push('Falta tu nombre (Identificación).');
  if (!v.correo) errs.push('Revisa tu correo (Identificación).');
  if (!state.consent) errs.push('Debes aceptar el uso de tus respuestas para elaborar el diagnóstico.');
  return errs;
}

function renderErrors(errs: string[]): void {
  const box = $('dg-errors');
  box.hidden = errs.length === 0;
  box.innerHTML = errs.length
    ? `<p class="font-semibold">Antes de enviar:</p><ul class="mt-1 list-disc pl-5 space-y-0.5">${errs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
    : '';
}

async function submit(): Promise<void> {
  $('dg-fail').hidden = true;
  const errs = validateForSubmit();
  renderErrors(errs);
  if (errs.length) {
    $('dg-errors').scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }

  if (!cryptoAvailable()) {
    showFail('Este navegador no puede cifrar.', 'Abre el enlace en un navegador actualizado (Chrome, Edge, Safari o Firefox) mediante https.', false);
    return;
  }

  const payload = buildPayload();
  setBusy('Cifrando…');
  try {
    lastArmored = await encryptForRecipient(cfg.publicKey, payload);
  } catch {
    setBusy(null);
    showFail('No pudimos cifrar tus respuestas.', 'No se envió nada. Intenta de nuevo o escríbenos si el problema continúa.', false);
    return;
  }

  setBusy('Enviando…');
  let status = 0;
  try {
    const honeypot = (form.elements.namedItem('_gotcha') as HTMLInputElement).value;
    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      body: JSON.stringify({
        _subject: cfg.emailSubject,
        diagnostico: `${cfg.id} (v${cfg.version})`,
        respuesta_cifrada: lastArmored,
        como_leer: 'Abre tools/visor-diagnostico.html, carga la llave privada y pega este bloque completo.',
        _gotcha: honeypot,
      }),
    });
    status = res.status;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch {
    setBusy(null);
    const fallback = `descarga la respuesta cifrada y envíala a ${cfg.contactEmail}: sigue protegida, solo 4Clover puede abrirla.`;
    showFail(
      'No pudimos enviar tus respuestas.',
      status === 0
        ? `Revisa tu conexión e intenta de nuevo. Si persiste, ${fallback}`
        : status >= 500
          ? `El servicio de envío no está respondiendo (error ${status}). Intenta en unos minutos o ${fallback}`
          : `El servicio de envío rechazó la respuesta (error ${status}); no es un problema de tu conexión. Por favor ${fallback}`,
      true,
    );
    return;
  }

  // Éxito
  submitted = true;
  clearDraft();
  renderResults(payload);
  renderPrintCopy(payload);
  state = freshState();
  history.replaceState({ step: 'resultado' }, '', '#resultado');
  show('resultado', { push: false });
}

submitBtn.addEventListener('click', () => void submit());
$('dg-retry').addEventListener('click', () => void submit());
$('dg-download-enc').addEventListener('click', () => {
  if (!lastArmored) return;
  const url = URL.createObjectURL(new Blob([lastArmored + '\n'], { type: 'text/plain' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `diagnostico-${cfg.id}-cifrado.txt` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});

/* ------------------------------------------------------------------ */
/* Resultados                                                          */
/* ------------------------------------------------------------------ */

function radarSvg(items: { label: string; num: number; pct: number | null }[]): string {
  const W = 440;
  const H = 380;
  const cx = W / 2;
  const cy = H / 2 + 4;
  const R = 122;
  const n = items.length;
  const pt = (i: number, r: number) => {
    const a = (-90 + (360 / n) * i) * (Math.PI / 180);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  const poly = (r: number) => items.map((_, i) => pt(i, r).map((v) => v.toFixed(1)).join(',')).join(' ');

  const rings = [0.25, 0.5, 0.75, 1]
    .map((f) => `<polygon points="${poly(R * f)}" class="fill-none stroke-dg-line" stroke-width="1"/>`)
    .join('');
  const spokes = items
    .map((_, i) => {
      const [x, y] = pt(i, R);
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="stroke-dg-line" stroke-width="1"/>`;
    })
    .join('');
  const data = items.map((it, i) => pt(i, R * ((it.pct ?? 0) / 100)).map((v) => v.toFixed(1)).join(',')).join(' ');
  const marks = items
    .map((it, i) => {
      const [x, y] = pt(i, R * ((it.pct ?? 0) / 100));
      const title = `<title>${esc(it.label)}: ${it.pct === null ? 'sin datos' : `${it.pct} %`}</title>`;
      return it.pct === null
        ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" class="fill-dg-surface stroke-dg-muted" stroke-width="2">${title}</circle>`
        : `<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="12" class="fill-transparent">${title}</circle><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" class="fill-dg-accent stroke-dg-surface pointer-events-none" stroke-width="2"/></g>`;
    })
    .join('');
  const labels = items
    .map((it, i) => {
      const [x, y] = pt(i, R + 16);
      const cos = Math.cos((-90 + (360 / n) * i) * (Math.PI / 180));
      const anchor = cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle';
      const dy = y < cy - R * 0.8 ? -2 : y > cy + R * 0.8 ? 12 : 4;
      // Sin datos: la etiqueta lo dice y queda atenuada, para no confundirlo con 0 %.
      const nd = it.pct === null;
      const tone = nd ? 'fill-dg-muted/60' : 'fill-dg-muted';
      return `<text x="${x.toFixed(1)}" y="${(y + dy).toFixed(1)}" text-anchor="${anchor}" class="${tone} text-[17px] font-semibold sm:hidden">${it.num}${nd ? '*' : ''}</text>
        <text x="${x.toFixed(1)}" y="${(y + dy).toFixed(1)}" text-anchor="${anchor}" class="${tone} text-[12.5px] font-medium hidden sm:block">${esc(it.label)}${nd ? ' (s/d)' : ''}</text>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="w-full h-auto overflow-visible" role="img" aria-label="Gráfico de madurez por bloque">
    ${rings}${spokes}
    <polygon points="${data}" class="fill-dg-accent/15 stroke-dg-accent" stroke-width="2" stroke-linejoin="round"/>
    ${marks}${labels}
  </svg>`;
}

function renderResults(p: SubmissionPayload): void {
  const first = p.ident.nombre.split(/\s+/)[0];
  $('dg-r-name').textContent = first ? `, ${first}` : '';

  const scoredBlocks = p.blocks.filter((b) => b.scored);
  $('dg-radar').innerHTML = radarSvg(
    scoredBlocks.map((b) => ({ label: cfg.blocks.find((x) => x.id === b.id)?.chartLabel ?? b.short, num: b.number, pct: b.score })),
  );

  $('dg-r-level').textContent = p.summary.level ?? 'Sin datos suficientes';
  $('dg-r-overall').textContent = p.summary.overall === null ? '' : `· ${p.summary.overall} %`;
  const lvl = LEVELS.find((l) => l.label === p.summary.level);
  $('dg-r-level-text').textContent = lvl?.text ?? 'No hubo suficientes respuestas que puntúen para calcular un nivel.';
  const withData = scoredBlocks.filter((b) => b.score !== null).length;
  $('dg-r-coverage').textContent = withData
    ? `Basado en ${withData} de ${scoredBlocks.length} bloques con respuestas${withData < scoredBlocks.length ? ': resultado parcial.' : '.'}`
    : '';
  const scoredAnswers = scoredBlocks.flatMap((b) => b.questions).filter((q) => typeof q.score === 'number').length;
  $('dg-r-scale').innerHTML = LEVELS.map((l) => {
    const on = l.label === p.summary.level;
    return `<div><div class="h-1.5 rounded-full ${on ? 'bg-dg-brand' : 'bg-dg-line'}"></div><p class="mt-1.5 text-[11px] leading-tight ${on ? 'font-semibold text-dg-ink' : 'text-dg-muted'}">${esc(l.label)}</p></div>`;
  }).join('');

  $('dg-bars').innerHTML = scoredBlocks
    .map(
      (b) => `<li>
        <div class="flex items-baseline justify-between gap-3 text-sm">
          <span class="min-w-0 truncate"><span class="tabular-nums text-dg-muted mr-1.5">${b.number}</span><span class="font-medium text-dg-ink">${esc(b.short)}</span></span>
          <span class="shrink-0 tabular-nums">${b.score === null ? '<span class="text-dg-muted">Sin datos</span>' : `<span class="font-semibold text-dg-ink">${b.score} %</span> <span class="text-dg-muted">· ${esc(b.level)}</span>`}</span>
        </div>
        <div class="mt-1.5 h-2 rounded-full bg-dg-sunken overflow-hidden">
          <div class="dg-bar-fill h-full rounded-full bg-dg-accent" data-pct="${b.score ?? 0}"></div>
        </div>
      </li>`,
    )
    .join('');
  $('dg-bars')
    .querySelectorAll<HTMLElement>('[data-pct]')
    .forEach((el) => (el.style.width = `${Math.max(0, Math.min(100, Number(el.dataset.pct)))}%`));

  // Hallazgos rápidos
  // Solo cuentan como brecha los bloques bajo "Avanzado".
  const gaps = scoredBlocks
    .filter((b) => b.score !== null && b.score < 75)
    .sort((a, b) => (a.score as number) - (b.score as number))
    .slice(0, 2);
  const cell = (title: string, body: string) =>
    `<div class="bg-dg-surface p-5"><p class="text-xs font-semibold uppercase tracking-[0.08em] text-dg-muted">${title}</p><p class="mt-2 text-sm text-dg-ink leading-relaxed">${body}</p></div>`;
  const insights = [
    cell(
      'Mayores brechas',
      gaps.length
        ? gaps.map((g) => `${esc(g.short)} <span class="text-dg-muted">(${g.score} %)</span>`).join('<br>')
        : withData
          ? 'Ningún bloque bajo 75 %.'
          : 'Sin datos suficientes.',
    ),
    cell(
      'Respuestas "No sé"',
      p.summary.unknown
        ? `${p.summary.unknown} ${p.summary.unknown === 1 ? 'pregunta' : 'preguntas'}. Conocer el estado real es el primer paso: lo que no se sabe, no se gestiona.`
        : !scoredAnswers
          ? 'Sin datos suficientes.'
          : withData < scoredBlocks.length
            ? 'Ninguna en los bloques que respondiste.'
            : 'Ninguna. Buen conocimiento del estado actual.',
    ),
    cell(
      'Tu prioridad #1',
      p.priorities.reordered ? esc(p.priorities.ranking[0]?.domain) : '<span class="text-dg-muted">No ordenaste los dominios; lo conversaremos en la revisión.</span>',
    ),
  ];
  $('dg-insights').innerHTML = insights.join('');
}

function renderPrintCopy(p: SubmissionPayload): void {
  const date = new Date(p.submittedAt).toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' });
  const row = (a: AnswerOut) =>
    `<tr><td class="num">${esc(a.id)}</td><td>${esc(a.text)}</td><td class="ans">${esc(a.answer ?? 'Sin respuesta')}${a.detail ? `<span class="det">${esc(a.detail)}</span>` : ''}</td></tr>`;
  const blocks = p.blocks
    .map(
      (b) =>
        `<h2>Bloque ${b.number}. ${esc(b.title)}${b.score !== null ? ` · ${b.score} % (${esc(b.level)})` : ''}</h2><table>${b.questions.map(row).join('')}</table>`,
    )
    .join('');
  const prio = `<h2>Bloque 11 A. Priorización de dominios${p.priorities.reordered ? '' : ' (orden sin modificar)'}</h2><table>${p.priorities.ranking
    .map((r) => `<tr><td class="num">${r.rank}</td><td>${esc(r.domain)}</td><td class="ans">${esc(r.why ?? '')}</td></tr>`)
    .join('')}</table>`;
  const closing = `<h2>Bloque 11 B. Preguntas de cierre</h2><table>${p.closing.map(row).join('')}</table>`;
  $('dg-print').innerHTML = `
    <h1>${esc(p.diagnostico.title)} · ${esc(p.ident.empresa || p.diagnostico.company)}</h1>
    <p class="meta">${esc(p.ident.nombre)}${p.ident.cargo ? `, ${esc(p.ident.cargo)}` : ''} · ${esc(p.ident.correo)}${p.ident.telefono ? ` · ${esc(p.ident.telefono)}` : ''}<br>
    Enviado el ${esc(date)} · Madurez general indicativa: ${p.summary.overall === null ? 'sin datos' : `${p.summary.overall} % (${esc(p.summary.level)})`} · ${p.summary.answered} de ${p.summary.total} preguntas respondidas</p>
    ${blocks}${prio}${closing}`;
}

$('dg-print-btn').addEventListener('click', () => window.print());

/* ------------------------------------------------------------------ */
/* Tema                                                                */
/* ------------------------------------------------------------------ */

$('dg-theme').addEventListener('click', () => {
  const dark = !document.documentElement.classList.contains('dark');
  document.documentElement.classList.toggle('dark', dark);
  try {
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  } catch {
    /* nada */
  }
});

/* ------------------------------------------------------------------ */
/* Inicio                                                              */
/* ------------------------------------------------------------------ */

hydrate();
updateProgress();
renderIntro();
if (!cryptoAvailable()) {
  // Sin Web Crypto no se puede enviar: avisar antes de que respondan, no al final.
  $('dg-nocrypto').hidden = false;
  $<HTMLButtonElement>('dg-start').disabled = true;
}
{
  const id = location.hash.slice(1);
  if (STEPS.includes(id)) {
    history.replaceState({ step: id }, '', `#${id}`);
    show(id, { push: false, focus: false });
  } else {
    history.replaceState({ step: 'intro' }, '', location.pathname);
    show('intro', { push: false, focus: false });
  }
}
