/* Username + password accounts (EM Fitness). The trainer creates each athlete's account and
 * hands out the first password; the athlete can change it. Passkeys keep working alongside —
 * an account can have both. Same factory shape as the other route modules; server.js hands in
 * its helpers because users and sessions are closures over db.json and the secret.
 *
 * User fields added here: `username` (lowercase, unique) and `pw` (scrypt hash, never sent out).
 */
import crypto from 'node:crypto';
import { z } from 'zod';
import { USERNAME, MIN_PASSWORD, MAX_PASSWORD, normUsername, hashPassword, verifyPassword, createLimiter } from './password.js';

const Username = z.string().transform(normUsername).pipe(z.string().regex(USERNAME));
const Password = z.string().min(MIN_PASSWORD).max(MAX_PASSWORD);
const NewAthlete = z.object({ name: z.string().trim().min(1).max(40), username: Username, password: Password });
const Credentials = z.object({ id: z.string().min(1).max(40), username: Username.optional(), password: Password.optional() });

// Behind the bundled nginx X-Real-IP is set by the proxy itself; straight to the API it is
// whatever the caller says, which only means they pick their own limiter bucket.
const callerAddress = req => String(req.headers?.['x-real-ip'] || req.socket?.remoteAddress || '');

export function authRoutes({ json, readBody, readSession, requireAdmin, users, saveDb, sessionCookie, isAdmin, publicUser, limiter = createLimiter() }) {
  const byUsername = name => users().find(u => u.username === name);
  const taken = (name, exceptId) => users().some(u => u.username === name && u.id !== exceptId);
  // Bumping the session version signs the account out everywhere (see server.js sessionVersion).
  const revokeSessions = u => { u.sv = (u.sv || 0) + 1; };

  return {
    // `role` is the door the person came in through. The trainer's door only lets the trainer
    // in; the athlete's door lets anyone in, and the app sends the trainer on to the panel.
    'POST /api/login/password': async (req, res) => {
      const body = await readBody(req);
      const username = normUsername(body.username);
      const key = callerAddress(req) + '|' + username;
      if (limiter.blocked(key)) return json(res, 429, { error: 'too many attempts — wait a few minutes' });
      const user = byUsername(username);
      // Always verify, even with no such user (against a dummy hash) — same time either way.
      const ok = await verifyPassword(String(body.password ?? ''), user?.pw);
      if (!user || !ok) { limiter.fail(key); return json(res, 401, { error: 'wrong username or password' }); }
      limiter.reset(key);
      if (user.disabled) return json(res, 403, { error: 'this account has been disabled' });
      if (body.role === 'trainer' && !isAdmin(user)) return json(res, 403, { error: 'this is not a trainer account' });
      json(res, 200, { user: publicUser(user) }, { 'Set-Cookie': sessionCookie(user) });
    },

    'POST /api/account/password': async (req, res) => {
      const user = readSession(req);
      if (!user) return json(res, 401, { error: 'not signed in' });
      const body = await readBody(req);
      if (!Password.safeParse(body.next).success) return json(res, 400, { error: 'the password needs at least 8 characters' });
      // An account made with a passkey has no password yet; setting the first one needs none.
      if (user.pw && !(await verifyPassword(String(body.current ?? ''), user.pw)))
        return json(res, 403, { error: 'the current password is wrong' });
      user.pw = await hashPassword(body.next);
      revokeSessions(user);
      saveDb();
      // Every other device is signed out; this one gets a fresh cookie on the new version.
      json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(user) });
    },

    'POST /api/admin/athletes/new': async (req, res) => {
      const admin = requireAdmin(req, res); if (!admin) return;
      const parsed = NewAthlete.safeParse(await readBody(req));
      if (!parsed.success) return json(res, 400, { error: 'invalid account', issues: parsed.error.issues.map(i => i.path.join('.')) });
      const { name, username, password } = parsed.data;
      if (taken(username)) return json(res, 409, { error: 'that username is taken' });
      const user = {
        id: crypto.randomBytes(12).toString('base64url'), name, username,
        pw: await hashPassword(password), created: new Date().toISOString(), createdBy: admin.id
      };
      // Checked again after the await: two creates racing for one username must not both land.
      if (taken(username)) return json(res, 409, { error: 'that username is taken' });
      users().push(user);
      saveDb();
      json(res, 200, { user: publicUser(user) });
    },

    // Give an existing account a username and/or a new password (a passkey athlete who wants
    // one, or someone who forgot theirs). A new password signs them out everywhere.
    'POST /api/admin/user/credentials': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const parsed = Credentials.safeParse(await readBody(req));
      if (!parsed.success) return json(res, 400, { error: 'invalid account', issues: parsed.error.issues.map(i => i.path.join('.')) });
      const { id, username, password } = parsed.data;
      const u = users().find(x => x.id === id);
      if (!u) return json(res, 404, { error: 'no such user' });
      if (username && taken(username, u.id)) return json(res, 409, { error: 'that username is taken' });
      if (!u.username && !username) return json(res, 400, { error: 'a username is required' });
      const pw = password ? await hashPassword(password) : null;
      if (username && taken(username, u.id)) return json(res, 409, { error: 'that username is taken' });   // raced during the hash
      if (username) u.username = username;
      if (pw) { u.pw = pw; revokeSessions(u); }
      saveDb();
      json(res, 200, { user: publicUser(u) });
    }
  };
}
