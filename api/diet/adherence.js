/* Diet adherence on the server — a copy of the log half of frontend/src/lib/diet.js for the
 * trainer's screens, which read the athletes' state files. Duplicated rather than shared across
 * the two runtimes, like trainer/adherence.js. Keep them in step.
 *
 *   S.dietLog[iso] = { v: 't'|'r', n: meals that day, m: { [mealId]: 'ok'|'half'|'skip' } }
 *   day score      Hecha 1 · A medias ½ · Saltada or unmarked 0, over the day's meals, max 1
 *   window         the 7 complete days before today, never before the diet was first sent
 */
import { addDays, effectiveRoutineId } from '../trainer/adherence.js';

export const WINDOW = 7;
export const SUCCESS = 0.75;
const SCORE = { ok: 1, half: 0.5, skip: 0 };

const localDay = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const hasRest = diet => !!diet?.rest?.meals?.length;
const mealCount = (diet, v) => (v === 'r' && hasRest(diet) ? diet.rest.meals : diet?.meals || []).length;

function dayVariant(S, diet, iso) {
  const v = S.dietLog?.[iso]?.v;
  if (v === 't' || (v === 'r' && hasRest(diet))) return v;
  return hasRest(diet) && !effectiveRoutineId(S, iso) ? 'r' : 't';
}

function dayScore(S, diet, iso) {
  const e = S.dietLog?.[iso];
  const n = e?.n || mealCount(diet, dayVariant(S, diet, iso));
  if (!n) return null;
  let sum = 0;
  for (const k of Object.values(e?.m || {})) sum += SCORE[k] ?? 0;
  return { d: iso, score: Math.min(1, sum / n), logged: !!e };
}

export function dietAdherence(S, diet, from, to) {
  const out = { rate: null, evaluated: 0, logged: 0, days: [] };
  if (!diet) return out;
  const firstAt = diet.since || diet.at;
  const since = firstAt ? localDay(firstAt) : null;
  const start = since && since > from ? since : from;
  let sum = 0;
  for (let d = start; d <= to; d = addDays(d, 1)) {
    const s = dayScore(S || {}, diet, d);
    if (!s) continue;
    out.days.push(s);
    sum += s.score;
    if (s.logged) out.logged++;
  }
  out.evaluated = out.days.length;
  out.rate = out.evaluated ? sum / out.evaluated : null;
  return out;
}

export const recentDietAdherence = (S, diet, today) => dietAdherence(S, diet, addDays(today, -WINDOW), addDays(today, -1));
