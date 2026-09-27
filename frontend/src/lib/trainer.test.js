import { describe, it, expect } from 'vitest'
import { applyAssignments, assignmentPayload } from './trainer.js'

const athlete = (over = {}) => ({
  customEx: [{ id: 'mine1', n: 'Band pull-apart', bp: 'shoulders' }],
  routines: [{ id: 'own', name: 'My own', ex: [{ id: '0002', sets: 3, reps: 8 }] }],
  week: { 0: 'own' },
  workouts: [],
  ...over
})
const asg = (over = {}) => ({
  rid: 'tr1', rev: 1, at: 1000, days: [1, 3],
  routine: { name: 'Push', emoji: '💪', ex: [{ id: '0001', sets: 3, reps: 10, weight: 20 }] },
  customEx: [],
  ...over
})
const fromTrainer = s => s.routines.filter(r => r.fromTrainer)

describe('applyAssignments', () => {
  it('adds the routine, schedules its days and leaves the athlete’s own plan alone', () => {
    const s = athlete()
    expect(applyAssignments(s, [asg()])).toBe(1)
    const [r] = fromTrainer(s)
    expect(r.name).toBe('Push')
    expect(r.id).not.toBe('tr1')
    expect(s.week[1]).toBe(r.id)
    expect(s.week[3]).toBe(r.id)
    expect(s.week[0]).toBe('own')
    expect(s.routines.find(x => x.id === 'own')).toBeTruthy()
    expect(s.trainer.applied.tr1).toBe(1)
  })

  it('applying the same list twice changes nothing the second time', () => {
    const s = athlete()
    applyAssignments(s, [asg()])
    const snap = JSON.stringify(s)
    expect(applyAssignments(s, [asg()])).toBe(0)
    expect(JSON.stringify(s)).toBe(snap)
  })

  it('a new revision replaces the routine in place, keeping its id for the workout history', () => {
    const s = athlete()
    applyAssignments(s, [asg()])
    const id = fromTrainer(s)[0].id
    s.workouts.push({ id: 'w1', routineId: id })
    applyAssignments(s, [asg({ rev: 2, at: 2000, days: [3, 5], routine: { name: 'Push v2', ex: [{ id: '0001', sets: 5, reps: 5 }] } })])
    const rs = fromTrainer(s)
    expect(rs).toHaveLength(1)
    expect(rs[0].id).toBe(id)
    expect(rs[0].name).toBe('Push v2')
    expect(rs[0].emoji).toBeUndefined()
    expect(rs[0].ex[0].sets).toBe(5)
    expect(s.week[1]).toBeUndefined()      // released
    expect(s.week[3]).toBe(id)
    expect(s.week[5]).toBe(id)
    expect(s.workouts[0].routineId).toBe(id)
  })

  it('does not release a day the athlete has since given to another routine', () => {
    const s = athlete()
    applyAssignments(s, [asg()])
    s.week[1] = 'own'
    applyAssignments(s, [asg({ rev: 2, days: [3] })])
    expect(s.week[1]).toBe('own')
  })

  it('a tombstone removes the routine and frees its days', () => {
    const s = athlete()
    applyAssignments(s, [asg()])
    expect(applyAssignments(s, [{ rid: 'tr1', rev: 2, at: 3000, removed: true }])).toBe(1)
    expect(fromTrainer(s)).toHaveLength(0)
    expect(s.week[1]).toBeUndefined()
    expect(s.week[3]).toBeUndefined()
    expect(s.week[0]).toBe('own')
    expect(s.trainer.applied.tr1).toBe(2)
  })

  it('a tombstone for something never applied is recorded and harmless', () => {
    const s = athlete()
    expect(applyAssignments(s, [{ rid: 'ghost', rev: 3, removed: true }])).toBe(0)
    expect(s.trainer.applied.ghost).toBe(3)
    expect(s.routines).toHaveLength(1)
  })

  it('when two assignments claim the same day, the newest wins regardless of list order', () => {
    const s = athlete()
    applyAssignments(s, [
      asg({ rid: 'b', at: 2000, days: [2], routine: { name: 'Newer', ex: [{ id: '0001', sets: 1 }] } }),
      asg({ rid: 'a', at: 1000, days: [2], routine: { name: 'Older', ex: [{ id: '0001', sets: 1 }] } })
    ])
    expect(s.routines.find(r => r.id === s.week[2]).name).toBe('Newer')
  })

  it('reuses the athlete’s custom exercise with the same name and body part, else adds it', () => {
    const s = athlete()
    applyAssignments(s, [asg({
      routine: { name: 'Shoulders', ex: [{ id: 'c1', sets: 3, reps: 15 }, { id: 'c2', sets: 2, reps: 12 }] },
      customEx: [{ id: 'c1', n: 'band PULL-APART', bp: 'shoulders' }, { id: 'c2', n: 'Face pull', bp: 'shoulders' }]
    })])
    const [r] = fromTrainer(s)
    expect(r.ex[0].id).toBe('mine1')
    expect(s.customEx).toHaveLength(2)
    expect(r.ex[1].id).toBe(s.customEx[1].id)
    expect(s.customEx[1].n).toBe('Face pull')
  })

  it('drops exercises that resolve nowhere instead of keeping an invisible one', () => {
    const s = athlete()
    applyAssignments(s, [asg({ routine: { name: 'X', ex: [{ id: '0001', sets: 1 }, { id: 'nope', sets: 1 }] } })])
    expect(fromTrainer(s)[0].ex.map(e => e.id)).toEqual(['0001'])
  })

  it('ignores out-of-range days and survives empty, null or junk input', () => {
    const s = athlete()
    applyAssignments(s, [asg({ days: [9, -1, 2.5, 4] })])
    expect(Object.keys(s.week).sort()).toEqual(['0', '4'])
    expect(applyAssignments(s, null)).toBe(0)
    expect(applyAssignments(s, [])).toBe(0)
    expect(applyAssignments(s, [null, {}, { rid: 'z', rev: 1 }])).toBe(0)
  })

  it('works on a brand-new state with nothing in it', () => {
    const s = {}
    expect(applyAssignments(s, [asg()])).toBe(1)
    expect(s.routines).toHaveLength(1)
  })
})

