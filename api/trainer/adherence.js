/* Adherence on the server — a copy of frontend/src/lib/adherence.js (D16) for the trainer
 * dashboard, which reads the athletes' state files. Tiny pure helpers, duplicated rather than
 * shared across the two runtimes, like effectiveRoutineId in server.js. Keep them in step.
 *
 *   planned  a day with a routine (weekly schedule + one-off day changes)
 *   done     a day with a workout that completed at least SUCCESS of its sets
 * Counted per calendar week (Mon–Sun), capped at what was planned.
 */
export const SUCCESS = 0.75;

const parse = iso => new Date(iso + 'T12:00:00Z');
const iso = d => d.toISOString().slice(0, 10);
export const addDays = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
export function weekStart(s) { const d = parse(s); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return iso(d); }
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);

export function effectiveRoutineId(S, day) {
  const ov = S.dayPlan?.[day];
  if (ov === 'rest') return null;
  if (ov && (S.routines || []).some(r => r.id === ov)) return ov;
  return S.week?.[parse(day).getUTCDay()] || null;
}

export function workoutOk(w) {
  if (!w || !Array.isArray(w.entries)) return false;
  let done = 0, kept = 0;
  for (const e of w.entries) for (const s of e.sets || []) { kept++; if (s.done) done++; }
  const planned = w.setsPlanned > 0 ? w.setsPlanned : kept;
  return planned > 0 && done / planned >= SUCCESS;
}

/** Adherence between two ISO dates (both included), starting no earlier than `since`. */
export function adherence(S, from, to, since) {
  const start = since && since > from ? since : from;
  if (start > to) return { planned: 0, done: 0, rate: null };
  const okDays = new Set((S.workouts || []).filter(w => w.d >= start && w.d <= to && workoutOk(w)).map(w => w.d));
  const weeks = new Map();
  for (let d = start; d <= to; d = addDays(d, 1)) {
    const k = weekStart(d);
    if (!weeks.has(k)) weeks.set(k, { planned: 0, done: 0 });
    const wk = weeks.get(k);
    if (effectiveRoutineId(S, d)) wk.planned++;
    if (okDays.has(d)) wk.done++;
  }
  let planned = 0, done = 0;
  for (const w of weeks.values()) { planned += w.planned; done += Math.min(w.done, w.planned); }
  return { planned, done, rate: planned ? done / planned : null };
}

/** What set `i` of a reps exercise was prescribed ({ w, r }) — straight sets or a drop set. */
export function plannedSet(target, i) {
  if (!target || (target.mode && target.mode !== 'reps')) return null;
  if (Array.isArray(target.scheme) && target.scheme.length >= 2) {
    const row = target.scheme[i];
    return row && row.r >= 1 ? { w: +row.w || 0, r: Math.round(row.r) } : null;
  }
  return target.reps > 0 ? { w: target.weight || 0, r: target.reps } : null;
}
