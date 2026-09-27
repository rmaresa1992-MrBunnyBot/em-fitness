// EM Fitness: routines the trainer assigns.
//
// The trainer builds routines in their own plan with the normal editor, then assigns one to
// athletes and weekdays (api/trainer/). Each athlete's app pulls its assignments and applies
// them here, straight into the state — no accept step, the trainer's word goes (D4).
//
// An applied routine keeps `fromTrainer` = the trainer's routine id, which is how a later
// revision finds and replaces it. Its local id never changes, so the workouts already logged
// against it stay attached. `S.trainer.applied` remembers the revision applied per routine,
// which makes applying the same list twice a no-op on every device the state syncs to.

import { buildPlanBundle, parsePlan } from './plan-share.js'
import { uid } from './format.js'

/** What the trainer's app sends for one of their own routines. */
export function assignmentPayload(S, routineId) {
  const r = (S.routines || []).find(x => x.id === routineId)
  if (!r) return null
  const bundle = buildPlanBundle({ ...S, routines: [r], week: {} })
  const routine = bundle.routines[0]
  return { routine: { ...routine, name: routine.name || 'Rutina' }, customEx: bundle.customEx }
}

// Same rule as plan-share mergePlan: reuse the athlete's custom exercise with the same name and
// body part, otherwise add it with a fresh id. Returns trainer id -> athlete id.
function mapCustoms(s, customEx) {
  const map = {}
  customEx.forEach(c => {
    const same = s.customEx.find(x => (x.n || '').toLowerCase() === (c.n || '').toLowerCase() && x.bp === c.bp)
    if (same) { map[c.id] = same.id; return }
    const nid = uid()
    map[c.id] = nid
    s.customEx.push({ id: nid, n: c.n, bp: c.bp, ...(c.desc ? { desc: c.desc } : {}) })
  })
  return map
}

/**
 * Apply the athlete's assignment list to a draft state `s` (call inside store.update).
 * Returns how many routines were added, replaced or removed.
 */
export function applyAssignments(s, list) {
  s.trainer = s.trainer || {}
  const applied = s.trainer.applied = s.trainer.applied || {}
  s.routines = s.routines || []
  s.week = s.week || {}
  s.customEx = s.customEx || []

  // Oldest first, so when two assignments claim the same weekday the newest one ends up on it.
  const todo = (Array.isArray(list) ? list : [])
    .filter(a => a && a.rid && applied[a.rid] !== a.rev)
    .sort((a, b) => (a.at || 0) - (b.at || 0))

  let changed = 0
  for (const a of todo) {
    let local = s.routines.find(r => r.fromTrainer === a.rid)
    // Release weekdays this routine held that the new version no longer wants — only while
    // they still point at it, so a day the athlete moved to something else stays theirs.
    const release = keep => {
      if (!local) return
      Object.keys(s.week).forEach(d => { if (s.week[d] === local.id && !keep.includes(+d)) delete s.week[d] })
    }

    if (a.removed) {
      if (local) { release([]); s.routines = s.routines.filter(r => r !== local); changed++ }
      applied[a.rid] = a.rev
      continue
    }

    let plan
    try { plan = parsePlan({ opengym_plan: 1, routines: [a.routine], customEx: a.customEx || [] }) }
    catch { continue }   // not a routine we can read — leave it unapplied rather than guess
    const r = plan.routines[0]
    if (!r) continue
    const exMap = mapCustoms(s, plan.customEx)
    const days = (a.days || []).filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
    const body = {
      name: r.name, emoji: r.emoji, ...(r.prog ? { prog: r.prog } : {}),
      ex: r.ex.map(e => ({ ...e, id: exMap[e.id] || e.id })),
      fromTrainer: a.rid
    }
    if (local) {
      release(days)
      Object.keys(local).forEach(k => { if (k !== 'id') delete local[k] })
      Object.assign(local, body)
    } else {
      local = { id: uid(), ...body }
      s.routines.push(local)
    }
    days.forEach(d => { s.week[d] = local.id })
    applied[a.rid] = a.rev
    changed++
  }
  return changed
}
