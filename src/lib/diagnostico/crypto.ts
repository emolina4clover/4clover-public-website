/**
 * Cifrado híbrido en el navegador (Web Crypto, sin dependencias):
 *
 *   1. Se genera una llave AES-256-GCM aleatoria de un solo uso.
 *   2. El JSON (comprimido con gzip si el navegador lo soporta) se cifra con ella.
 *   3. La llave AES se cifra con la llave pública RSA-OAEP-4096 (SHA-256) de 4Clover.
 *
 * Solo quien tenga la llave privada puede leer el resultado. El formato lo
 * entienden tools/visor-diagnostico.html y scripts/diagnostico-descifrar.mjs;
 * si lo cambias, cámbialo en los tres.
 */

export const ARMOR_BEGIN = '-----BEGIN 4CLOVER DIAGNOSTICO-----';
export const ARMOR_END = '-----END 4CLOVER DIAGNOSTICO-----';

interface Envelope {
  v: 1;
  alg: 'RSA-OAEP-256+A256GCM';
  kid: string;
  z: 'gzip' | 'none';
  ek: string;
  iv: string;
  ct: string;
}

const enc = new TextEncoder();

function b64FromBytes(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function bytesFromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function gzip(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function cryptoAvailable(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && !!window.crypto?.subtle;
}

/** Huella corta de la llave pública: primeros 16 hex del SHA-256 del SPKI. */
export async function keyId(spki: Uint8Array<ArrayBuffer>): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', spki));
  return Array.from(h.subarray(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function aadFor(kid: string, z: string): Uint8Array<ArrayBuffer> {
  return enc.encode(`4clover-diagnostico:v1:${kid}:${z}`);
}

/** Cifra `data` para el dueño de `publicKeyB64` y devuelve un bloque de texto "armado". */
export async function encryptForRecipient(publicKeyB64: string, data: unknown): Promise<string> {
  if (!cryptoAvailable()) throw new Error('Este navegador no permite cifrar (se requiere HTTPS y un navegador actualizado).');

  const subtle = crypto.subtle;
  const spki = bytesFromB64(publicKeyB64);
  const kid = await keyId(spki);
  const rsa = await subtle.importKey('spki', spki, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);

  const raw = crypto.getRandomValues(new Uint8Array(32));
  const aes = await subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  let plain: Uint8Array<ArrayBuffer> = enc.encode(JSON.stringify(data));
  let z: Envelope['z'] = 'none';
  if (typeof CompressionStream !== 'undefined') {
    try {
      plain = await gzip(plain);
      z = 'gzip';
    } catch {
      /* sin compresión */
    }
  }

  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aadFor(kid, z) }, aes, plain));
  const ek = new Uint8Array(await subtle.encrypt({ name: 'RSA-OAEP' }, rsa, raw));
  raw.fill(0);

  const envelope: Envelope = {
    v: 1,
    alg: 'RSA-OAEP-256+A256GCM',
    kid,
    z,
    ek: b64FromBytes(ek),
    iv: b64FromBytes(iv),
    ct: b64FromBytes(ct),
  };

  const body = b64FromBytes(enc.encode(JSON.stringify(envelope)));
  const lines = body.match(/.{1,64}/g) ?? [];
  return [ARMOR_BEGIN, ...lines, ARMOR_END].join('\n');
}
