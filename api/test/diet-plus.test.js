/* Diets, second part (EM Fitness fase 7b): meal ids, the rest-day variant, catalog links, `since`,
   templates and handing them out, and diet adherence for the trainer. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData } from './helpers.mjs';

tempData();
const { dietRoutes } = await import('../diet/routes.js');
const { dietAdherence, recentDietAdherence } = await import('../diet/adherence.js');
const { buildDashboard } = await import('../trainer/dashboard.js');

const USERS = [{ id: 'coach', admin: true }, { id: 'ana' }, { id: 'luis' }, { id: 'eva' }];
const STATES = {};
const pushes = [];
const TODAY = '2026-09-30';   // a Wednesday
const routes = dietRoutes({
  json: (res, code, body) => { res.code = code; res.body = body; },
  readBody: async req => req.body || {},
  readSession: req => USERS.find(u => u.id === req.as) || null,
  requireAdmin: (req, res) => {
    const u = USERS.find(x => x.id === req.as);
    if (!u) { res.code = 401; return null; }
    if (!u.admin) { res.code = 403; return null; }
    return u;
  },
  users: () => USERS,
  readState: uid => STATES[uid] || null,
  sendPush: async (uid, payload) => { pushes.push({ uid, ...payload }); },
  todayFor: () => TODAY
});
async function call(key, { as = 'coach', body, url } = {}) {
  const req = { as, body, url: url || '/' }, res = {};
  await routes[key](req, res);
  return res;
}
const meal = (name, over = {}) => ({ name, foods: [{ name: 'x', kcal: 100 }], ...over });
const diet = (over = {}) => ({ name: 'Volumen', meals: [meal('Desayuno'), meal('Comida')], ...over });
const put = (athlete, d) => call('PUT /api/trainer/diet', { body: { athlete, diet: d } });

test('meals get ids: kept, positional when missing, fresh when duplicated', async () => {
  const d = (await put('ana', diet({ meals: [meal('A', { id: 'abc' }), meal('B'), meal('C', { id: 'abc' })] }))).body.diet;
  assert.equal(d.meals[0].id, 'abc');
  assert.equal(d.meals[1].id, 't1');
  assert.equal(d.meals[2].id, 't2', 'a duplicate falls back to its position');
  const d2 = (await put('ana', diet({ meals: [meal('A', { id: 't1' }), meal('B')] }))).body.diet;
  assert.equal(d2.meals[0].id, 't1');
  assert.match(d2.meals[1].id, /^m[0-9a-f]{10}$/, 'position taken → a fresh id');
  for (const bad of ['a b', 'x'.repeat(25), '', '<x>']) assert.equal((await put('ana', diet({ meals: [meal('A', { id: bad })] }))).code, 400, bad);
});

test('a rest-day variant and catalog links are stored; bad ones are refused', async () => {
  const d = (await put('ana', diet({
    rest: { targets: { kcal: 2000 }, meals: [meal('Única')] },
    meals: [{ name: 'Desayuno', foods: [{ name: 'Huevo entero', ref: 'huevo', qty: 2, unit: 'pieza', kcal: 143 }] }]
  }))).body.diet;
  assert.equal(d.rest.meals[0].id, 'r0');
  assert.equal(d.rest.targets.kcal, 2000);
  assert.equal(d.meals[0].foods[0].ref, 'huevo');
  assert.equal((await put('ana', diet({ rest: { meals: [] } }))).code, 400, 'a rest day needs a meal');
  assert.equal((await put('ana', diet({ meals: [{ name: 'm', foods: [{ name: 'x', ref: 'Huevo!' }] }] }))).code, 400);
});

test('`since` survives revisions and restarts after a removal', async () => {
  const first = (await put('luis', diet())).body.diet;
  assert.ok(first.since);
  await new Promise(r => setTimeout(r, 5));
  const second = (await put('luis', diet({ name: 'Otra' }))).body.diet;
  assert.equal(second.since, first.since);
  assert.ok(second.at > first.at);
  await call('DELETE /api/trainer/diet', { url: '/?id=luis' });
  await new Promise(r => setTimeout(r, 5));
  const third = (await put('luis', diet())).body.diet;
  assert.ok(third.since > first.since);
});

test('the push points at the Nutrición tab in Spanish', async () => {
  STATES.eva = { lang: 'es' };
  pushes.length = 0;
  await put('eva', diet());
  assert.match(pushes[0].body, /Nutrición/);
});

test('templates: only the trainer, create, read, replace, list, delete', async () => {
  assert.equal((await call('GET /api/trainer/diet-templates', { as: 'ana' })).code, 403);
  assert.equal((await call('PUT /api/trainer/diet-template', { as: 'ana', body: { diet: diet() } })).code, 403);
  assert.equal((await call('PUT /api/trainer/diet-template', { body: { diet: diet({ name: '  ' }) } })).code, 400, 'a template needs a name');
  const t = (await call('PUT /api/trainer/diet-template', { body: { diet: diet({ name: 'Definición', targets: { kcal: 1900 } }) } })).body.template;
  assert.match(t.id, /^[0-9a-f]{12}$/);
  assert.equal(t.diet.meals[0].id, 't0');
  const t2 = (await call('PUT /api/trainer/diet-template', { body: { diet: diet({ name: 'Volumen', rest: { meals: [meal('x')] } }) } })).body.template;
  const list = (await call('GET /api/trainer/diet-templates')).body.templates;
  assert.deepEqual(list.map(x => x.name).sort(), ['Definición', 'Volumen']);
  assert.equal(list.find(x => x.id === t.id).kcal, 1900);
  assert.equal(list.find(x => x.id === t2.id).rest, true);
  const upd = (await call('PUT /api/trainer/diet-template', { body: { id: t.id, diet: diet({ name: 'Definición 2' }) } })).body.template;
  assert.equal(upd.id, t.id);
  assert.equal((await call('GET /api/trainer/diet-template', { url: '/?id=' + t.id })).body.template.diet.name, 'Definición 2');
  assert.equal((await call('PUT /api/trainer/diet-template', { body: { id: 'nope', diet: diet() } })).code, 404);
  assert.equal((await call('DELETE /api/trainer/diet-template', { url: '/?id=' + t2.id })).code, 200);
  assert.equal((await call('DELETE /api/trainer/diet-template', { url: '/?id=' + t2.id })).code, 404);
  assert.equal((await call('GET /api/trainer/diet-template', { url: '/?id=' + t2.id })).code, 404);
});

test('handing a template out copies it to each athlete and skips unknown ones', async () => {
  const t = (await call('PUT /api/trainer/diet-template', { body: { diet: diet({ name: 'Base' }) } })).body.template;
  pushes.length = 0;
  const r = await call('POST /api/trainer/diet-template/assign', { body: { id: t.id, athletes: ['ana', 'luis', 'ghost', 'ana'] } });
  assert.equal(r.code, 200);
  assert.deepEqual(r.body.sent, ['ana', 'luis']);
  assert.deepEqual(r.body.skipped, ['ghost']);
  assert.deepEqual(pushes.map(p => p.uid), ['ana', 'luis']);
  assert.equal((await call('GET /api/athlete/diet', { as: 'luis' })).body.diet.name, 'Base');
  // Editing the template later changes nobody's diet.
  await call('PUT /api/trainer/diet-template', { body: { id: t.id, diet: diet({ name: 'Base v2' }) } });
  assert.equal((await call('GET /api/athlete/diet', { as: 'luis' })).body.diet.name, 'Base');
  assert.equal((await call('POST /api/trainer/diet-template/assign', { body: { id: t.id, athletes: [] } })).code, 400);
  assert.equal((await call('POST /api/trainer/diet-template/assign', { body: { id: 'nope', athletes: ['ana'] } })).code, 404);
  assert.equal((await call('POST /api/trainer/diet-template/assign', { as: 'ana', body: { id: t.id, athletes: ['ana'] } })).code, 403);
});

/* ---------- adherence ---------- */

