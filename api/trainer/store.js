/* What the trainer has assigned to each athlete — one file per athlete under data/trainer/.
 *
 * Kept outside state-<uid>.json on purpose: the client uploads its whole state and the newest
 * _ts wins, so anything the server wrote into that file would be overwritten by the athlete's
 * next sync. The athlete's app pulls from here and applies it locally instead (the same reason
 * and the same shape of solution as coach/jobs.js).
 *
 * One assignment per trainer routine (`rid`). Re-assigning bumps `rev` and replaces it;
 * withdrawing leaves a tombstone (`removed: true`) so a device that was offline still learns
 * to drop the routine.
 */
import fs from 'node:fs';
import path from 'node:path';

const DATA = process.env.DATA_DIR || '/data';
const DIR = path.join(DATA, 'trainer');

const safe = uid => String(uid).replace(/[^a-zA-Z0-9_-]/g, '');
const file = uid => path.join(DIR, safe(uid) + '.json');

export function read(uid) {
  try {
    const rec = JSON.parse(fs.readFileSync(file(uid), 'utf8'));
    return { assignments: Array.isArray(rec.assignments) ? rec.assignments : [] };
  } catch { return { assignments: [] }; }
}

function write(uid, rec) {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  const f = file(uid), tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(rec), { mode: 0o600 });
  fs.renameSync(tmp, f);
}

/** Create or replace the assignment of routine `rid`. Returns the stored assignment. */
export function upsert(uid, { rid, routine, customEx, days }) {
  const rec = read(uid);
  const prev = rec.assignments.find(a => a.rid === rid);
  // `since` is when this routine was first given to the athlete and survives re-assigning (which
  // renews `at`), so the trainer dashboard measures adherence from the real start.
  const now = Date.now();
  const since = prev && !prev.removed ? (prev.since || prev.at) : now;
  const next = { rid, rev: (prev?.rev || 0) + 1, at: now, since, days, routine, customEx };
  rec.assignments = [...rec.assignments.filter(a => a.rid !== rid), next];
  write(uid, rec);
  return next;
}

/** Withdraw routine `rid`. Returns false when there was nothing live to withdraw. */
export function remove(uid, rid) {
  const rec = read(uid);
  const prev = rec.assignments.find(a => a.rid === rid);
  if (!prev || prev.removed) return false;
  const tomb = { rid, rev: prev.rev + 1, at: Date.now(), removed: true };
  rec.assignments = [...rec.assignments.filter(a => a.rid !== rid), tomb];
  write(uid, rec);
  return true;
}

export const live = uid => read(uid).assignments.filter(a => !a.removed);
