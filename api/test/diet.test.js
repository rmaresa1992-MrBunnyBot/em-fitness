/* Diet routes against fakes of server.js's helpers: permissions, validation, revisions,
   removal and per-athlete isolation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData } from './helpers.mjs';

tempData();
const { dietRoutes } = await import('../diet/routes.js');

const USERS = [{ id: 'coach', admin: true }, { id: 'ana' }, { id: 'luis' }];
const pushes = [];
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
  readState: uid => (uid === 'ana' ? { lang: 'es' } : null),
  sendPush: async (uid, payload) => { pushes.push({ uid, ...payload }); }
});
async function call(key, { as, body, url } = {}) {
  const req = { as, body, url: url || '/' }, res = {};
  await routes[key](req, res);
  return res;
}

const diet = (over = {}) => ({
  name: 'Volumen', targets: { kcal: 2800, p: 180 },
  meals: [
    { name: 'Desayuno', time: '08:00', foods: [{ name: 'Avena', qty: 80, unit: 'g', kcal: 300, p: 10, c: 54, f: 6 }, { name: 'Plátano', qty: 1, unit: 'pieza' }] },
    { name: 'Comida', foods: [{ name: 'Pollo', qty: 200, unit: 'g', kcal: 330, p: 62 }] }
  ],
  ...over
});
const put = (athlete, d, as = 'coach') => call('PUT /api/trainer/diet', { as, body: { athlete, diet: d } });
const mine = as => call('GET /api/athlete/diet', { as });

test('only the admin can read, write or remove a diet', async () => {
  assert.equal((await put('ana', diet(), 'luis')).code, 403);
  assert.equal((await put('ana', diet(), null)).code, 401);
  assert.equal((await call('GET /api/trainer/diet', { as: 'luis', url: '/?id=ana' })).code, 403);
  assert.equal((await call('DELETE /api/trainer/diet', { as: 'luis', url: '/?id=ana' })).code, 403);
  assert.equal((await mine(null)).code, 401);
  assert.equal((await mine('ana')).body.diet, null, 'refused calls wrote nothing');
});

test('a diet reaches only its athlete, with a push in their language', async () => {
  pushes.length = 0;
  const r = await put('ana', diet());
  assert.equal(r.code, 200);
  assert.equal(r.body.diet.rev, 1);
  const d = (await mine('ana')).body.diet;
  assert.equal(d.name, 'Volumen');
  assert.equal(d.meals[0].foods[0].name, 'Avena');
  assert.equal((await mine('luis')).body.diet, null);
  assert.equal((await call('GET /api/trainer/diet', { as: 'coach', url: '/?id=ana' })).body.diet.rev, 1);
  assert.deepEqual(pushes.map(p => p.uid), ['ana']);
  assert.match(pushes[0].title, /dieta/);
});

test('sending again replaces the diet and bumps the revision', async () => {
  await put('ana', diet({ name: 'Definición', targets: undefined, meals: [{ name: 'Única', foods: [] }] }));
  const d = (await mine('ana')).body.diet;
  assert.equal(d.rev, 2);
  assert.equal(d.name, 'Definición');
  assert.equal(d.meals.length, 1);
  assert.equal(d.targets, undefined, 'nothing from the previous version leaks into the new one');
});

test('removing hides it and the revision keeps counting after a re-send', async () => {
  assert.equal((await call('DELETE /api/trainer/diet', { as: 'coach', url: '/?id=ana' })).code, 200);
  assert.equal((await mine('ana')).body.diet, null);
  assert.equal((await call('DELETE /api/trainer/diet', { as: 'coach', url: '/?id=ana' })).code, 404);
  await put('ana', diet());
  assert.equal((await mine('ana')).body.diet.rev, 4);
});

test('unknown athletes are refused', async () => {
  assert.equal((await put('ghost', diet())).code, 404);
  assert.equal((await put('', diet())).code, 404);
  assert.equal((await call('GET /api/trainer/diet', { as: 'coach', url: '/?id=ghost' })).code, 404);
  assert.equal((await call('GET /api/trainer/diet', { as: 'coach', url: '/' })).code, 404);
});

test('malformed diets are rejected', async () => {
  const food = { name: 'x' };
  const bad = [
    undefined,
    diet({ meals: [] }),
    diet({ meals: Array.from({ length: 13 }, () => ({ name: 'm', foods: [] })) }),
    diet({ meals: [{ name: '   ', foods: [] }] }),
    diet({ meals: [{ name: 'm', foods: [{ name: '' }] }] }),
    diet({ meals: [{ name: 'm', foods: [{ ...food, qty: -1 }] }] }),
    diet({ meals: [{ name: 'm', foods: [{ ...food, kcal: '300' }] }] }),
    diet({ meals: [{ name: 'm', time: '25:00', foods: [] }] }),
    diet({ meals: [{ name: 'm', foods: Array.from({ length: 31 }, () => food) }] }),
    diet({ targets: { kcal: -5 } })
  ];
  for (const d of bad) assert.equal((await put('luis', d)).code, 400, JSON.stringify(d)?.slice(0, 90));
  assert.equal((await mine('luis')).body.diet, null);
});

test('text is trimmed and unknown fields are dropped', async () => {
  await put('luis', { name: '  Base  ', meals: [{ name: ' Cena ', foods: [{ name: ' Huevo ', qty: 2, evil: '<script>' }] }], rev: 999 });
  const d = (await mine('luis')).body.diet;
  assert.equal(d.name, 'Base');
  assert.equal(d.meals[0].name, 'Cena');
  assert.deepEqual(d.meals[0].foods[0], { name: 'Huevo', qty: 2 });
  assert.equal(d.rev, 1, 'a client cannot set its own revision');
});

test('a failing push does not fail the save', async () => {
  const flaky = dietRoutes({
    json: (res, code, body) => { res.code = code; res.body = body; },
    readBody: async req => req.body, readSession: () => null,
    requireAdmin: () => USERS[0], users: () => USERS, readState: () => null,
    sendPush: async () => { throw new Error('push down'); }
  });
  const res = {};
  await flaky['PUT /api/trainer/diet']({ body: { athlete: 'luis', diet: diet() } }, res);
  assert.equal(res.code, 200);
});

test('the trainer gets every diet at a glance; athletes cannot', async () => {
  assert.equal((await call('GET /api/trainer/diets', { as: 'luis' })).code, 403);
  assert.equal((await call('GET /api/trainer/diets', {})).code, 401);
  const r = await call('GET /api/trainer/diets', { as: 'coach' });
  assert.equal(r.code, 200);
  const ana = r.body.diets.ana;
  assert.ok(ana, 'ana has a diet');
  assert.equal(typeof ana.meals, 'number');
  assert.ok(ana.rev >= 1);
  assert.equal(r.body.diets.coach, undefined, 'no diet, no entry');
});
