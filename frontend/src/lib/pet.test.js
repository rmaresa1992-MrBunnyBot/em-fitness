import { describe, it, expect } from 'vitest'
import { petStatus, newPet, buy, toggleWear, START, REVIVE, COINS_PER_WORKOUT, COINS_FULL_WEEK } from './pet.js'
import { ITEM } from './pet-items.js'

// Born Monday 2026-08-03. Helpers build a schedule and the workouts done on it.
const BORN = '2026-08-03'
const R = { id: 'r', name: 'Fuerza', ex: [{ id: '0025', sets: 4, reps: 10 }] }
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
const wo = (d, done = 4) => ({ id: d, d, setsPlanned: 4, entries: [{ id: '0025', sets: Array.from({ length: 4 }, (_, i) => ({ w: 20, r: 10, done: i < done })) }] })
// Weekly plan on the given weekdays (0 = Sunday); `keep(weekIdx, k)` decides whether the k-th
// session of week `weekIdx` was done.
function state(weekdays, weeks, keep = () => true, over = {}) {
  const workouts = []
  for (let w = 0; w < weeks; w++) {
    let k = 0
    for (let i = 0; i < 7; i++) {
      const d = addDays(BORN, w * 7 + i)
      if (weekdays.includes(new Date(d + 'T12:00:00').getDay())) { if (keep(w, k)) workouts.push(wo(d)); k++ }
    }
  }
  return { routines: [R], week: Object.fromEntries(weekdays.map(d => [d, 'r'])), dayPlan: {}, workouts, pet: newPet(BORN), ...over }
}
const lastDay = weeks => addDays(BORN, weeks * 7 - 1)   // the Sunday closing week `weeks`

describe('capybara', () => {
  it('no pet, no status', () => {
    expect(petStatus({ workouts: [] }, BORN)).toBeNull()
  })

  it('100 % for 8 weeks: full, happy, never fainted, coins for every session and week', () => {
    const S = state([1, 3, 5], 8)
    const st = petStatus(S, lastDay(8))
    expect(st.fainted).toBe(false)
    expect(st.mood).toBe('happy')
    expect(st.food).toBeGreaterThanOrEqual(60)
    expect(st.coins).toBe(8 * 3 * COINS_PER_WORKOUT + 8 * COINS_FULL_WEEK)
    // happy every single day, including the Sunday before the next session
    for (let d = 7; d < 56; d++) expect(petStatus(S, addDays(BORN, d)).mood).toBe('happy')
  })

  it('75 % is the balance point: 12 weeks at 3 of 4 and it is still alive', () => {
    const S = state([1, 2, 4, 6], 12, (w, k) => k !== 3)
    const st = petStatus(S, lastDay(12))
    expect(st.fainted).toBe(false)
    expect(st.health).toBeGreaterThan(0)
  })

  it('50 % drains it until it faints', () => {
    const S = state([1, 2, 4, 6], 12, (w, k) => k < 2)
    const st = petStatus(S, lastDay(12))
    expect(st.fainted).toBe(true)
    expect(st.mood).toBe('fainted')
    expect(st.happy).toBe(0)
    expect(st.food).toBe(0)
  })

  it('missing one session this week makes it hungry and less happy', () => {
    const full = state([1, 3, 5], 4)
    const miss = state([1, 3, 5], 4, (w, k) => !(w === 3 && k === 1))
    const a = petStatus(full, lastDay(4)), b = petStatus(miss, lastDay(4))
    expect(a.mood).toBe('happy')
    expect(b.mood).toBe('hungry')
    expect(b.happy).toBeLessThan(a.happy)
  })

  it('fainted, then a whole week done wakes it with everything it had (D15)', () => {
    const faint = state([1, 2, 4, 6], 10, (w, k) => k < 1)            // 25 % for 10 weeks
    faint.pet.owned = ['cap']; faint.pet.wear = { head: 'cap' }
    expect(petStatus(faint, lastDay(10)).fainted).toBe(true)
    // week 11 complete: all 4 sessions
    for (const i of [0, 1, 3, 5]) faint.workouts.push(wo(addDays(BORN, 70 + i)))
    const st = petStatus(faint, lastDay(11))
    expect(st.fainted).toBe(false)
    expect(st.food).toBeGreaterThan(0)
    expect(st.food).toBeLessThanOrEqual(REVIVE)
    expect(faint.pet.owned).toEqual(['cap'])
  })

  it('a partial week does not wake it', () => {
    const faint = state([1, 2, 4, 6], 10, (w, k) => k < 1)
    for (const i of [0, 1, 3]) faint.workouts.push(wo(addDays(BORN, 70 + i)))
    expect(petStatus(faint, lastDay(11)).fainted).toBe(true)
  })

  it('with nothing planned it sleeps and costs nothing', () => {
    const S = state([], 4, () => true, { week: {} })
    const st = petStatus(S, lastDay(4))
    expect(st.mood).toBe('sleeping')
    expect(st.food).toBe(START)
  })

  it('extra sessions and workouts under 75 % earn nothing; days before birth do not count', () => {
    const S = state([1, 3, 5], 1)
    S.workouts.push(wo(addDays(BORN, 1)), wo(addDays(BORN, 3)), wo(addDays(BORN, -3)), wo(addDays(BORN, 5), 2))
    expect(petStatus(S, lastDay(1)).coins).toBe(3 * COINS_PER_WORKOUT + COINS_FULL_WEEK)
  })

  it('buying needs the coins, spends them and wears the item; wearing toggles', () => {
    const S = state([1, 3, 5], 2)                       // 2 full weeks = 120 coins
    const today = lastDay(2)
    expect(petStatus(S, today).coins).toBe(120)
    expect(buy(S, 'castle', today)).toBe('not enough coins')
    expect(buy(S, 'nope', today)).toBe('unknown item')
    expect(buy(S, 'cap', today)).toBeNull()
    expect(petStatus(S, today).coins).toBe(120 - ITEM.cap.price)
    expect(S.pet.wear.head).toBe('cap')
    expect(buy(S, 'cap', today)).toBe('already yours')
    toggleWear(S, 'cap'); expect(S.pet.wear.head).toBeUndefined()
    toggleWear(S, 'cap'); expect(S.pet.wear.head).toBe('cap')
    toggleWear(S, 'crown'); expect(S.pet.wear.head).toBe('cap')   // not owned: nothing happens
  })
})