describe('assignmentPayload', () => {
  const trainer = {
    customEx: [{ id: 'c9', n: 'Sled push', bp: 'legs' }, { id: 'unused', n: 'Other', bp: 'back' }],
    routines: [{ id: 'r1', name: 'Legs', emoji: '🦵', ex: [{ id: '0001', sets: 3, reps: 10, mode: 'reps', weight: 40 }, { id: 'c9', sets: 2, reps: 20 }] }],
    week: { 1: 'r1' }
  }
  it('sends only that routine, cleaned, with the custom exercises it uses', () => {
    const p = assignmentPayload(trainer, 'r1')
    expect(p.routine.id).toBe('r1')
    expect(p.routine.ex).toHaveLength(2)
    expect(p.customEx.map(c => c.id)).toEqual(['c9'])
  })
  it('returns null for a routine that does not exist', () => {
    expect(assignmentPayload(trainer, 'nope')).toBeNull()
  })
  it('round-trips: what the trainer sends is what the athlete gets', () => {
    const p = assignmentPayload(trainer, 'r1')
    const { id, ...routine } = p.routine
    const s = {}
    applyAssignments(s, [{ rid: id, rev: 1, at: 1, days: [1], routine, customEx: p.customEx }])
    expect(s.routines[0].name).toBe('Legs')
    expect(s.routines[0].ex[0]).toMatchObject({ id: '0001', sets: 3, reps: 10, weight: 40 })
    expect(s.customEx[0].n).toBe('Sled push')
  })
})
