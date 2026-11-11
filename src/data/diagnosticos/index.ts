import type { Diagnostico } from '../../lib/diagnostico/types';
import { triconosMineros } from './triconos-mineros';

/**
 * Diagnósticos publicados. Cada uno genera una página en /diagnostico/<slug>/,
 * fuera del sitemap y con "noindex". Para un cliente nuevo: copia
 * triconos-mineros.ts, ajusta textos y slug (con un token aleatorio nuevo) y
 * agrégalo a esta lista.
 */
export const diagnosticos: Diagnostico[] = [triconosMineros];

/**
 * Llave PÚBLICA (RSA-4096, SPKI en base64) con la que el navegador del cliente
 * cifra las respuestas antes de enviarlas. Es pública: puede estar en el repo.
 * La llave privada correspondiente NO va en el repo (ver README).
 *
 * Huella (kid): 6e575d9fd08da33f
 * Para rotarla: node scripts/diagnostico-llaves.mjs
 */
export const RECIPIENT_PUBLIC_KEY =
  'MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA9sEG8s7Bhp2iJMr3BwooP35bv6OaA+kCKZqowR5ztoRu9f0KDOdjeeLzqv4MOAQuH4hFWt2xoZ3Vp+Y46XSWRRy+qaug47RQdzGZtmOdTbS2EGH5365MGPw2UEWjjJ8OVCuL6mDSSTu7hN3OZrq5hdlgUHySqtNoMSCda8FiuzyP0hAmmJCmIbk6IPZ5k3jIoz0JDtaMzmPwAAxC/tU+cWpm98aqXjCMrMWxBpHFBoIQMo1vyUq9b9G0WChnbAUwxN9J8qv7zy3sHA/CVAxU2kGYSUI029bXzBtkViDQA47hvp0nHdCH38YAiUxJYhuwDsBGZjP0E5bJ2cvtoryOb7AQBHNj1bLIbQQg0Q5G5ZFCgExhaZo5WgQRev0q7O4HfyDW7qlKsDW2bTMghhQ9OFQo6vUkhUysGqZLzoMQfF6bfJ8CQ63gg7PpNObbGQTEL/P0JiRTniyWiKh76LcQ/W2y5VzzmKwGC4v+IOrXpPYHd5Kn/WPB5DS9rwER0HrWh1AMfuYqqB2Epomso4Ezk+e3gUqSMUSryFy3Yf0u+BRcezOB/fss06ut07tFwN4mP9KFPo1dWKZQbYQ+TVYXnS8ammv2n4XQPfkjFtdqp4n+WR86XBT2Q88hfYtvxiwendZHdUSkX9mcagSklPq/gJpwnPhMq9rR+YhphEU6LXUCAwEAAQ==';

/**
 * Formulario de Formspree que recibe las respuestas (ya cifradas).
 * Hoy es el mismo del formulario de contacto; puedes crear uno dedicado en
 * formspree.io y cambiar solo este ID.
 */
export const FORMSPREE_ID = 'xykdbgzp';

export const CALENDLY_URL = 'https://calendly.com/eduardo-molina-4clover/30min';

export const CONTACT_EMAIL = 'contacto@4clover.cl';
