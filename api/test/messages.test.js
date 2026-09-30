/* Chat routes against fakes of server.js's helpers: permissions, both directions, broadcast,
   unread counts and read marks, the polling cursor, validation and pushes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData } from './helpers.mjs';

tempData();
const { messageRoutes } = await import('../messages/routes.js');
const { MAX_MSGS } = await import('../messages/store.js');

const USERS = [{ id: 'coach', admin: true, name: 'Coach' }, { id: 'ana', name: 'Ana' }, { id: 'luis', name: 'Luis' }, { id: 'off', name: 'Off', disabled: true }];
const pushes = [];
const isAdmin = u => !!u?.admin;
const routes = messageRoutes({
  json: (res, code, body) => { res.code = code; res.body = body; },
  readBody: async req => req.body || {},
  readSession: req => USERS.find(u => u.id === req.as) || null,
  requireAdmin: (req, res) => {
    const u = USERS.find(x => x.id === req.as);
    if (!u) { res.code = 401; return null; }
    if (!u.admin) { res.code = 403; return null; }
    return u;
  },
  users: () => USERS, isAdmin,
  readState: uid => (uid === 'ana' ? { lang: 'es' } : null),
  sendPush: async (uid, payload) => { pushes.push({ uid, ...payload }); }
});
async function call(key, { as, body, url } = {}) {
  const req = { as, body, url: url || '/' }, res = {};
  await routes[key](req, res);
  return res;
}
const send = (to, text) => call('POST /api/trainer/messages', { as: 'coach', body: { to, text } });
const inbox = (as, after) => call('GET /api/athlete/messages', { as, url: after ? '/?after=' + after : '/' });
const reply = (as, text) => call('POST /api/athlete/messages', { as, body: { text } });
const summary = () => call('GET /api/trainer/messages/summary', { as: 'coach' }).then(r => r.body.threads);

test('only the admin writes as trainer; an athlete only reaches their own thread', async () => {
  assert.equal((await call('POST /api/trainer/messages', { as: 'luis', body: { to: ['ana'], text: 'hola' } })).code, 403);
  assert.equal((await call('GET /api/trainer/messages', { as: 'luis', url: '/?id=ana' })).code, 403);
  assert.equal((await call('GET /api/trainer/messages/summary', { as: 'ana' })).code, 403);
  assert.equal((await inbox(null)).code, 401);
  assert.equal((await reply(null, 'x')).code, 401);
  assert.deepEqual((await inbox('ana')).body.msgs, [], 'refused calls wrote nothing');
});

test('validation: empty, too long, unknown or admin recipients', async () => {
  assert.equal((await send(['ana'], '   ')).code, 400);
  assert.equal((await send(['ana'], 'x'.repeat(2001))).code, 400);
  assert.equal((await send([], 'hola')).code, 400);
  assert.equal((await send(['nadie'], 'hola')).code, 404);
  assert.equal((await send(['coach'], 'hola')).code, 404);
  assert.equal((await reply('ana', '')).code, 400);
  assert.deepEqual((await inbox('ana')).body.msgs, []);
});

test('a message reaches only its athlete, trimmed, with a push in their language', async () => {
  pushes.length = 0;
  const r = await send(['ana'], '  Mañana entrenamos pierna 🦵  ');
  assert.equal(r.code, 200);
  const box = (await inbox('ana')).body;
  assert.equal(box.msgs.length, 1);
  assert.equal(box.msgs[0].text, 'Mañana entrenamos pierna 🦵');
  assert.equal(box.msgs[0].from, 'trainer');
  assert.equal(box.unread, 1);
  assert.deepEqual((await inbox('luis')).body.msgs, []);
  assert.deepEqual(pushes.map(p => [p.uid, p.title]), [['ana', 'Mensaje de tu entrenador']]);
});

test('the athlete answers, the trainer sees it unread until reading it', async () => {
  pushes.length = 0;
  await call('POST /api/athlete/messages/read', { as: 'ana' });
  assert.equal((await inbox('ana')).body.unread, 0);
  assert.equal((await reply('ana', 'Perfecto')).code, 200);
  assert.deepEqual(pushes.map(p => [p.uid, p.title]), [['coach', 'Mensaje de Ana']]);
  assert.equal((await summary()).ana.unread, 1);
  assert.equal((await summary()).ana.last.text, 'Perfecto');
  await call('POST /api/trainer/messages/read', { as: 'coach', body: { id: 'ana' } });
  assert.equal((await summary()).ana.unread, 0);
  assert.equal((await inbox('ana')).body.unread, 0, 'your own reply is never unread');
});

test('the after cursor returns only what is new', async () => {
  const all = (await call('GET /api/trainer/messages', { as: 'coach', url: '/?id=ana' })).body.msgs;
  assert.equal(all.length, 2);
  assert.ok(all[1].at > all[0].at);
  await send(['ana'], 'uno');
  await send(['ana'], 'dos');
  const fresh = (await inbox('ana', all[1].at)).body.msgs;
  assert.deepEqual(fresh.map(m => m.text), ['uno', 'dos'], 'two sends in the same ms are both returned');
});

test('broadcast goes to every active athlete, never to the trainer or a disabled account', async () => {
  pushes.length = 0;
  const r = await send('all', 'El gimnasio cierra el lunes');
  assert.deepEqual(r.body.sent.map(s => s.athlete).sort(), ['ana', 'luis']);
  assert.equal((await inbox('luis')).body.last.text, 'El gimnasio cierra el lunes');
  assert.deepEqual((await inbox('off')).body.msgs, []);
  assert.deepEqual(pushes.map(p => p.uid).sort(), ['ana', 'luis']);
});

test('a thread keeps the latest MAX_MSGS messages', async () => {
  for (let i = 0; i < MAX_MSGS + 5; i++) await reply('luis', 'm' + i);
  const msgs = (await call('GET /api/trainer/messages', { as: 'coach', url: '/?id=luis' })).body.msgs;
  assert.equal(msgs.length, MAX_MSGS);
  assert.equal(msgs[msgs.length - 1].text, 'm' + (MAX_MSGS + 4));
});
