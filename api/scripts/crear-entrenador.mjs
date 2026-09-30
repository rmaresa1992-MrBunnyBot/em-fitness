#!/usr/bin/env node
/* Crea la cuenta del entrenador (o convierte en entrenador una que ya existe) con usuario y
 * contraseña. Se corre una vez, en el servidor, con la API PARADA: la API tiene db.json en
 * memoria y al guardar pisaría lo que este script escriba mientras corre.
 *
 *   node scripts/crear-entrenador.mjs <usuario> "<nombre>"
 *
 * La contraseña se pide por teclado, o se toma de ENTRENADOR_PASSWORD si está definida.
 * DATA_DIR como en la API (por defecto /data; en local, ../data).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { USERNAME, MIN_PASSWORD, normUsername, validPassword, hashPassword } from '../auth/password.js';

const DATA = process.env.DATA_DIR || '/data';
const dbFile = path.join(DATA, 'db.json');
const [, , rawUser, rawName] = process.argv;

const fail = msg => { console.error(msg); process.exit(1); };
const username = normUsername(rawUser);
if (!USERNAME.test(username)) fail('Uso: node scripts/crear-entrenador.mjs <usuario> "<nombre>"\nEl usuario: 3-32 caracteres, letras minúsculas, números, punto, guion o guion bajo.');

let db = { users: [], creds: [], subs: [], invites: [] };
if (fs.existsSync(dbFile)) {
  try { db = JSON.parse(fs.readFileSync(dbFile, 'utf8')); } catch { fail('No se pudo leer ' + dbFile); }
}
db.users = db.users || [];

let password = process.env.ENTRENADOR_PASSWORD;
if (!password) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question(`Contraseña (mínimo ${MIN_PASSWORD} caracteres): `);
  rl.close();
}
if (!validPassword(password)) fail(`La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`);

let user = db.users.find(u => u.username === username);
if (user) {
  console.log(`La cuenta "${username}" ya existe (${user.name}): pasa a ser entrenador y cambia su contraseña.`);
} else {
  const name = String(rawName || '').trim().slice(0, 40) || username;
  user = { id: crypto.randomBytes(12).toString('base64url'), name, username, created: new Date().toISOString() };
  db.users.push(user);
  console.log(`Cuenta nueva: ${name} (${username}).`);
}
user.admin = true;
user.pw = await hashPassword(password);
user.sv = (user.sv || 0) + 1;   // cierra cualquier sesión abierta con la contraseña anterior

fs.mkdirSync(DATA, { recursive: true });
const tmp = dbFile + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
fs.renameSync(tmp, dbFile);
console.log(`Listo. Entra por "Soy entrenador" con el usuario ${username}.`);
