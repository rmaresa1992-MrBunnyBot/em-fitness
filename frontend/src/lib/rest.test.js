import { describe, it, expect } from 'vitest'
import { buildPlanBundle } from './plan-share.js'
import { assignmentPayload, applyAssignments } from './trainer.js'

// EM Fitness: rest between sets per exercise (`rest`, seconds) set by the trainer.
const S = (ex) => ({ unit: 'kg', exWeights: {}, workouts: [], customEx: [], week: {}, routines: [{ id: 'r1', name: 'Pierna', ex }] })

describe('rest per exercise', () => {
  it('travels in a plan and in an assignment, and reaches the athlete', () => {
    const st = S([{ id: '0001', sets: 3, reps: 10, rest: 120 }, { id: '0002', sets: 3, reps: 12 }])
    const ex = buildPlanBundle(st).routines[0].ex
    expect(ex[0].rest).toBe(120)
    expect('rest' in ex[1]).toBe(false)
    const p = assignmentPayload(st, 'r1')
    const athlete = S([])
    athlete.routines = []
    applyAssignments(athlete, [{ rid: 'r1', rev: 1, at: 1, days: [1], routine: p.routine, customEx: [] }])
    expect(athlete.routines.find(r => r.fromTrainer).ex[0].rest).toBe(120)
  })

  it('a zero or missing rest is not written', () => {
    expect('rest' in buildPlanBundle(S([{ id: '0001', sets: 3, reps: 10, rest: 0 }])).routines[0].ex[0]).toBe(false)
  })
})
