import { describe, it, expect } from 'vitest'
import { adherence, weekAdherence, workoutOk, weekStart, daysSinceLastOk } from './adherence.js'

// Week of Monday 2026-09-28. Routine on Mon, Wed, Fri, Sat (4 days).
const R = { id: 'r', name: 'Tren superior', ex: [{ id: '0001', sets: 4, reps: 10 }] }
const sets = (done, total = 4) => Array.from({ length: total }, (_, i) => ({ w: 20, r: 10, done: i < done }))
const wo = (d, done = 4, total = 4, extra = {}) => ({ id: d + done, d, entries: [{ id: '0001', sets: sets(done, total) }], ...extra })
const state = (workouts = [], over = {}) => ({ routines: [R], week: { 1: 'r', 3: 'r', 5: 'r', 6: 'r' }, dayPlan: {}, workouts, ...over })

describe('workoutOk', () => {
  it('needs 75 % of the sets, exactly at the edge included', () => {
    expect(workoutOk(wo('2026-09-28', 3, 4))).toBe(true)
    expect(workoutOk(wo('2026-09-28', 2, 4))).toBe(false)
    expect(workoutOk(wo('2026-09-28', 0, 4))).toBe(false)
    expect(workoutOk({ d: '2026-09-28', entries: [] })).toBe(false)
    expect(workoutOk(null)).toBe(false)
  })

  it('judges against the sets planned when the workout recorded them', () => {
    // 3 sets kept (all done) out of 8 planned: exercises with nothing done were dropped.
    expect(workoutOk(wo('2026-09-28', 3, 3, { setsPlanned: 8 }))).toBe(false)
    expect(workoutOk(wo('2026-09-28', 6, 6, { setsPlanned: 8 }))).toBe(true)
  })
})

describe('adherence', () => {
  it('a full week is 4/4', () => {
    const S = state(['2026-09-28', '2026-09-30', '2026-10-02', '2026-10-03'].map(d => wo(d)))
    expect(weekAdherence(S, '2026-09-30')).toMatchObject({ planned: 4, done: 4, rate: 1 })
  })

  it('missing a day is 3/4 = 75 %', () => {
    const S = state(['2026-09-28', '2026-09-30', '2026-10-02'].map(d => wo(d)))
    expect(weekAdherence(S, '2026-10-04')).toMatchObject({ planned: 4, done: 3, rate: 0.75 })
  })

  it('a workout below 75 % does not count', () => {
    const S = state([wo('2026-09-28', 2)])
    expect(weekAdherence(S, '2026-09-28').done).toBe(0)
  })

  it('a session made up on a rest day covers a miss, but never beyond what was planned', () => {
    const S = state(['2026-09-29', '2026-10-01', '2026-10-04', '2026-09-28', '2026-09-30'].map(d => wo(d)))
    expect(weekAdherence(S, '2026-09-28')).toMatchObject({ planned: 4, done: 4 })
    const double = state([wo('2026-09-28'), { ...wo('2026-09-28'), id: 'b' }])
    expect(weekAdherence(double, '2026-09-28').done).toBe(1)
  })

  it('a day change moves the plan: rest on Monday, routine on Tuesday', () => {
    const S = state([wo('2026-09-29')], { dayPlan: { '2026-09-28': 'rest', '2026-09-29': 'r' } })
    expect(weekAdherence(S, '2026-09-28')).toMatchObject({ planned: 4, done: 1 })
  })

  it('nothing planned gives rate null, not 0 or 100', () => {
    expect(weekAdherence(state([], { week: {} }), '2026-09-28')).toMatchObject({ planned: 0, done: 0, rate: null })
  })

  it('splits by week and honours `since`', () => {
    const S = state([wo('2026-09-21'), wo('2026-09-28')])
    const a = adherence(S, '2026-09-21', '2026-10-04')
    expect(a.weeks.map(w => [w.start, w.planned, w.done])).toEqual([['2026-09-21', 4, 1], ['2026-09-28', 4, 1]])
    expect(adherence(S, '2026-09-21', '2026-10-04', '2026-09-28')).toMatchObject({ planned: 4, done: 1 })
    expect(adherence(S, '2026-09-21', '2026-09-27', '2026-09-28').rate).toBeNull()
  })

  it('weekStart is Monday, also across a month and a year', () => {
    expect(weekStart('2026-10-04')).toBe('2026-09-28')
    expect(weekStart('2026-09-28')).toBe('2026-09-28')
    expect(weekStart('2027-01-01')).toBe('2026-12-28')
  })

  it('days since the last workout that counted', () => {
    const S = state([wo('2026-09-25'), wo('2026-09-28', 1)])
    expect(daysSinceLastOk(S, '2026-09-30')).toBe(5)
    expect(daysSinceLastOk(state(), '2026-09-30')).toBeNull()
  })
})
