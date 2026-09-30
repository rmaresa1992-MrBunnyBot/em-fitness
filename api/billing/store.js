/* Each athlete's monthly fee — one file per athlete under data/billing/.
 *
 * Written by the trainer only, so it could have lived in db.json; it sits beside diet/ and
 * trainer/ instead so db.json stays upstream's shape and the history can grow without every
 * login rewriting it.
 *
 * Record: { fee, day, due, payments: [{ id, at, period, amount, note }], notified: { [due]: [...] } }
 *   day     billing day of the month (1-31), kept apart from `due` so short months don't drift it
 *   due     next date a payment is owed ('YYYY-MM-DD')
 *   period  on a payment, the due date it settled — undoing it puts `due` back there
 *   notified which reminder pushes already went out for a due date, so each goes out once
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { addMonth } from './dates.js';

const DATA = process.env.DATA_DIR || '/data';
const DIR = path.join(DATA, 'billing');
const MAX_PAYMENTS = 240;   // twenty years of months; older ones fall off the end

const safe = uid => String(uid).replace(/[^a-zA-Z0-9_-]/g, '');
const file = uid => path.join(DIR, safe(uid) + '.json');

function write(uid, rec) {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  const f = file(uid), tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(rec), { mode: 0o600 });
  fs.renameSync(tmp, f);
}

/** The record, or null when the trainer never set a fee for this athlete. */
export function read(uid) {
  try { return JSON.parse(fs.readFileSync(file(uid), 'utf8')); } catch { return null; }
}

/** Sets fee, billing day and next due date; payments and reminders already sent are kept. */
export function setPlan(uid, { fee, day, due }) {
  const prev = read(uid);
  const rec = { payments: [], notified: {}, ...prev, fee, day, due };
  write(uid, rec);
  return rec;
}

/** Records the payment of the current due date and moves it one month on. Null without a plan. */
export function pay(uid, { amount, note, at = Date.now() }) {
  const rec = read(uid);
  if (!rec) return null;
  const payment = { id: crypto.randomBytes(6).toString('base64url'), at, period: rec.due, amount: amount ?? rec.fee };
  if (note) payment.note = note;
  rec.payments = [...(rec.payments || []), payment].slice(-MAX_PAYMENTS);
  rec.due = addMonth(rec.due, rec.day);
  write(uid, rec);
  return { rec, payment };
}

/** Undoes the latest payment only — an older one would leave `due` meaning nothing. */
export function undoLast(uid, pid) {
  const rec = read(uid);
  const last = rec?.payments?.[rec.payments.length - 1];
  if (!last || last.id !== pid) return null;
  rec.payments = rec.payments.slice(0, -1);
  rec.due = last.period;
  write(uid, rec);
  return rec;
}

/** Marks a reminder as sent; false when it already was (so the caller doesn't send it twice). */
export function markNotified(uid, due, kind) {
  const rec = read(uid);
  if (!rec || rec.due !== due) return false;
  const sent = rec.notified?.[due] || [];
  if (sent.includes(kind)) return false;
  // Only the current due date is worth remembering; older keys would just pile up.
  rec.notified = { [due]: [...sent, kind] };
  write(uid, rec);
  return true;
}
