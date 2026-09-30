import { describe, it, expect } from 'vitest'
import { schemeOf, buildSets, exLine, fmtScheme } from './history.js'
import { policyFor, nextPrescription, applyPrescription } from './progression.js'
import { buildPlanBundle } from './plan-share.js'
import { assignmentPayload, applyAssignments } from './trainer.js'

// EM Fitness: drop set ("serie descendente") — per-set reps and weights on a reps exercise.
const ROWS = [{ r: 10, w: 30 }, { r: 15, w: 20 }, { r: 20, w: 10 }]
const drop = (over = {}) => ({ id: '0001', sets: 3, mode: 'reps', reps: 10, weight: 30, scheme: ROWS, ...over })
const state = (over = {}) => ({ unit: 'kg', exWeights: {}, workouts: [], customEx: [], routines: [], week: {}, ...over })

describe('schemeOf', () => {
  it('reads a valid scheme and ignores it everywhere else', () => {
    expect(schemeOf(drop())).toEqual(ROWS)
    expect(schemeOf({ id: '0001', sets: 3, reps: 10 })).toBeNull()
    expect(schemeOf(drop({ mode: 'time' }))).toBeNull()
    expect(schemeOf(null)).toBeNull()
  })

  it('never trusts a scheme from a file: bad rows out, fewer than 2 means none, at most 10', () => {
    expect(schemeOf(drop({ scheme: [{ r: 10, w: 30 }] }))).toBeNull()
    expect(schemeOf(drop({ scheme: [{ r: 10, w: 30 }, { r: 0, w: 5 }, { r: 'x', w: 1 }, null] }))).toBeNull()
    expect(schemeOf(drop({ scheme: [{ r: 10.4, w: 30 }, { r: 12, w: -2 }, { r: 12, w: 0 }] }))).toEqual([{ r: 10, w: 30 }, { r: 12, w: 0 }])
    expect(schemeOf(drop({ scheme: Array(14).fill({ r: 5, w: 5 }) }))).toHaveLength(10)
    expect(schemeOf(drop({ scheme: 'nope' }))).toBeNull()
  })
})

describe('drop set in a workout', () => {
  it('starts each set with its own reps and weight', () => {
    expect(buildSets(state(), drop())).toEqual(ROWS.map(s => ({ w: s.w, r: s.r, done: false })))
  })

  it('is not flattened by last time’s sets or the remembered top weight', () => {
    const S = state({
      exWeights: { '0001': { w: 50 } },
      workouts: [{ d: '2026-09-01', entries: [{ id: '0001', sets: [{ w: 40, r: 8, done: true }, { w: 40, r: 8, done: true }, { w: 40, r: 8, done: true }] }] }]
    })
    expect(buildSets(S, drop()).map(s => [s.r, s.w])).toEqual([[10, 30], [15, 20], [20, 10]])
  })

  it('gets no automatic progression, whatever the routine says', () => {
    expect(policyFor(drop(), { prog: 'linear' })).toBe('off')
    expect(policyFor(drop({ prog: 'double' }))).toBe('off')
    const p = nextPrescription(state(), drop(), { prog: 'linear' })
    expect(p.kind).toBe('off')
    const sets = buildSets(state(), drop())
    expect(applyPrescription(sets, p)).toEqual(sets)
  })
})

describe('drop set on screen and in plans', () => {
  it('is summarised set by set', () => {
    expect(exLine(drop(), 'kg')).toBe('10 × 30 → 15 × 20 → 20 × 10 kg')
    expect(fmtScheme([{ r: 12, w: 0 }, { r: 15, w: 0 }], 'kg')).toBe('12 → 15')
    expect(exLine({ id: '0001', sets: 3, reps: 10, weight: 30 }, 'kg')).toBe('3 × 10 · 30 kg')
  })

  it('travels in a shared plan and in a trainer assignment to the athlete', () => {
    const S = state({ routines: [{ id: 'r1', name: 'Tren superior', emoji: 'figureStrength', ex: [drop()] }] })
    const bundle = buildPlanBundle(S)
    expect(bundle.routines[0].ex[0].scheme).toEqual(ROWS)
    const p = assignmentPayload(S, 'r1')
    expect(p.routine.ex[0].scheme).toEqual(ROWS)
    const athlete = state()
    applyAssignments(athlete, [{ rid: 'r1', rev: 1, at: 1, days: [1], routine: p.routine, customEx: [] }])
    const ex = athlete.routines.find(r => r.fromTrainer).ex[0]
    expect(schemeOf(ex)).toEqual(ROWS)
    expect(buildSets(athlete, ex).map(s => s.w)).toEqual([30, 20, 10])
  })
})

import { plannedSet, deviations } from './history.js'
describe('prescribed vs done', () => {
  it('plannedSet reads straight sets, drop sets and nothing', () => {
    expect(plannedSet({ id: '0001', sets: 3, reps: 10, weight: 40 }, 2)).toEqual({ w: 40, r: 10 })
    expect(plannedSet(drop(), 1)).toEqual({ w: 20, r: 15 })
    expect(plannedSet(drop(), 5)).toBeNull()
    expect(plannedSet(null, 0)).toBeNull()
    expect(plannedSet({ id: '0001', mode: 'time', sets: 3, sec: 45 }, 0)).toBeNull()
  })
  it('deviations lists only done sets that differ', () => {
    const entry = { target: drop(), sets: [{ w: 30, r: 10, done: true }, { w: 17.5, r: 15, done: true }, { w: 10, r: 18, done: true }] }
    expect(deviations(entry).map(d => d.i)).toEqual([1, 2])
    expect(deviations({ target: drop(), sets: [{ w: 25, r: 10, done: false }] })).toEqual([])
    expect(deviations({ target: { id: '0001', reps: 12, weight: 0 }, sets: [{ w: 5, r: 12, done: true }] })).toEqual([])
  })
})
