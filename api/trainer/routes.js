/* HTTP surface for the trainer: the admin assigns routines from their own plan to athletes,
 * and each athlete's app reads its own assignments back.
 *
 * Same factory shape as coach/routes.js — server.js hands in its helpers, which keeps this
 * module free of a cycle and testable against fakes.
 */
import { z } from 'zod';
import * as store from './store.js';

const POLICIES = ['off', 'linear', 'greyskull', 'double', 'time'];
const num = (max) => z.number().finite().min(0).max(max);
const id = z.string().min(1).max(40);

// Mirrors plan-share.js cleanEx: only the fields a plan file carries. Unknown keys are
// stripped, not rejected, so an older or newer client still gets through.
const Exercise = z.object({
  id,
  sets: z.number().int().min(1).max(20),
  mode: z.enum(['reps', 'time', 'cardio']).optional(),
  reps: num(200).optional(),
  repsMin: num(200).optional(),
  sec: num(3600).optional(),
  min: num(600).optional(),
  speed: num(50).optional(),
  weight: num(2000).optional(),
  prog: z.enum(POLICIES).optional(),
  inc: num(100).optional(),
  sg: z.string().max(40).optional(),
  // Drop set ("serie descendente"): reps and weight per set. Mirrors frontend history.js
  // schemeOf — 2 to 10 sets.
  scheme: z.array(z.object({ r: z.number().int().min(1).max(200), w: num(2000) })).min(2).max(10).optional()
});
const Assign = z.object({
  athletes: z.array(id).min(1).max(200),
  routine: z.object({
    id,
    name: z.string().trim().min(1).max(60),
    emoji: z.string().max(40).optional(),   // a glyph key (lib/glyphs.js) or a legacy emoji
    prog: z.enum(POLICIES).optional(),
    ex: z.array(Exercise).min(1).max(40)
  }),
  customEx: z.array(z.object({ id, n: z.string().max(80), bp: z.string().max(40), desc: z.string().max(500).optional() })).max(40).default([]),
  days: z.array(z.number().int().min(0).max(6)).max(7).refine(d => new Set(d).size === d.length, 'days repeat')
});

// The athlete sees this in their own language; the server has no i18n, so it's just the two
// this instance is run in.
const PUSH = {
  es: n => ({ title: 'Tu entrenador te asignó una rutina', body: n }),
  en: n => ({ title: 'Your trainer assigned you a routine', body: n })
};

export function trainerRoutes({ json, readBody, readSession, requireAdmin, users, readState, sendPush }) {
  const exists = uid => users().some(u => u.id === uid);

  return {
    'GET /api/trainer/assignments': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const athlete = new URL(req.url, 'http://x').searchParams.get('id');
      if (!exists(athlete)) return json(res, 404, { error: 'no such user' });
      json(res, 200, { assignments: store.live(athlete) });
    },

    'POST /api/trainer/assign': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const parsed = Assign.safeParse(await readBody(req));
      if (!parsed.success) return json(res, 400, { error: 'invalid assignment', issues: parsed.error.issues.map(i => i.path.join('.') + ': ' + i.message) });
      const { athletes, routine, customEx, days } = parsed.data;
      const missing = athletes.filter(a => !exists(a));
      if (missing.length) return json(res, 404, { error: 'no such user', missing });
      const { id: rid, ...body } = routine;
      const assigned = athletes.map(a => ({ athlete: a, ...store.upsert(a, { rid, routine: body, customEx, days }) }));
      // Fire-and-forget: a push that fails must not turn a saved assignment into an error.
      for (const a of athletes) {
        const lang = readState(a)?.lang === 'es' ? 'es' : 'en';
        sendPush(a, { ...PUSH[lang](routine.name), tag: 'trainer-assign', url: '#/plan' }).catch(() => {});
      }
      json(res, 200, { assigned });
    },

    'POST /api/trainer/unassign': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const body = await readBody(req);
      const athlete = String(body.athlete || ''), rid = String(body.rid || '');
      if (!exists(athlete)) return json(res, 404, { error: 'no such user' });
      if (!store.remove(athlete, rid)) return json(res, 404, { error: 'not assigned' });
      json(res, 200, { ok: true });
    },

    // The athlete's own list, tombstones included — that is how a withdrawn routine leaves
    // every device, not just the one that happened to be open.
    'GET /api/athlete/assignments': async (req, res) => {
      const user = readSession(req);
      if (!user) return json(res, 401, { error: 'not signed in' });
      json(res, 200, { assignments: store.read(user.id).assignments });
    }
  };
}
