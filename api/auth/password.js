/* Username + password sign-in (EM Fitness). Upstream only has passkeys; gym members sign in
 * with what they already know, and the trainer hands out each account.
 *
 * scrypt from node:crypto, no dependency. Stored as `scrypt$N$r$p$salt$hash` so the cost can be
 * raised later without breaking the hashes already in db.json.
 */
import crypto from 'node:crypto';

const N = 16384, R = 8, P = 1, KEYLEN = 32;

export const USERNAME = /^[a-z0-9._-]{3,32}$/;
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 200;

/** Usernames compare lowercased and trimmed: "Ana.G " and "ana.g" are the same account. */
export const normUsername = s => String(s ?? '').trim().toLowerCase();

export function validPassword(pw) {
  return typeof pw === 'string' && pw.length >= MIN_PASSWORD && pw.length <= MAX_PASSWORD;
}

const scrypt = (pw, salt, n, r, p) => new Promise((resolve, reject) =>
  crypto.scrypt(pw, salt, KEYLEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? reject(e) : resolve(k))));

export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, N, R, P);
  return ['scrypt', N, R, P, salt.toString('base64url'), key.toString('base64url')].join('$');
}

// Verified against when the username doesn't exist, so a miss costs the same time as a wrong
// password and the response time doesn't say which usernames are real.
const DUMMY = hashPassword(crypto.randomBytes(12).toString('hex'));

/** True only for the right password. A missing or malformed hash is just false. */
export async function verifyPassword(pw, stored) {
  if (typeof pw !== 'string' || pw.length > MAX_PASSWORD) return false;
  const parts = String(stored || await DUMMY).split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, hash] = parts;
  const want = Buffer.from(hash, 'base64url');
  let got;
  try { got = await scrypt(pw, Buffer.from(salt, 'base64url'), +n, +r, +p); } catch { return false; }
  return got.length === want.length && crypto.timingSafeEqual(got, want) && !!stored;
}

/**
 * Failed-attempt limiter, in memory. The API has no rate limiting of its own (upstream leaves
 * that to the reverse proxy) and a password, unlike a passkey, can be guessed. Keyed by caller
 * address + username, so someone hammering one account doesn't lock its owner out from another
 * address. Resets on restart, which is fine for slowing a guesser down.
 */
export function createLimiter({ max = 5, windowMs = 15 * 60000 } = {}) {
  const fails = new Map();   // key -> { n, until }
  const live = key => {
    const f = fails.get(key);
    if (f && f.until < Date.now()) { fails.delete(key); return null; }
    return f;
  };
  const timer = setInterval(() => { for (const k of fails.keys()) live(k); }, 60000);
  timer.unref?.();
  return {
    blocked: key => (live(key)?.n || 0) >= max,
    fail: key => { const f = live(key) || { n: 0 }; fails.set(key, { n: f.n + 1, until: Date.now() + windowMs }); },
    reset: key => fails.delete(key)
  };
}
