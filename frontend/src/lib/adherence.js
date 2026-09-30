// EM Fitness: adherence — planned sessions against sessions done (D16).
//
// The common core of three things: the athlete's indicator on Inicio, the trainer's dashboard
// and the capybara. Pure functions of the state, like progression.js: nothing is stored, so a
// corrected workout or a changed schedule gives the right number immediately.
//
//   planned  a day that has a routine (the weekly schedule plus one-off day changes)
//   done     a day with a workout that completed at least SUCCESS of its sets
//
// Counted per calendar week (Mon–Sun) and capped at what was planned: a session made up on a
// rest day of the same week covers a missed one, and a double session doesn't count twice.
// Past weeks are read against today's schedule — the app keeps no history of the plan itself.
import { effectiveRoutineId } from './history.js'
import { isoOf, weekKey } from './format.js'

export const SUCCESS = 0.75

const dayMs = 86400000
const parse = iso => new Date(iso + 'T12:00:00')
const addDays = (iso, n) => { const d = parse(iso); d.setDate(d.getDate() + n); return isoOf(d) }

/** Monday of the week that contains `iso`. */
export function weekStart(iso) {
  const d = parse(iso)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return isoOf(d)
}

/**
 * Did this finished workout count? Workouts record `setsPlanned` since EM Fitness fase 4;
 * older ones only kept the exercises with a set done, so they are judged on what they kept.
 */
export function workoutOk(w) {
  if (!w || !Array.isArray(w.entries)) return false
  let done = 0, kept = 0
  for (const e of w.entries) for (const s of e.sets || []) { kept++; if (s.done) done++ }
  const planned = w.setsPlanned > 0 ? w.setsPlanned : kept
  return planned > 0 && done / planned >= SUCCESS
}

/**
 * Adherence between two ISO dates, both included. `since` (optional) moves the start forward —
 * days before an athlete had a plan are not misses. rate is null when nothing was planned.
 */
export function adherence(S, from, to, since) {
  const start = since && since > from ? since : from
  if (start > to) return { planned: 0, done: 0, rate: null, weeks: [] }
  const okDays = new Set((S.workouts || []).filter(w => w.d >= start && w.d <= to && workoutOk(w)).map(w => w.d))
  const weeks = new Map()   // weekKey -> { start, planned, done }
  for (let d = start; d <= to; d = addDays(d, 1)) {
    const k = weekKey(d)
    if (!weeks.has(k)) weeks.set(k, { start: weekStart(d), planned: 0, done: 0 })
    const wk = weeks.get(k)
    if (effectiveRoutineId(S, d)) wk.planned++
    if (okDays.has(d)) wk.done++
  }
  let planned = 0, done = 0
  const list = [...weeks.values()].map(w => ({ ...w, done: Math.min(w.done, w.planned) }))
  for (const w of list) { planned += w.planned; done += w.done }
  return { planned, done, rate: planned ? done / planned : null, weeks: list }
}

/** The whole calendar week that contains `iso` (Mon–Sun), including days still ahead. */
export function weekAdherence(S, iso, since) {
  const start = weekStart(iso)
  return adherence(S, start, addDays(start, 6), since)
}

/** Days since the last workout that counted, or null if there is none. */
export function daysSinceLastOk(S, iso) {
  const last = (S.workouts || []).filter(w => w.d <= iso && workoutOk(w)).map(w => w.d).sort().pop()
  return last ? Math.round((parse(iso) - parse(last)) / dayMs) : null
}
