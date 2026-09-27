// EM Fitness: diets the trainer sends (api/diet/).
//
// Pure helpers shared by the trainer's editor and the athlete's view: totals per meal and per
// day, and the conversion between the editor's form (strings, as typed) and the diet the API
// stores (numbers, only the fields that were filled in). Macros are grams, energy is kcal.

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
export const dayTotals = diet => sumFoods((diet?.meals || []).flatMap(m => m.foods || []))

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

/* --------------------------------- editor form --------------------------------- */

const str = v => (v == null ? '' : String(v))
export const emptyFood = () => ({ name: '', qty: '', unit: '', kcal: '', p: '', c: '', f: '' })
export const emptyMeal = name => ({ name: name || '', time: '', notes: '', foods: [emptyFood()] })

/** A stored diet (or null) → editable form. */
export function toForm(diet) {
  if (!diet) return { name: '', notes: '', targets: { kcal: '', p: '', c: '', f: '' }, meals: [emptyMeal('Desayuno'), emptyMeal('Comida'), emptyMeal('Cena')] }
  return {
    name: str(diet.name), notes: str(diet.notes),
    targets: Object.fromEntries(MACROS.map(m => [m, str(diet.targets?.[m])])),
    meals: (diet.meals || []).map(m => ({
      name: str(m.name), time: str(m.time), notes: str(m.notes),
      foods: (m.foods || []).map(f => ({ name: str(f.name), qty: str(f.qty), unit: str(f.unit), ...Object.fromEntries(MACROS.map(k => [k, str(f[k])])) }))
    }))
  }
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
// Only set fields reach the payload — an empty string would fail the server's number check.
const put = (o, k, v) => { if (v !== undefined && v !== '') o[k] = v; return o }

/**
 * Editable form → the diet the API takes. Food rows without a name are the blank rows the editor
 * keeps at hand, so they are dropped; a meal left unnamed gets "Comida N". Blank numbers are
 * left out rather than sent as 0, because 0 kcal is a claim and blank is "not specified".
 */
export function fromForm(form) {
  const diet = { name: (form.name || '').trim(), meals: [] }
  put(diet, 'notes', (form.notes || '').trim())
  const targets = {}
  MACROS.forEach(m => put(targets, m, num(form.targets?.[m])))
  if (Object.keys(targets).length) diet.targets = targets
  ;(form.meals || []).forEach((m, i) => {
    const meal = { name: (m.name || '').trim() || 'Comida ' + (i + 1), foods: [] }
    const time = (m.time || '').trim()
    if (TIME.test(time)) meal.time = time
    put(meal, 'notes', (m.notes || '').trim())
    ;(m.foods || []).forEach(f => {
      const name = (f.name || '').trim()
      if (!name) return
      const food = { name }
      put(food, 'qty', num(f.qty))
      put(food, 'unit', (f.unit || '').trim())
      MACROS.forEach(k => put(food, k, num(f[k])))
      meal.foods.push(food)
    })
    diet.meals.push(meal)
  })
  return diet
}

/** The same form, parsed — so the editor can show live totals while typing. */
export const formTotals = form => dayTotals(fromForm(form))
