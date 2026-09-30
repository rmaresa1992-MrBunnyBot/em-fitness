/* Trainer routes against fakes of server.js's helpers: permissions, validation, revisions,
   tombstones and per-athlete isolation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData } from './helpers.mjs';

tempData();
const { trainerRoutes } = await import('../trainer/routes.js');

const USERS = [
  { id: 'coach', name: 'Coach', admin: true },
  { id: 'ana', name: 'Ana' },
  { id: 'luis', name: 'Luis' }
];
const pushes = [];
const routes = trainerRoutes({
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

const routine = (over = {}) => ({
  id: 'r-push', name: 'Empuje', emoji: '💪',
  ex: [{ id: '0001', sets: 3, reps: 10, weight: 20 }, { id: '0007', sets: 3, mode: 'time', sec: 45 }],
  ...over
});
const assign = (body, as = 'coach') => call('POST /api/trainer/assign', { as, body });
const mine = as => call('GET /api/athlete/assignments', { as });

test('only the admin can assign, list or withdraw', async () => {
  assert.equal((await assign({ athletes: ['luis'], routine: routine(), days: [1] }, 'ana')).code, 403);
  assert.equal((await assign({ athletes: ['luis'], routine: routine(), days: [1] }, null)).code, 401);
  assert.equal((await call('GET /api/trainer/assignments', { as: 'ana', url: '/?id=luis' })).code, 403);
  assert.equal((await call('POST /api/trainer/unassign', { as: 'ana', body: { athlete: 'luis', rid: 'r-push' } })).code, 403);
  assert.equal((await mine(null)).code, 401);
  assert.equal((await mine('luis')).body.assignments.length, 0, 'refused calls wrote nothing');
});

test('an assignment reaches only the athletes it names, with a push in their language', async () => {
  pushes.length = 0;
  const r = await assign({ athletes: ['ana'], routine: routine(), days: [1, 4] });
  assert.equal(r.code, 200);
  assert.equal(r.body.assigned[0].rev, 1);
  const a = (await mine('ana')).body.assignments;
  assert.equal(a.length, 1);
  assert.deepEqual(a[0].days, [1, 4]);
  assert.equal(a[0].routine.name, 'Empuje');
  assert.equal(a[0].routine.id, undefined, 'the trainer routine id travels as rid, not inside routine');
  assert.equal(a[0].rid, 'r-push');
  assert.equal((await mine('luis')).body.assignments.length, 0);
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0].uid, 'ana');
  assert.match(pushes[0].title, /entrenador/);
});

test('re-assigning the same routine replaces it and bumps the revision', async () => {
  await assign({ athletes: ['ana'], routine: routine({ name: 'Empuje v2' }), days: [2] });
  const a = (await mine('ana')).body.assignments;
  assert.equal(a.length, 1);
  assert.equal(a[0].rev, 2);
  assert.equal(a[0].routine.name, 'Empuje v2');
  assert.deepEqual(a[0].days, [2]);
});

test('withdrawing leaves a tombstone for the athlete and hides it from the trainer list', async () => {
  const r = await call('POST /api/trainer/unassign', { as: 'coach', body: { athlete: 'ana', rid: 'r-push' } });
  assert.equal(r.code, 200);
  const a = (await mine('ana')).body.assignments;
  assert.equal(a.length, 1);
  assert.equal(a[0].removed, true);
  assert.equal(a[0].rev, 3);
  assert.equal(a[0].routine, undefined);
  assert.equal((await call('GET /api/trainer/assignments', { as: 'coach', url: '/?id=ana' })).body.assignments.length, 0);
  // withdrawing twice is a 404, not a second tombstone
  assert.equal((await call('POST /api/trainer/unassign', { as: 'coach', body: { athlete: 'ana', rid: 'r-push' } })).code, 404);
});

test('re-assigning after a withdrawal revives it with a higher revision', async () => {
  await assign({ athletes: ['ana'], routine: routine(), days: [5] });
  const a = (await mine('ana')).body.assignments;
  assert.equal(a[0].rev, 4);
  assert.equal(a[0].removed, undefined);
});

test('one request can assign to several athletes', async () => {
  const r = await assign({ athletes: ['ana', 'luis'], routine: routine({ id: 'r-legs', name: 'Pierna' }), days: [3] });
  assert.equal(r.code, 200);
  assert.equal(r.body.assigned.length, 2);
  assert.ok((await mine('luis')).body.assignments.some(a => a.rid === 'r-legs'));
});

test('unknown athletes are refused before anything is written', async () => {
  const r = await assign({ athletes: ['luis', 'ghost'], routine: routine({ id: 'r-new' }), days: [] });
  assert.equal(r.code, 404);
  assert.deepEqual(r.body.missing, ['ghost']);
  assert.ok(!(await mine('luis')).body.assignments.some(a => a.rid === 'r-new'));
});

test('malformed assignments are rejected', async () => {
  const bad = [
    { athletes: [], routine: routine(), days: [] },
    { athletes: ['ana'], routine: routine({ ex: [] }), days: [] },
    { athletes: ['ana'], routine: routine({ name: '   ' }), days: [] },
    { athletes: ['ana'], routine: routine(), days: [1, 1] },
    { athletes: ['ana'], routine: routine(), days: [7] },
    { athletes: ['ana'], routine: routine({ ex: [{ id: '0001', sets: 0 }] }), days: [] },
    { athletes: ['ana'], routine: routine({ ex: [{ id: '0001', sets: 3, prog: 'magic' }] }), days: [] },
    { athletes: ['ana'], routine: routine({ ex: Array.from({ length: 41 }, () => ({ id: '0001', sets: 1 })) }), days: [] }
  ];
  for (const body of bad) assert.equal((await assign(body)).code, 400, JSON.stringify(body).slice(0, 80));
});

test('unknown exercise fields are dropped, not stored', async () => {
  await assign({ athletes: ['luis'], routine: routine({ id: 'r-x', ex: [{ id: '0001', sets: 2, evil: '<script>' }] }), days: [] });
  const a = (await mine('luis')).body.assignments.find(x => x.rid === 'r-x');
  assert.deepEqual(a.routine.ex[0], { id: '0001', sets: 2 });
});

test('a failing push does not fail the assignment', async () => {
  const flaky = trainerRoutes({
    json: (res, code, body) => { res.code = code; res.body = body; },
    readBody: async req => req.body, readSession: () => null,
    requireAdmin: () => USERS[0], users: () => USERS, readState: () => null,
    sendPush: async () => { throw new Error('push service down'); }
  });
  const res = {};
  await flaky['POST /api/trainer/assign']({ body: { athletes: ['luis'], routine: routine({ id: 'r-y' }), days: [] } }, res);
  assert.equal(res.code, 200);
});

test('a drop set (serie descendente) travels with its per-set reps and weights', async () => {
  const drop = { id: '0001', sets: 3, mode: 'reps', reps: 10, weight: 30, scheme: [{ r: 10, w: 30 }, { r: 15, w: 20 }, { r: 20, w: 10 }] };
  const r = await assign({ athletes: ['luis'], routine: routine({ id: 'r-drop', ex: [drop] }), days: [2] });
  assert.equal(r.code, 200);
  const got = (await mine('luis')).body.assignments.find(a => a.rid === 'r-drop');
  assert.deepEqual(got.routine.ex[0].scheme, drop.scheme);
  for (const bad of [[{ r: 10, w: 30 }], [{ r: 0, w: 30 }, { r: 5, w: 10 }], [{ r: 10, w: -1 }, { r: 5, w: 10 }], Array(11).fill({ r: 5, w: 5 })])
    assert.equal((await assign({ athletes: ['luis'], routine: routine({ id: 'r-bad', ex: [{ ...drop, scheme: bad }] }), days: [] })).code, 400, JSON.stringify(bad).slice(0, 40));
});

test('rest between sets (seconds) is kept and bounded', async () => {
  const ok = await assign({ athletes: ['luis'], routine: routine({ id: 'r-rest', ex: [{ id: '0001', sets: 3, reps: 10, rest: 90 }] }), days: [] });
  assert.equal(ok.code, 200);
  assert.equal((await mine('luis')).body.assignments.find(a => a.rid === 'r-rest').routine.ex[0].rest, 90);
  for (const bad of [-5, 901, 1.5, '90'])
    assert.equal((await assign({ athletes: ['luis'], routine: routine({ id: 'r-rest2', ex: [{ id: '0001', sets: 3, reps: 10, rest: bad }] }), days: [] })).code, 400, String(bad));
});
