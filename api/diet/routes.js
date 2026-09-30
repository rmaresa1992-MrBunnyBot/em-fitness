/* HTTP surface for diets: the admin (the trainer) writes one diet per athlete and keeps a set of
 * templates; each athlete reads their own. Same factory shape as trainer/routes.js and
 * coach/routes.js.
 */
import crypto from 'node:crypto';
import { z } from 'zod';
import * as store from './store.js';
import * as templates from './templates.js';
import { recentDietAdherence } from './adherence.js';

const amount = z.number().finite().min(0).max(100000);
const macro = z.number().finite().min(0).max(20000);
const text = max => z.string().trim().max(max);

const Food = z.object({
  name: text(80).min(1),
  ref: z.string().regex(/^[a-z0-9-]{1,40}$/).optional(),   // catalog id (frontend/src/lib/foods.js)
  qty: amount.optional(),
  unit: text(16).optional(),
  kcal: macro.optional(), p: macro.optional(), c: macro.optional(), f: macro.optional()
});
const Meal = z.object({
  id: z.string().regex(/^[a-zA-Z0-9]{1,24}$/).optional(),   // what the athlete's log points at
  name: text(60).min(1),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  notes: text(500).optional(),
  foods: z.array(Food).max(30)
});
const Targets = z.object({ kcal: macro.optional(), p: macro.optional(), c: macro.optional(), f: macro.optional() });
const Meals = z.array(Meal).min(1).max(12);
const Diet = z.object({
  name: text(80).default(''),
  notes: text(2000).optional(),
  targets: Targets.optional(),
  meals: Meals,
  // Days without a routine, when they eat differently. Absent = every day the same.
  rest: z.object({ targets: Targets.optional(), meals: Meals }).optional()
});
const Template = Diet.extend({ name: text(80).min(1) });

/**
 * Every meal leaves with an id that is unique within its variant: the one it came with, else its
 * position ('t0', 'r1'… — what the athlete's app already calls a meal saved without one), else a
 * fresh one.
 */
function withIds(diet) {
  const fix = (meals, v) => {
    const seen = new Set();
    return meals.map((m, i) => {
      let id = m.id && !seen.has(m.id) ? m.id : v + i;
      if (seen.has(id)) id = 'm' + crypto.randomBytes(5).toString('hex');
      seen.add(id);
      return { ...m, id };
    });
  };
  const out = { ...diet, meals: fix(diet.meals, 't') };
  if (diet.rest) out.rest = { ...diet.rest, meals: fix(diet.rest.meals, 'r') };
  return out;
}

const invalid = (json, res, what, parsed) =>
  json(res, 400, { error: 'invalid ' + what, issues: parsed.error.issues.map(i => i.path.join('.') + ': ' + i.message) });

// The athlete reads this in their language; the server has no i18n (see trainer/routes.js).
const PUSH = {
  es: { title: 'Tu entrenador te envió tu dieta', body: 'Ábrela en la pestaña Nutrición' },
  en: { title: 'Your trainer sent you your diet', body: 'Open it in the Diet tab' }
};

const serverToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function dietRoutes({ json, readBody, readSession, requireAdmin, users, readState, sendPush, todayFor = serverToday }) {
  const exists = uid => !!uid && users().some(u => u.id === uid);
  const idParam = req => new URL(req.url, 'http://x').searchParams.get('id');

  const send = (athlete, diet) => {
    const saved = store.save(athlete, diet);
    const lang = readState(athlete)?.lang === 'es' ? 'es' : 'en';
    sendPush(athlete, { ...PUSH[lang], tag: 'trainer-diet', url: '#/diet' }).catch(() => {});
    return saved;
  };
  const summary = t => ({
    id: t.id, name: t.diet.name, at: t.at, meals: t.diet.meals.length,
    kcal: t.diet.targets?.kcal ?? null, rest: !!t.diet.rest
  });

  return {
    // EM Fitness: every athlete's diet at a glance, for the trainer's Nutrición screen, with how
    // well they have kept to it over the last 7 complete days.
    'GET /api/trainer/diets': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const diets = {};
      for (const u of users()) {
        const d = store.read(u.id);
        if (!d) continue;
        const a = recentDietAdherence(readState(u.id) || {}, d, todayFor(u.id));
        diets[u.id] = {
          name: d.name || '', meals: d.meals.length, kcal: d.targets?.kcal ?? null, rest: !!d.rest, rev: d.rev, at: d.at,
          adherence: { rate: a.rate, evaluated: a.evaluated, logged: a.logged, days: a.days.map(x => ({ d: x.d, score: x.score, logged: x.logged })) }
        };
      }
      json(res, 200, { diets });
    },

    'GET /api/trainer/diet': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const athlete = idParam(req);
      if (!exists(athlete)) return json(res, 404, { error: 'no such user' });
      json(res, 200, { diet: store.read(athlete) });
    },

    'PUT /api/trainer/diet': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const body = await readBody(req);
      const athlete = String(body.athlete || '');
      if (!exists(athlete)) return json(res, 404, { error: 'no such user' });
      const parsed = Diet.safeParse(body.diet);
      if (!parsed.success) return invalid(json, res, 'diet', parsed);
      json(res, 200, { diet: send(athlete, withIds(parsed.data)) });
    },

    'DELETE /api/trainer/diet': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const athlete = idParam(req);
      if (!exists(athlete)) return json(res, 404, { error: 'no such user' });
      if (!store.remove(athlete)) return json(res, 404, { error: 'no diet' });
      json(res, 200, { ok: true });
    },

    /* ---------- templates ---------- */

    'GET /api/trainer/diet-templates': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      json(res, 200, { templates: templates.list().map(summary) });
    },

    'GET /api/trainer/diet-template': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const t = templates.get(idParam(req));
      if (!t) return json(res, 404, { error: 'no such template' });
      json(res, 200, { template: t });
    },

    // Creates without an id, replaces with one.
    'PUT /api/trainer/diet-template': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const body = await readBody(req);
      const parsed = Template.safeParse(body.diet);
      if (!parsed.success) return invalid(json, res, 'template', parsed);
      const id = body.id ? String(body.id) : null;
      const t = templates.save(id, withIds(parsed.data));
      if (!t) return json(res, id ? 404 : 409, { error: id ? 'no such template' : 'too many templates' });
      json(res, 200, { template: t });
    },

    'DELETE /api/trainer/diet-template': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      if (!templates.remove(idParam(req))) return json(res, 404, { error: 'no such template' });
      json(res, 200, { ok: true });
    },

    // Hands a template out: each athlete gets their own copy, replacing the diet they had.
    'POST /api/trainer/diet-template/assign': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const body = await readBody(req);
      const t = templates.get(String(body.id || ''));
      if (!t) return json(res, 404, { error: 'no such template' });
      const ids = Array.isArray(body.athletes) ? [...new Set(body.athletes.map(String))].slice(0, 500) : [];
      if (!ids.length) return json(res, 400, { error: 'no athletes' });
      const sent = [], skipped = [];
      for (const athlete of ids) {
        if (exists(athlete)) { send(athlete, t.diet); sent.push(athlete); } else skipped.push(athlete);
      }
      json(res, 200, { sent, skipped });
    },

    'GET /api/athlete/diet': async (req, res) => {
      const user = readSession(req);
      if (!user) return json(res, 401, { error: 'not signed in' });
      json(res, 200, { diet: store.read(user.id) });
    }
  };
}
