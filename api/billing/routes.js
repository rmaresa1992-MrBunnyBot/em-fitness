/* HTTP surface for monthly fees: the admin (the trainer) sets each athlete's fee and records
 * payments; each athlete reads their own next due date. Same factory shape as diet/routes.js.
 *
 * No money moves here — it is the trainer's ledger of who has paid, not a payment gateway.
 */
import { z } from 'zod';
import * as store from './store.js';
import { isDay, status } from './dates.js';

const money = z.number().finite().min(0).max(1000000);
const Plan = z.object({
  athlete: z.string().min(1).max(40),
  fee: money,
  day: z.number().int().min(1).max(31),
  due: z.string().refine(isDay, 'not a date')
});
const Pay = z.object({
  athlete: z.string().min(1).max(40),
  amount: money.optional(),
  note: z.string().trim().max(120).optional()
});

// What the athlete and the overview see: never the reminder bookkeeping.
const view = rec => rec && {
  fee: rec.fee, day: rec.day, due: rec.due,
  last: rec.payments?.length ? rec.payments[rec.payments.length - 1] : null
};

// Reminder pushes in the athlete's language; the server has no i18n (see trainer/routes.js).
const fmt = iso => iso.split('-').reverse().join('/');
const PUSH = {
  es: {
    pre: (due, left) => ({ title: 'Tu mensualidad vence pronto', body: left === 1 ? 'Vence mañana, ' + fmt(due) : `Vence en ${left} días, el ${fmt(due)}` }),
    due: (due, left) => ({ title: left === 0 ? 'Hoy vence tu mensualidad' : 'Tu mensualidad está vencida', body: left === 0 ? 'Fecha de pago: hoy, ' + fmt(due) : 'Venció el ' + fmt(due) })
  },
  en: {
    pre: (due, left) => ({ title: 'Your membership fee is due soon', body: left === 1 ? 'Due tomorrow, ' + due : `Due in ${left} days, on ${due}` }),
    due: (due, left) => ({ title: left === 0 ? 'Your membership fee is due today' : 'Your membership fee is overdue', body: left === 0 ? 'Payment date: today, ' + due : 'It was due on ' + due })
  }
};
export const PRE_DAYS = 3;

/**
 * One pass of fee reminders: a push PRE_DAYS days before the due date and one on (or, if that
 * day was missed, after) it — each at most once per due date. `todayFor(uid)` returns the
 * athlete's own { date, hour } or null to skip them; nothing goes out before 9:00 their time.
 */
export function billingReminders({ users, todayFor, readState, sendPush }) {
  for (const u of users()) {
    const rec = store.read(u.id);
    if (!rec || u.disabled) continue;
    const now = todayFor(u.id);
    if (!now || now.hour < 9) continue;
    const { left } = status(rec.due, now.date);
    const kind = left <= 0 ? 'due' : left <= PRE_DAYS ? 'pre' : null;
    if (!kind || !store.markNotified(u.id, rec.due, kind)) continue;
    const lang = readState(u.id)?.lang === 'es' ? 'es' : 'en';
    sendPush(u.id, { ...PUSH[lang][kind](rec.due, left), tag: 'billing', url: '#/home' }).catch(() => {});
  }
}

export function billingRoutes({ json, readBody, readSession, requireAdmin, users }) {
  const exists = uid => !!uid && users().some(u => u.id === uid);
  const issues = p => p.error.issues.map(i => i.path.join('.') + ': ' + i.message);

  return {
    // Every athlete's fee at once, for the panel's list and its overdue filter.
    'GET /api/trainer/billing': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const billing = {};
      for (const u of users()) { const r = store.read(u.id); if (r) billing[u.id] = view(r); }
      json(res, 200, { billing });
    },

    // One athlete with the full payment history, newest first.
    'GET /api/trainer/billing/user': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const athlete = new URL(req.url, 'http://x').searchParams.get('id');
      if (!exists(athlete)) return json(res, 404, { error: 'no such user' });
      const rec = store.read(athlete);
      json(res, 200, { billing: rec && { ...view(rec), payments: (rec.payments || []).slice().reverse() } });
    },

    'PUT /api/trainer/billing': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const parsed = Plan.safeParse(await readBody(req));
      if (!parsed.success) return json(res, 400, { error: 'invalid fee', issues: issues(parsed) });
      const { athlete, ...plan } = parsed.data;
      if (!exists(athlete)) return json(res, 404, { error: 'no such user' });
      json(res, 200, { billing: view(store.setPlan(athlete, plan)) });
    },

    'POST /api/trainer/billing/pay': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const parsed = Pay.safeParse(await readBody(req));
      if (!parsed.success) return json(res, 400, { error: 'invalid payment', issues: issues(parsed) });
      const { athlete, amount, note } = parsed.data;
      if (!exists(athlete)) return json(res, 404, { error: 'no such user' });
      const r = store.pay(athlete, { amount, note });
      if (!r) return json(res, 404, { error: 'no fee set' });
      json(res, 200, { billing: view(r.rec), payment: r.payment });
    },

    'POST /api/trainer/billing/undo': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const body = await readBody(req);
      const athlete = String(body.athlete || '');
      if (!exists(athlete)) return json(res, 404, { error: 'no such user' });
      const rec = store.undoLast(athlete, String(body.pid || ''));
      if (!rec) return json(res, 409, { error: 'only the latest payment can be undone' });
      json(res, 200, { billing: view(rec) });
    },

    'GET /api/athlete/billing': async (req, res) => {
      const user = readSession(req);
      if (!user) return json(res, 401, { error: 'not signed in' });
      json(res, 200, { billing: view(store.read(user.id)) });
    }
  };
}
