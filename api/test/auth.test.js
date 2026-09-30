/* Username + password accounts: hashing, the two doors, the attempt limiter, the trainer
   creating and resetting accounts, and an athlete changing their own password. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData } from './helpers.mjs';

tempData();
const { hashPassword, verifyPassword, normUsername, createLimiter } = await import('../auth/password.js');
const { authRoutes } = await import('../auth/routes.js');

const USERS = [];
let saves = 0;
const isAdmin = u => !!u?.admin;
const publicUser = u => ({ id: u.id, name: u.name, admin: isAdmin(u), ...(u.username ? { username: u.username } : {}) });
const routes = authRoutes({
  json: (res, code, body, headers) => { res.code = code; res.body = body; res.headers = headers || {}; },
  readBody: async req => req.body || {},
  readSession: req => USERS.find(u => u.id === req.as) || null,
  requireAdmin: (req, res) => {
    const u = USERS.find(x => x.id === req.as);
    if (!u) { res.code = 401; return null; }
    if (!u.admin) { res.code = 403; return null; }
    return u;
  },
  users: () => USERS,
  saveDb: () => { saves++; },
  sessionCookie: u => 'gymsid=' + u.id + ':' + (u.sv || 0),
  isAdmin, publicUser,
  limiter: createLimiter({ max: 3, windowMs: 60000 })
});
async function call(key, { as, body, ip = '1.1.1.1' } = {}) {
  const req = { as, body, headers: { 'x-real-ip': ip } }, res = {};
  await routes[key](req, res);
  return res;
}
const login = (username, password, role = 'athlete', ip) => call('POST /api/login/password', { body: { username, password, role }, ip });

test('hashes verify only the right password and never store it', async () => {
  const h = await hashPassword('correcto-123');
  assert.match(h, /^scrypt\$16384\$8\$1\$/);
  assert.ok(!h.includes('correcto'));
  assert.equal(await verifyPassword('correcto-123', h), true);
  assert.equal(await verifyPassword('Correcto-123', h), false);
  assert.equal(await verifyPassword('', h), false);
  assert.equal(await verifyPassword('correcto-123', undefined), false, 'no hash, no entry');
  assert.equal(await verifyPassword('correcto-123', 'garbage'), false);
  assert.notEqual(await hashPassword('correcto-123'), h, 'salted');
  assert.equal(normUsername('  Ana.G '), 'ana.g');
});

test('the trainer account for the rest of the tests', async () => {
  USERS.push({ id: 'coach', name: 'Coach', admin: true, username: 'coach', pw: await hashPassword('entrenador-1') });
  assert.equal((await login('coach', 'entrenador-1', 'trainer')).code, 200);
});

test('only the admin creates accounts, and the input is checked', async () => {
  const mk = (as, body) => call('POST /api/admin/athletes/new', { as, body });
  assert.equal((await mk(null, { name: 'Ana', username: 'ana', password: 'secreto-1' })).code, 401);
  assert.equal((await mk('coach', { name: 'Ana', username: 'a', password: 'secreto-1' })).code, 400, 'username too short');
  assert.equal((await mk('coach', { name: 'Ana', username: 'ana maría', password: 'secreto-1' })).code, 400, 'no spaces');
  assert.equal((await mk('coach', { name: 'Ana', username: 'ana', password: 'corta' })).code, 400, 'password too short');
  assert.equal((await mk('coach', { name: '  ', username: 'ana', password: 'secreto-1' })).code, 400, 'name required');
  const r = await mk('coach', { name: 'Ana', username: '  ANA ', password: 'secreto-1' });
  assert.equal(r.code, 200);
  assert.equal(r.body.user.username, 'ana');
  assert.equal(r.body.user.pw, undefined, 'the hash never leaves the server');
  assert.equal((await mk('coach', { name: 'Otra', username: 'Ana', password: 'secreto-2' })).code, 409);
  assert.equal((await mk('ana-id-not-admin', { name: 'X', username: 'xx1', password: 'secreto-1' })).code, 401);
  const ana = USERS.find(u => u.username === 'ana');
  assert.equal((await mk(ana.id, { name: 'X', username: 'xx1', password: 'secreto-1' })).code, 403);
});

test('the athlete door lets anyone in; the trainer door only the trainer', async () => {
  const r = await login('Ana', 'secreto-1');
  assert.equal(r.code, 200);
  assert.equal(r.body.user.admin, false);
  assert.match(r.headers['Set-Cookie'], /^gymsid=/);
  assert.equal((await login('ana', 'secreto-1', 'trainer')).code, 403);
  const c = await login('coach', 'entrenador-1', 'athlete');
  assert.equal(c.code, 200, 'the trainer can use either door');
  assert.equal(c.body.user.admin, true);
});

test('a wrong password and an unknown user get the same answer', async () => {
  const a = await login('ana', 'nope-nope', 'athlete', '2.2.2.2');
  const b = await login('nadie', 'nope-nope', 'athlete', '2.2.2.2');
  assert.equal(a.code, 401);
  assert.deepEqual(a.body, b.body);
});

test('the limiter locks one address + username after repeated failures', async () => {
  for (let i = 0; i < 3; i++) assert.equal((await login('ana', 'mala-' + i, 'athlete', '3.3.3.3')).code, 401);
  assert.equal((await login('ana', 'secreto-1', 'athlete', '3.3.3.3')).code, 429, 'even the right password waits');
  assert.equal((await login('ana', 'secreto-1', 'athlete', '4.4.4.4')).code, 200, 'the owner elsewhere is not locked out');
});

test('a disabled account is refused after the password check', async () => {
  const ana = USERS.find(u => u.username === 'ana');
  ana.disabled = true;
  assert.equal((await login('ana', 'secreto-1', 'athlete', '5.5.5.5')).code, 403);
  assert.equal((await login('ana', 'wrong-pass', 'athlete', '5.5.5.5')).code, 401, 'no hint without the password');
  ana.disabled = false;
});

test('changing your own password needs the current one and signs out other devices', async () => {
  const ana = USERS.find(u => u.username === 'ana');
  const change = body => call('POST /api/account/password', { as: ana.id, body });
  assert.equal((await change({ current: 'mal', next: 'nuevo-secreto' })).code, 403);
  assert.equal((await change({ current: 'secreto-1', next: 'corta' })).code, 400);
  const sv = ana.sv || 0;
  const r = await change({ current: 'secreto-1', next: 'nuevo-secreto' });
  assert.equal(r.code, 200);
  assert.equal(ana.sv, sv + 1);
  assert.equal(r.headers['Set-Cookie'], 'gymsid=' + ana.id + ':' + ana.sv, 'fresh cookie on the new version');
  assert.equal((await login('ana', 'secreto-1', 'athlete', '6.6.6.6')).code, 401);
  assert.equal((await login('ana', 'nuevo-secreto', 'athlete', '6.6.6.6')).code, 200);
  assert.equal((await call('POST /api/account/password', { body: { next: 'x'.repeat(9) } })).code, 401);
});

test('a passkey account sets its first password without a current one', async () => {
  USERS.push({ id: 'pk', name: 'Pk', username: 'pk' });
  const r = await call('POST /api/account/password', { as: 'pk', body: { next: 'primera-clave' } });
  assert.equal(r.code, 200);
  assert.equal((await login('pk', 'primera-clave', 'athlete', '7.7.7.7')).code, 200);
});

test('the trainer resets a password or gives a passkey account a username', async () => {
  const set = body => call('POST /api/admin/user/credentials', { as: 'coach', body });
  USERS.push({ id: 'old', name: 'Old' });
  assert.equal((await set({ id: 'old', password: 'algo-seguro' })).code, 400, 'a username first');
  assert.equal((await set({ id: 'old', username: 'ana', password: 'algo-seguro' })).code, 409);
  assert.equal((await set({ id: 'nadie', username: 'zz9' })).code, 404);
  const r = await set({ id: 'old', username: 'Old.User', password: 'algo-seguro' });
  assert.equal(r.code, 200);
  assert.equal(r.body.user.username, 'old.user');
  assert.equal((await login('old.user', 'algo-seguro', 'athlete', '8.8.8.8')).code, 200);
  const ana = USERS.find(u => u.username === 'ana');
  const sv = ana.sv;
  assert.equal((await set({ id: ana.id, password: 'reseteada-1' })).code, 200);
  assert.equal(ana.sv, sv + 1, 'a reset signs the athlete out everywhere');
  assert.equal((await set({ id: ana.id, username: 'ana' })).code, 200, 'keeping your own username is not a clash');
  assert.equal((await call('POST /api/admin/user/credentials', { as: ana.id, body: { id: 'old', password: 'hackeada-1' } })).code, 403);
  assert.ok(saves > 0);
});
