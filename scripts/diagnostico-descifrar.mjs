#!/usr/bin/env node
/**
 * Alternativa de línea de comandos al visor (tools/visor-diagnostico.html).
 *
 *   node scripts/diagnostico-descifrar.mjs <llave-privada.pem> <respuesta.txt> [salida.json]
 *
 * <respuesta.txt> es el texto del correo de Formspree con el bloque
 * "-----BEGIN 4CLOVER DIAGNOSTICO-----" (puede traer texto alrededor).
 * Sin [salida.json] imprime el JSON en pantalla.
 */
import { createDecipheriv, createHash, createPrivateKey, createPublicKey, constants, privateDecrypt } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const [keyPath, inputPath, outPath] = process.argv.slice(2);
if (!keyPath || !inputPath) {
  console.error('Uso: node scripts/diagnostico-descifrar.mjs <llave-privada.pem> <respuesta.txt> [salida.json]');
  process.exit(1);
}

const BEGIN = '-----BEGIN 4CLOVER DIAGNOSTICO-----';
const END = '-----END 4CLOVER DIAGNOSTICO-----';

const text = readFileSync(inputPath, 'utf8');
const start = text.indexOf(BEGIN);
const end = text.indexOf(END, start + BEGIN.length);
if (start < 0 || end < 0) {
  console.error('✖ No encontré el bloque cifrado en', inputPath);
  process.exit(1);
}
const body = text.slice(start + BEGIN.length, end).replace(/[^A-Za-z0-9+/=]/g, '');
const env = JSON.parse(Buffer.from(body, 'base64').toString('utf8'));
if (env.v !== 1 || env.alg !== 'RSA-OAEP-256+A256GCM') {
  console.error('✖ Formato no soportado:', env.v, env.alg);
  process.exit(1);
}

const key = createPrivateKey(readFileSync(keyPath));
const spki = createPublicKey(key).export({ type: 'spki', format: 'der' });
const kid = createHash('sha256').update(spki).digest('hex').slice(0, 16);
if (kid !== env.kid) {
  console.error(`✖ Esta respuesta se cifró con otra llave (kid ${env.kid}); la tuya es ${kid}.`);
  process.exit(1);
}

const raw = privateDecrypt({ key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(env.ek, 'base64'));
const ct = Buffer.from(env.ct, 'base64');
const decipher = createDecipheriv('aes-256-gcm', raw, Buffer.from(env.iv, 'base64'));
decipher.setAAD(Buffer.from(`4clover-diagnostico:v1:${env.kid}:${env.z}`, 'utf8'));
decipher.setAuthTag(ct.subarray(ct.length - 16));
let plain = Buffer.concat([decipher.update(ct.subarray(0, ct.length - 16)), decipher.final()]);
if (env.z === 'gzip') plain = gunzipSync(plain);

const json = JSON.stringify(JSON.parse(plain.toString('utf8')), null, 2);
if (outPath) {
  writeFileSync(outPath, json, { mode: 0o600 });
  console.log('✔ Respuesta descifrada en', outPath);
} else {
  console.log(json);
}
