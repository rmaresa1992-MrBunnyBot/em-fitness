// EM Fitness: diets the trainer sends (api/diet/).
//
// Pure helpers shared by the trainer's editor and the athlete's view: totals per meal and per
// day, and the conversion between the editor's form (strings, as typed) and the diet the API
// stores (numbers, only the fields that were filled in). Macros are grams, energy is kcal.
//
// A diet has one or two variants: `meals`/`targets` for training days and, optionally,
// `rest: { meals, targets }` for days without a routine. Without `rest` every day is the same.
// Which one applies is the athlete's plan for that day (effectiveRoutineId, the same rule as
// adherence, D16).
//
// The athlete's log lives in their own state, S.dietLog — they are the only writer, like their
// workouts, so it is safe there (D3 is about what someone else writes):
//   S.dietLog[iso] = { v: 't'|'r', n: meals that day, m: { [mealId]: 'ok'|'half'|'skip' } }
// `v` and `n` are the diet as it was when the athlete last marked that day, so editing the diet
// later does not rewrite past days.
import { effectiveRoutineId } from './history.js'
import { isoOf, uid } from './format.js'
import { macrosFor } from './foods.js'

export const MACROS = ['kcal', 'p', 'c', 'f']

/** A number as typed on a phone: '1,5' and '1.5' both mean 1.5. Blank or invalid → undefined. */
export function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : undefined
  const s = String(v ?? '').trim().replace(',', '.')
  if (!s) return undefined
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/**
 * Sum of the foods' macros. `missing` lists the macros some food left blank — the total is then
 * a floor, not the real figure, and the screens say so rather than show it as exact.
 */
export function sumFoods(foods) {
  const out = { kcal: 0, p: 0, c: 0, f: 0, missing: [] }
  for (const m of MACROS) {
    for (const f of foods || []) {
      if (typeof f[m] === 'number') out[m] += f[m]
      else if (!out.missing.includes(m)) out.missing.push(m)
    }
  }
  return out
}
export const mealTotals = meal => sumFoods(meal?.foods)
/** Totals of one variant ('t' by default, the training day). */
export const dayTotals = (diet, v = 't') => sumFoods(mealsOf(diet, v).flatMap(m => m.foods || []))

/** kcal as a whole number, grams with at most one decimal. */
export const fmtMacro = (m, v) => {
  if (typeof v !== 'number') return '—'
  return m === 'kcal' ? String(Math.round(v)) : String(Math.round(v * 10) / 10)
}

/** Share of a target reached, 0..∞ (1 = on target). null when there is no target for it. */
export function progress(total, target) {
  const t = num(target)
  if (!t) return null
  return total / t
}

/* ----------------------------- training / rest day ----------------------------- */

export const hasRest = diet => !!diet?.rest?.meals?.length

/**
 * The meals of a variant, each with an id. Meals saved before ids existed get their position
 * ('t0', 'r1'…) — the same id the editor gives them when it next saves, so a day logged before
 * and after that save lines up.
 */
export function mealsOf(diet, v = 't') {
  const src = v === 'r' && hasRest(diet) ? diet.rest.meals : diet?.meals
  const key = v === 'r' && hasRest(diet) ? 'r' : 't'
  return (src || []).map((m, i) => (m.id ? m : { ...m, id: key + i }))
}
export const targetsOf = (diet, v = 't') => (v === 'r' && hasRest(diet) ? diet.rest.targets : diet?.targets) || {}

/** Which variant a day gets from the plan: rest only when the diet has one and no routine is due. */
export const variantFor = (diet, S, iso) => (hasRest(diet) && !effectiveRoutineId(S, iso) ? 'r' : 't')

/** The variant a day shows: the one it was logged with, else what the plan says today. */
export function dayVariant(S, diet, iso) {
  const v = S.dietLog?.[iso]?.v
  if (v === 't' || (v === 'r' && hasRest(diet))) return v
  return variantFor(diet, S, iso)
}

/* ------------------------------------ log -------------------------------------- */