// Routine Mon/Wed/Fri; a diet first sent on 2026-09-21 (Monday) with a rest-day variant.
const sinceMs = new Date('2026-09-21T09:00:00').getTime();
const plan = (dietLog = {}) => ({ routines: [{ id: 'r' }], week: { 1: 'r', 3: 'r', 5: 'r' }, dayPlan: {}, dietLog });
const D = { since: sinceMs, at: sinceMs, meals: [meal('A'), meal('B')], rest: { meals: [meal('Única')] } };

test('server diet adherence scores days like the client', () => {
  const S = plan({
    '2026-09-28': { v: 't', n: 2, m: { t0: 'ok', t1: 'half' } },   // Monday: 0.75
    '2026-09-29': { v: 'r', n: 1, m: { r0: 'ok' } },               // Tuesday: 1
    '2026-09-27': { v: 't', n: 1, m: { t0: 'ok', t1: 'ok' } }      // capped at 1
  });
  const a = dietAdherence(S, D, '2026-09-27', '2026-09-29');
  assert.deepEqual(a.days.map(d => d.score), [1, 0.75, 1]);
  assert.equal(a.logged, 3);
  const r = recentDietAdherence(S, D, TODAY);
  assert.equal(r.days[0].d, '2026-09-23');
  assert.equal(r.days.at(-1).d, '2026-09-29');
  assert.equal(r.evaluated, 7);
  assert.equal(dietAdherence(S, null, '2026-09-01', '2026-09-30').rate, null);
  assert.equal(dietAdherence({}, D, '2026-09-01', '2026-09-20').evaluated, 0, 'nothing before the diet');
  assert.equal(dietAdherence(null, D, '2026-09-21', '2026-09-21').rate, 0, 'no state: unmarked');
});

