/* The trainer's diet templates — model diets (volumen, definición…) kept to hand out. One file,
 * data/diet-templates.json, outside data/diet/ so it can never collide with an athlete's file.
 *
 * Handing a template out copies it into the athlete's diet (store.js): editing the template
 * afterwards changes nobody's diet.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA = process.env.DATA_DIR || '/data';
const FILE = path.join(DATA, 'diet-templates.json');
export const MAX = 200;

function readAll() {
  try { const d = JSON.parse(fs.readFileSync(FILE, 'utf8')); return Array.isArray(d.list) ? d.list : []; } catch { return []; }
}
function writeAll(list) {
  fs.mkdirSync(DATA, { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ list }), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}

/** Newest first. */
export const list = () => readAll().sort((a, b) => b.at - a.at);
export const get = id => readAll().find(t => t.id === id) || null;

/** Creates when `id` is empty; returns null for an unknown id or when the list is full. */
export function save(id, diet) {
  const all = readAll();
  if (id) {
    const i = all.findIndex(t => t.id === id);
    if (i < 0) return null;
    all[i] = { id, diet, at: Date.now() };
    writeAll(all);
    return all[i];
  }
  if (all.length >= MAX) return null;
  const rec = { id: crypto.randomBytes(6).toString('hex'), diet, at: Date.now() };
  all.push(rec);
  writeAll(all);
  return rec;
}

export function remove(id) {
  const all = readAll();
  const next = all.filter(t => t.id !== id);
  if (next.length === all.length) return false;
  writeAll(next);
  return true;
}
