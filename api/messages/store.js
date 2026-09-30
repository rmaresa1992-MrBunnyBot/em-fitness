/* Trainer ↔ athlete chat — one thread per athlete, one file each under data/messages/.
 *
 * Both sides write to it, so it cannot live in state-<uid>.json: the athlete's full-state
 * upload would overwrite the trainer's messages (D3). Each side keeps a read mark (the `at` of
 * the last message it has seen), which is all an unread count needs.
 *
 * Thread: { msgs: [{ id, from: 'trainer' | 'athlete', text, at }], read: { trainer, athlete } }
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA = process.env.DATA_DIR || '/data';
const DIR = path.join(DATA, 'messages');
export const MAX_MSGS = 500;   // oldest fall off; a gym chat is not an archive

const safe = uid => String(uid).replace(/[^a-zA-Z0-9_-]/g, '');
const file = uid => path.join(DIR, safe(uid) + '.json');
const empty = () => ({ msgs: [], read: { trainer: 0, athlete: 0 } });

export function read(uid) {
  try { return { ...empty(), ...JSON.parse(fs.readFileSync(file(uid), 'utf8')) }; } catch { return empty(); }
}
function write(uid, th) {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  const f = file(uid), tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(th), { mode: 0o600 });
  fs.renameSync(tmp, f);
}

// Strictly increasing within the process: two messages in the same millisecond would otherwise share
// an `at`, and the read mark (and the client's "after" cursor) could skip one of them.
let lastAt = 0;
const stamp = () => (lastAt = Math.max(Date.now(), lastAt + 1));

/** Appends a message; the sender has obviously read everything up to it. */
export function append(uid, from, text) {
  const th = read(uid);
  const msg = { id: crypto.randomBytes(6).toString('base64url'), from, text, at: stamp() };
  th.msgs = [...th.msgs, msg].slice(-MAX_MSGS);
  th.read = { ...th.read, [from]: msg.at };
  write(uid, th);
  return msg;
}

/** Moves `side`'s read mark to the newest message. */
export function markRead(uid, side) {
  const th = read(uid);
  const last = th.msgs[th.msgs.length - 1];
  if (!last || th.read[side] >= last.at) return;
  th.read = { ...th.read, [side]: last.at };
  write(uid, th);
}

/** How many messages from the other side `side` has not read yet. */
export function unread(th, side) {
  return th.msgs.filter(m => m.from !== side && m.at > (th.read[side] || 0)).length;
}