test('the Nutrición list carries each athlete’s last 7 days', async () => {
  STATES.ana = plan({ '2026-09-29': { v: 't', n: 1, m: { t0: 'ok' } } });
  const r = await call('GET /api/trainer/diets');
  const ana = r.body.diets.ana.adherence;
  assert.ok(ana.evaluated >= 1 && ana.evaluated <= 7);
  assert.equal(ana.days.at(-1).d, '2026-09-29');
  assert.equal(ana.days.at(-1).score, 1);
});

test('the dashboard warns when the diet is kept under 75 %, not before 3 days', () => {
  const dash = (states, diets) => buildDashboard({
    users: [{ id: 'coach', admin: true }, ...Object.keys(states).map(id => ({ id, name: id }))],
    isAdmin: u => !!u.admin, readState: id => states[id], assignments: () => [], billing: () => null,
    unread: () => 0, todayFor: () => TODAY, diet: id => diets[id] || null
  });
  const full = {}; const half = {};
  for (const d of ['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29']) {
    full[d] = { v: 't', n: 2, m: { t0: 'ok', t1: 'ok' } };
    half[d] = { v: 't', n: 2, m: { t0: 'ok' } };
  }
  const recent = { ...D, since: new Date('2026-09-28T09:00:00').getTime() };   // only 2 days old
  const r = dash(
    { good: plan(full), poor: plan(half), fresh: plan({}), none: plan({}) },
    { good: D, poor: D, fresh: recent }
  );
  const kinds = id => r.alerts.filter(a => a.athlete === id && a.kind === 'diet');
  assert.equal(kinds('good').length, 0);
  assert.equal(kinds('poor').length, 1);
  assert.equal(kinds('poor')[0].severity, 'medium');
  assert.equal(kinds('poor')[0].rate, 0.5);
  assert.equal(kinds('fresh').length, 0, 'two days are not enough to judge');
  assert.equal(r.rows.find(x => x.id === 'none').diet, null);
  assert.equal(r.rows.find(x => x.id === 'good').diet.rate, 1);
});