export const MARKS = ['ok', 'half', 'skip']
const SCORE = { ok: 1, half: 0.5, skip: 0 }
/** Days back the athlete can still mark: today and the two before. */
export const EDIT_DAYS = 2
/** Log entries older than this are dropped when the athlete marks a day, to keep S small. */
export const KEEP_DAYS = 60

const parse = iso => new Date(iso + 'T12:00:00')
export const addDays = (iso, n) => { const d = parse(iso); d.setDate(d.getDate() + n); return isoOf(d) }
const localISO = ms => isoOf(new Date(ms))

export const canMark = (iso, today) => iso <= today && iso >= addDays(today, -EDIT_DAYS)

/**
 * On a draft of S: set `mark` for a meal on a day, or clear it with null. The day's entry is
 * refreshed to the diet on screen — its variant stays, the meal count follows the diet, and marks
 * for meals the trainer has since removed go. A day left with no marks is removed.
 */
export function markMeal(S, diet, iso, mealId, mark) {
  const log = S.dietLog || (S.dietLog = {})
  const v = dayVariant(S, diet, iso)
  const meals = mealsOf(diet, v)
  if (!meals.some(m => m.id === mealId)) return
  const prev = log[iso]?.m || {}
  const m = {}
  for (const meal of meals) if (MARKS.includes(prev[meal.id])) m[meal.id] = prev[meal.id]
  if (MARKS.includes(mark)) m[mealId] = mark
  else delete m[mealId]
  if (Object.keys(m).length) log[iso] = { v, n: meals.length, m }
  else delete log[iso]
  const oldest = addDays(iso, -KEEP_DAYS)
  for (const d of Object.keys(log)) if (d < oldest) delete log[d]
}

/**
 * How a day went: Hecha 1, A medias ½, Saltada or unmarked 0, over the meals of that day's
 * variant, capped at 1. null for a day with no meals to eat.
 */
export function dayScore(S, diet, iso) {
  const e = S.dietLog?.[iso]
  const v = dayVariant(S, diet, iso)
  const n = e?.n || mealsOf(diet, v).length
  if (!n) return null
  let sum = 0
  for (const k of Object.values(e?.m || {})) sum += SCORE[k] ?? 0
  return { d: iso, v, score: Math.min(1, sum / n), logged: !!e }
}

/** The first day that counts: the day the diet was first sent (its last revision for old diets). */
export const dietSince = diet => (diet?.since || diet?.at ? localISO(diet.since || diet.at) : null)

/**
 * Diet adherence between two ISO dates, both included, never before the diet existed. rate is
 * the mean day score; null when no day was evaluated.
 */
export function dietAdherence(S, diet, from, to) {
  const out = { rate: null, evaluated: 0, logged: 0, days: [] }
  if (!diet) return out
  const since = dietSince(diet)
  const start = since && since > from ? since : from
  let sum = 0
  for (let d = start; d <= to; d = addDays(d, 1)) {
    const s = dayScore(S, diet, d)
    if (!s) continue
    out.days.push(s)
    sum += s.score
    if (s.logged) out.logged++
  }
  out.evaluated = out.days.length
  out.rate = out.evaluated ? sum / out.evaluated : null
  return out
}

/** The trainer's figure: the last 7 complete days — today isn't over yet. */
export const WINDOW = 7
export const recentDietAdherence = (S, diet, today) => dietAdherence(S, diet, addDays(today, -WINDOW), addDays(today, -1))

/* --------------------------------- editor form --------------------------------- */

const str = v => (v == null ? '' : String(v))
export const emptyFood = () => ({ name: '', ref: '', qty: '', unit: '', kcal: '', p: '', c: '', f: '' })
export const emptyMeal = name => ({ id: 'm' + uid(), name: name || '', time: '', notes: '', foods: [emptyFood()] })
const emptyTargets = () => ({ kcal: '', p: '', c: '', f: '' })

const formMeals = (diet, v) => mealsOf(diet, v).map(m => ({
  id: m.id, name: str(m.name), time: str(m.time), notes: str(m.notes),
  foods: (m.foods || []).map(f => ({ name: str(f.name), ref: str(f.ref), qty: str(f.qty), unit: str(f.unit), ...Object.fromEntries(MACROS.map(k => [k, str(f[k])])) }))
}))
const formTargets = t => Object.fromEntries(MACROS.map(m => [m, str(t?.[m])]))

