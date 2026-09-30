// EM Fitness: the capybara (fase 6, D15). It lives on the athlete's training.
//
// Like adherence and progression, everything here is a pure function of the state: food, water,
// mood and coins are replayed day by day from the pet's birth, so there are no counters to drift
// or to cheat. The only things stored are the pet itself — name, birth day, what was bought and
// what it wears — in S.pet, written only by the athlete's own app.
//
// The calibration is the rule the owner gave: training at least 75 % of what is planned keeps the
// capybara alive. So a week's upkeep costs exactly what 75 % of that week's sessions bring in:
//   gain per session  = 100 / P            (P = sessions planned that week)
//   daily upkeep      = 0.75 · 100 / 7
// 100 % fills it up, 75 % holds it steady, less drains it. A week with nothing planned costs
// nothing: the capybara sleeps. Fainting is a separate, predictable rule (owner, 2026-09-29):
// two calendar weeks in a row under 75 % of the plan, whatever the meters say.
import { effectiveRoutineId } from './history.js'
import { isoOf, weekKey } from './format.js'
import { workoutOk, weekStart, SUCCESS } from './adherence.js'
import { ITEM } from './pet-items.js'

export const START = 70            // food and water on the first day
export const REVIVE = 60           // after a fainted capybara wakes up
export const UPKEEP = 75 / 7       // per day, in a week with something planned
export const COINS_PER_WORKOUT = 10
export const COINS_FULL_WEEK = 30
export const MISS_PENALTY = 20     // happiness lost per planned session missed in the last 7 days
export const HAPPY = 60
export const FAIL_WEEKS = 2        // weeks in a row under 75 % before it faints (owner's rule)
export const FLOOR = 3             // the meters bottom out here until it actually faints

const parse = iso => new Date(iso + 'T12:00:00')
const addDays = (iso, n) => { const d = parse(iso); d.setDate(d.getDate() + n); return isoOf(d) }
const clamp = v => Math.max(0, Math.min(100, v))

/** The pet a new athlete gets on their first visit. */
export const newPet = (born, name = 'Capi') => ({ name, born, owned: [], wear: {}, spent: 0 })

/** Share of a workout's planned sets that were done (0–1). */
function setsRatio(w) {
  let done = 0, kept = 0
  for (const e of w.entries || []) for (const s of e.sets || []) { kept++; if (s.done) done++ }
  const planned = w.setsPlanned > 0 ? w.setsPlanned : kept
  return planned ? Math.min(1, done / planned) : 0
}

/**
 * Replays the pet from its birth to `today` (both included).
 * Returns { food, water, health, happy, mood, fainted, coins, earned, sleeping, week }.
 */
export function petStatus(S, today) {
  const pet = S.pet
  if (!pet?.born) return null
  const byDay = new Map()   // day -> best counted workout ratio
  for (const w of S.workouts || []) {
    if (w.d < pet.born || w.d > today || !workoutOk(w)) continue
    byDay.set(w.d, Math.max(byDay.get(w.d) || 0, setsRatio(w)))
  }
  const plannedIn = new Map()   // weekKey -> sessions planned that calendar week
  const planned = d => {
    const k = weekKey(d)
    if (!plannedIn.has(k)) {
      let n = 0
      const mon = weekStart(d)
      for (let i = 0; i < 7; i++) if (effectiveRoutineId(S, addDays(mon, i))) n++
      plannedIn.set(k, n)
    }
    return plannedIn.get(k)
  }

  let food = START, water = START, earned = 0, fainted = false
  let wk = null, wkDone = 0, wkPlanned = 0, failStreak = 0
  for (let d = pet.born; d <= today; d = addDays(d, 1)) {
    const k = weekKey(d)
    if (k !== wk) { wk = k; wkDone = 0; wkPlanned = 0 }
    const P = planned(d)
    if (effectiveRoutineId(S, d)) wkPlanned++          // only days since its birth are judged
    const ratio = byDay.get(d)
    // Sessions count up to what the week planned: extra ones earn nothing, so it can't be farmed.
    if (ratio != null && P > 0 && wkDone < P) {
      wkDone++
      earned += COINS_PER_WORKOUT
      if (!fainted) { food = clamp(food + 100 / P); water = clamp(water + (100 / P) * ratio) }
      if (wkDone === P) {
        earned += COINS_FULL_WEEK
        // D15: the day a whole week is done, a fainted capybara wakes up with everything it had.
        if (fainted) { fainted = false; food = REVIVE; water = REVIVE; failStreak = 0 }
      }
    }
    if (!fainted && P > 0) {
      // The meters show it getting hungry and tired, but they don't decide when it faints:
      // the owner's rule does (below), so they stop just above empty.
      food = Math.max(FLOOR, food - UPKEEP)
      water = Math.max(FLOOR, water - UPKEEP)
    }
    // End of the calendar week: a week under 75 % of its plan is a failed week, and two failed
    // weeks in a row make it faint — at 50 % or at 0 % alike. A good week resets the count; a
    // week with nothing planned doesn't count either way.
    if (parse(d).getDay() === 0 && wkPlanned > 0) {
      failStreak = Math.min(wkDone, wkPlanned) / wkPlanned < SUCCESS ? failStreak + 1 : 0
      if (!fainted && failStreak >= FAIL_WEEKS) { fainted = true; food = 0; water = 0 }
    }
  }

  // Happiness: how full it is, minus the sessions it went without this last week.
  let missed = 0
  for (let i = 1; i <= 7; i++) {
    const d = addDays(today, -i)
    if (d < pet.born) break
    if (effectiveRoutineId(S, d) && !byDay.has(d)) missed++
  }
  const health = Math.min(food, water)
  const happy = fainted ? 0 : clamp((food + water) / 2 - MISS_PENALTY * missed)
  const sleeping = !fainted && planned(today) === 0
  // The owner's rule: all sessions done → happy; one missed → hungry. At 100 % the lowest point
  // of a week (the day before the next session) sits around 68, hence 60 for "happy".
  const mood = fainted ? 'fainted' : sleeping ? 'sleeping' : health < 25 ? 'tired'
    : (missed > 0 || food < 50 || water < 50) ? 'hungry' : happy >= HAPPY ? 'happy' : 'ok'
  const coins = earned - (pet.spent || 0)
  return { food: Math.round(food), water: Math.round(water), health: Math.round(health), happy: Math.round(happy), mood, fainted, sleeping, coins, earned, missed }
}

/** Buys an item into the draft state. Returns an error key, or null when it went through. */
export function buy(S, itemId, today) {
  const item = ITEM[itemId]
  if (!item || !S.pet) return 'unknown item'
  if ((S.pet.owned || []).includes(itemId)) return 'already yours'
  const st = petStatus(S, today)
  if (!st || st.coins < item.price) return 'not enough coins'
  S.pet.owned = [...(S.pet.owned || []), itemId]
  S.pet.spent = (S.pet.spent || 0) + item.price
  S.pet.wear = { ...(S.pet.wear || {}), [item.slot]: itemId }
  return null
}

/** Puts an owned item on (or takes it off when it is already on). */
export function toggleWear(S, itemId) {
  const item = ITEM[itemId]
  if (!item || !S.pet || !(S.pet.owned || []).includes(itemId)) return
  const wear = { ...(S.pet.wear || {}) }
  if (wear[item.slot] === itemId) delete wear[item.slot]
  else wear[item.slot] = itemId
  S.pet.wear = wear
}
