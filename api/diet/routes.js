/* HTTP surface for diets: the admin (the trainer) writes one diet per athlete; each athlete
 * reads their own. Same factory shape as trainer/routes.js and coach/routes.js.
 */
import { z } from 'zod';
import * as store from './store.js';

const amount = z.number().finite().min(0).max(100000);
const macro = z.number().finite().min(0).max(20000);
const text = max => z.string().trim().max(max);

const Food = z.object({
  name: text(80).min(1),
  qty: amount.optional(),
  unit: text(16).optional(),
  kcal: macro.optional(), p: macro.optional(), c: macro.optional(), f: macro.optional()
});
const Meal = z.object({
  name: text(60).min(1),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  notes: text(500).optional(),
  foods: z.array(Food).max(30)
});
const Diet = z.object({
  name: text(80).default(''),
  notes: text(2000).optional(),
  targets: z.object({ kcal: macro.optional(), p: macro.optional(), c: macro.optional(), f: macro.optional() }).optional(),
  meals: z.array(Meal).min(1).max(12)
});

// The athlete reads this in their language; the server has no i18n (see trainer/routes.js).
const PUSH = {
  es: { title: 'Tu entrenador te envió tu dieta', body: 'Ábrela en la pestaña Dieta' },
  en: { title: 'Your trainer sent you your diet', body: 'Open it in the Diet tab' }
};

export function dietRoutes({ json, readBody, readSession, requireAdmin, users, readState, sendPush }) {
  const exists = uid => !!uid && users().some(u => u.id === uid);
  const idParam = req => new URL(req.url, 'http://x').searchParams.get('id');

  return {
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
      if (!parsed.success) return json(res, 400, { error: 'invalid diet', issues: parsed.error.issues.map(i => i.path.join('.') + ': ' + i.message) });
      const diet = store.save(athlete, parsed.data);
      const lang = readState(athlete)?.lang === 'es' ? 'es' : 'en';
      sendPush(athlete, { ...PUSH[lang], tag: 'trainer-diet', url: '#/diet' }).catch(() => {});
      json(res, 200, { diet });
    },

    'DELETE /api/trainer/diet': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const athlete = idParam(req);
      if (!exists(athlete)) return json(res, 404, { error: 'no such user' });
      if (!store.remove(athlete)) return json(res, 404, { error: 'no diet' });
      json(res, 200, { ok: true });
    },

    'GET /api/athlete/diet': async (req, res) => {
      const user = readSession(req);
      if (!user) return json(res, 401, { error: 'not signed in' });
      json(res, 200, { diet: store.read(user.id) });
    }
  };
}