/**
 * A stored diet (or null) → editable form. `rest` is null when every day eats the same; the
 * editor fills it (a copy of the training day) when the trainer turns the rest day on.
 */
export function toForm(diet) {
  if (!diet) return { name: '', notes: '', targets: emptyTargets(), meals: [emptyMeal('Desayuno'), emptyMeal('Comida'), emptyMeal('Cena')], rest: null }
  return {
    name: str(diet.name), notes: str(diet.notes),
    targets: formTargets(diet.targets),
    meals: formMeals(diet, 't'),
    rest: hasRest(diet) ? { targets: formTargets(diet.rest.targets), meals: formMeals(diet, 'r') } : null
  }
}

/** The training day copied as the starting point of the rest day — new ids, so the two never share one. */
export const restFromTraining = form => ({
  targets: { ...form.targets },
  meals: form.meals.map(m => ({ ...JSON.parse(JSON.stringify(m)), id: 'm' + uid() }))
})

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const ID = /^[a-zA-Z0-9]{1,24}$/
// Only set fields reach the payload — an empty string would fail the server's number check.
const put = (o, k, v) => { if (v !== undefined && v !== '') o[k] = v; return o }

function mealsFromForm(meals) {
  const seen = new Set()
  return (meals || []).map((m, i) => {
    const meal = { name: (m.name || '').trim() || 'Comida ' + (i + 1), foods: [] }
    // A duplicated or malformed id would mix two meals up in the log: give it a fresh one.
    const id = ID.test(m.id || '') && !seen.has(m.id) ? m.id : 'm' + uid()
    seen.add(id)
    meal.id = id
    const time = (m.time || '').trim()
    if (TIME.test(time)) meal.time = time
    put(meal, 'notes', (m.notes || '').trim())
    ;(m.foods || []).forEach(f => {
      const name = (f.name || '').trim()
      if (!name) return
      const food = { name }
      put(food, 'ref', (f.ref || '').trim())
      put(food, 'qty', num(f.qty))
      put(food, 'unit', (f.unit || '').trim())
      MACROS.forEach(k => put(food, k, num(f[k])))
      meal.foods.push(food)
    })
    return meal
  })
}
function targetsFromForm(t) {
  const out = {}
  MACROS.forEach(m => put(out, m, num(t?.[m])))
  return Object.keys(out).length ? out : undefined
}

/**
 * Editable form → the diet the API takes. Food rows without a name are the blank rows the editor
 * keeps at hand, so they are dropped; a meal left unnamed gets "Comida N". Blank numbers are
 * left out rather than sent as 0, because 0 kcal is a claim and blank is "not specified".
 * A rest day with no meals is no rest day.
 */
export function fromForm(form) {
  const diet = { name: (form.name || '').trim(), meals: mealsFromForm(form.meals) }
  put(diet, 'notes', (form.notes || '').trim())
  const targets = targetsFromForm(form.targets)
  if (targets) diet.targets = targets
  if (form.rest?.meals?.length) {
    diet.rest = { meals: mealsFromForm(form.rest.meals) }
    const rt = targetsFromForm(form.rest.targets)
    if (rt) diet.rest.targets = rt
  }
  return diet
}

/** The same form, parsed — so the editor can show live totals while typing. */
export const formTotals = (form, v = 't') => sumFoods(
  (v === 'r' ? form.rest?.meals : form.meals || []).flatMap(m => mealsFromForm([m])[0].foods))

/* ------------------------------- food catalog ------------------------------- */

/**
 * A form food row after a change: while it is linked to the catalog (`ref`), its macros follow
 * the quantity and unit. A unit the catalog can't convert leaves the macros as they were.
 */
export function withCatalog(food) {
  if (!food.ref) return food
  const m = macrosFor(food.ref, num(food.qty), food.unit)
  if (!m) return food
  return { ...food, ...Object.fromEntries(MACROS.map(k => [k, fmtMacro(k, m[k])])) }
}
