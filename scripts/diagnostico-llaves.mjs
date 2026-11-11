#!/usr/bin/env node
/**
 * Genera el par de llaves para cifrar las respuestas del auto-diagnóstico.
 *
 *   node scripts/diagnostico-llaves.mjs [ruta-llave-privada.pem]
 *
 * - La llave PRIVADA se guarda en la ruta indicada (por defecto en
 *   Documentos/4Clover) y nunca se imprime. Respáldala en un lugar seguro:
 *   sin ella no se pueden leer las respuestas.
 * - La llave PÚBLICA se imprime: pégala en src/data/diagnosticos/index.ts.
 *
 * Se niega a sobrescribir una llave existente y a guardarla dentro del repo.
 */
import { generateKeyPairSync, createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(process.argv[2] ?? join(homedir(), 'Documents', '4Clover', 'diagnostico-llave-privada.pem'));

const rel = relative(repoRoot, target);
if (!rel.startsWith('..') && !isAbsolute(rel)) {
  console.error('✖ No guardes la llave privada dentro del repositorio. Elige una ruta fuera de:', repoRoot);
  process.exit(1);
}
if (existsSync(target)) {
  console.error('✖ Ya existe una llave en', target);
  console.error('  Si generas una nueva, las respuestas cifradas con la anterior solo se podrán abrir con la anterior.');
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 4096, publicExponent: 0x10001 });
const spki = publicKey.export({ type: 'spki', format: 'der' });
const kid = createHash('sha256').update(spki).digest('hex').slice(0, 16);

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });

console.log('✔ Llave privada guardada en:', target);
console.log('  Huella (kid):', kid);
console.log('');
console.log('Llave pública (pégala en src/data/diagnosticos/index.ts → RECIPIENT_PUBLIC_KEY):');
console.log(spki.toString('base64'));
