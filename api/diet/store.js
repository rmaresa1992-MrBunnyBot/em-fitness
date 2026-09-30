/* The diet the trainer has sent each athlete — one current diet per athlete, one file each
 * under data/diet/.
 *
 * Read-only for the athlete and written by someone else, so it stays out of state-<uid>.json
 * for the same reason trainer assignments do: the athlete's full-state upload would overwrite
 * it. The athlete's app reads it from here and keeps its own offline copy.
 *
 * `rev` keeps counting across a removal (the file keeps a `removed` marker instead of being
 * deleted), so a diet sent again after being withdrawn is never mistaken for one already seen.
 */
import fs from 'node:fs';
import path from 'node:path';

const DATA = process.env.DATA_DIR || '/data';
const DIR = path.join(DATA, 'diet');

const safe = uid => String(uid).replace(/[^a-zA-Z0-9_-]/g, '');
const file = uid => path.join(DIR, safe(uid) + '.json');

function readRaw(uid) {
  try { return JSON.parse(fs.readFileSync(file(uid), 'utf8')); } catch { return null; }
}
function write(uid, rec) {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  const f = file(uid), tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(rec), { mode: 0o600 });
  fs.renameSync(tmp, f);
}

/** The current diet, or null when there is none (never sent, or withdrawn). */
export function read(uid) {
  const rec = readRaw(uid);
  return rec && !rec.removed ? rec : null;
}

/**
 * `since` is when the athlete first got a diet and survives new revisions, so diet adherence
 * counts from then; it restarts after a removal. A diet saved before it existed takes its
 * last revision's date, the earliest one known.
 */
export function save(uid, diet) {
  const prev = readRaw(uid);
  const now = Date.now();
  const since = prev && !prev.removed ? prev.since || prev.at : now;
  const rec = { ...diet, rev: (prev?.rev || 0) + 1, at: now, since };
  write(uid, rec);
  return rec;
}

/** Returns false when there was no diet to remove. */
export function remove(uid) {
  const prev = readRaw(uid);
  if (!prev || prev.removed) return false;
  write(uid, { rev: prev.rev + 1, at: Date.now(), removed: true });
  return true;
}
