/* Monthly fees: date arithmetic at month and year edges, permissions, payments moving the due
   date, undo, per-athlete isolation and the reminder pushes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData } from './helpers.mjs';

tempData();
const { addMonth, status, isDay, daysBetween } = await import('../billing/dates.js');
const { billingRoutes, billingReminders } = await import('../billing/routes.js');

const USERS = [{ id: 'coach', admin: true }, { id: 'ana' }, { id: 'luis' }, { id: 'off', disabled: true }];
const routes = billingRoutes({
  json: (res, code, body) => { res.code = code; res.body = body; },
  readBody: async req => req.body || {},
  readSession: req => USERS.find(u => u.id === req.as) || null,
  requireAdmin: (req, res) => {
    const u = USERS.find(x => x.id === req.as);
    if (!u) { res.code = 401; return null; }
    if (!u.admin) { res.code = 403; return null; }
    return u;
  },
  users: () => USERS
});
async function call(key, { as, body, url } = {}) {
  const req = { as, body, url: url || '/' }, res = {};
  await routes[key](req, res);
  return res;
}
const plan = (athlete, over = {}) => call('PUT /api/trainer/billing', { as: 'coach', body: { athlete, fee: 500, day: 31, due: '2027-01-31', ...over } });
const pay = (athlete, body = {}) => call('POST /api/trainer/billing/pay', { as: 'coach', body: { athlete, ...body } });
const mine = as => call('GET /api/athlete/billing', { as });

test('addMonth keeps the billing day across short months and the year end', () => {
  assert.equal(addMonth('2027-01-31', 31), '2027-02-28');
  assert.equal(addMonth('2027-02-28', 31), '2027-03-31', 'back to the 31st, no drift');
  assert.equal(addMonth('2028-01-31', 31), '2028-02-29', 'leap year');
  assert.equal(addMonth('2027-12-15', 15), '2028-01-15');
  assert.equal(addMonth('2027-04-30', 30), '2027-05-30');
  assert.equal(addMonth('2027-01-01', 1), '2027-02-01');
});

test('status: overdue from the day after, soon within five days', () => {
  assert.deepEqual(status('2027-03-10', '2027-03-11'), { left: -1, state: 'overdue' });
  assert.deepEqual(status('2027-03-10', '2027-03-10'), { left: 0, state: 'soon' });
  assert.deepEqual(status('2027-03-10', '2027-03-05'), { left: 5, state: 'soon' });
  assert.deepEqual(status('2027-03-10', '2027-03-04'), { left: 6, state: 'ok' });
  assert.equal(daysBetween('2027-12-31', '2028-01-01'), 1);
  assert.equal(daysBetween('2027-03-27', '2027-03-29'), 2, 'no DST hour lost');
});

test('isDay refuses dates that do not exist', () => {
  assert.ok(isDay('2028-02-29'));
  for (const bad of ['2027-02-29', '2027-04-31', '2027-13-01', '2027-1-01', '', null, '2027-01-01T00:00'])
    assert.equal(isDay(bad), false, String(bad));
});

test('only the admin sets fees or records payments', async () => {
  assert.equal((await call('PUT /api/trainer/billing', { as: 'luis', body: { athlete: 'ana', fee: 1, day: 1, due: '2027-01-01' } })).code, 403);
  assert.equal((await call('POST /api/trainer/billing/pay', { as: 'luis', body: { athlete: 'ana' } })).code, 403);
  assert.equal((await call('GET /api/trainer/billing', { as: 'ana' })).code, 403);
  assert.equal((await call('GET /api/trainer/billing', {})).code, 401);
  assert.equal((await mine(null)).code, 401);
  assert.equal((await mine('ana')).body.billing, null, 'refused calls wrote nothing');
});

test('bad input is refused', async () => {
  assert.equal((await plan('ana', { due: '2027-02-30' })).code, 400);
  assert.equal((await plan('ana', { day: 0 })).code, 400);
  assert.equal((await plan('ana', { day: 32 })).code, 400);
  assert.equal((await plan('ana', { fee: -1 })).code, 400);
  assert.equal((await plan('nadie')).code, 404);
  assert.equal((await pay('ana')).code, 404, 'no fee set yet');
});

test('a payment settles the current due date and moves it a month, only for that athlete', async () => {
  assert.equal((await plan('ana')).code, 200);
  const r = await pay('ana', { note: 'efectivo' });
  assert.equal(r.code, 200);
  assert.equal(r.body.payment.period, '2027-01-31');
  assert.equal(r.body.payment.amount, 500, 'defaults to the fee');
  assert.equal(r.body.billing.due, '2027-02-28');
  assert.equal((await pay('ana', { amount: 450 })).body.billing.due, '2027-03-31');
  const b = (await mine('ana')).body.billing;
  assert.equal(b.due, '2027-03-31');
  assert.equal(b.last.amount, 450);
  assert.equal(b.notified, undefined, 'bookkeeping stays on the server');
  assert.equal((await mine('luis')).body.billing, null);
  const all = (await call('GET /api/trainer/billing', { as: 'coach' })).body.billing;
  assert.deepEqual(Object.keys(all), ['ana']);
  const hist = (await call('GET /api/trainer/billing/user', { as: 'coach', url: '/?id=ana' })).body.billing.payments;
  assert.deepEqual(hist.map(p => p.period), ['2027-02-28', '2027-01-31'], 'newest first');
});

test('undo reverts only the latest payment', async () => {
  const hist = (await call('GET /api/trainer/billing/user', { as: 'coach', url: '/?id=ana' })).body.billing.payments;
  const undo = pid => call('POST /api/trainer/billing/undo', { as: 'coach', body: { athlete: 'ana', pid } });
  assert.equal((await undo(hist[1].id)).code, 409, 'an older payment cannot be undone');
  const r = await undo(hist[0].id);
  assert.equal(r.code, 200);
  assert.equal(r.body.billing.due, '2027-02-28');
  assert.equal(r.body.billing.last.period, '2027-01-31');
  assert.equal((await undo(hist[0].id)).code, 409, 'twice is refused');
});

test('editing the plan keeps the payment history', async () => {
  const r = await plan('ana', { fee: 600, day: 15, due: '2027-03-15' });
  assert.equal(r.body.billing.fee, 600);
  assert.equal(r.body.billing.last.period, '2027-01-31');
});

test('reminders: three days before and on the due date, once each, from 9:00', async () => {
  await plan('luis', { due: '2027-05-10', day: 10 });
  await plan('off', { due: '2027-05-10', day: 10 });
  const sent = [];
  let now = { date: '2027-05-06', hour: 12 };
  const run = () => billingReminders({
    users: () => USERS, todayFor: () => now,
    readState: uid => (uid === 'luis' ? { lang: 'es' } : null),
    sendPush: async (uid, p) => { sent.push({ uid, ...p }); }
  });
  run();
  assert.deepEqual(sent.filter(s => s.uid === 'luis'), [], 'four days before: nothing');
  now = { date: '2027-05-07', hour: 8 }; run();
  assert.equal(sent.filter(s => s.uid === 'luis').length, 0, 'not before 9:00');
  now = { date: '2027-05-07', hour: 9 }; run(); run();
  const luis = () => sent.filter(s => s.uid === 'luis');
  assert.equal(luis().length, 1, 'once, however many passes');
  assert.match(luis()[0].body, /3 días/);
  now = { date: '2027-05-10', hour: 10 }; run(); run();
  assert.equal(luis().length, 2);
  assert.match(luis()[1].title, /Hoy vence/);
  assert.ok(!sent.some(s => s.uid === 'off'), 'a disabled account gets nothing');
  await pay('luis');
  now = { date: '2027-06-07', hour: 10 }; run();
  assert.equal(luis().length, 3, 'the next due date has its own reminders');
});
