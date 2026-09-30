import { describe, it, expect } from 'vitest'
import {
  mealsOf, targetsOf, hasRest, variantFor, dayVariant, markMeal, dayScore, dietAdherence, recentDietAdherence,
  canMark, restFromTraining, withCatalog, addDays, toForm, fromForm, formTotals, dayTotals, KEEP_DAYS
} from './diet.js'

// Plan: routine on Monday, Wednesday and Friday. 2026-09-28 is a Monday.
const plan = (over = {}) => ({ week: { 1: 'r1', 3: 'r1', 5: 'r1' }, dayPlan: {}, routines: [{ id: 'r1' }], ...over })
const ms = iso => new Date(iso + 'T09:00:00').getTime()
const diet = (over = {}) => ({
  name: 'Volumen', since: ms('2026-09-21'), at: ms('2026-09-27'),
  targets: { kcal: 2800 },
  meals: [
    { name: 'Desayuno', foods: [{ name: 'Avena', kcal: 300 }] },
    { name: 'Comida', foods: [{ name: 'Pollo', kcal: 330 }] }
  ],
  rest: { targets: { kcal: 2200 }, meals: [{ name: 'Única', foods: [{ name: 'Arroz', kcal: 200 }] }] },
  ...over
})

describe('training and rest day', () => {
  it('gives old meals their position as id, per variant', () => {
    expect(mealsOf(diet(), 't').map(m => m.id)).toEqual(['t0', 't1'])
    expect(mealsOf(diet(), 'r').map(m => m.id)).toEqual(['r0'])
    expect(mealsOf(diet({ meals: [{ id: 'abc', name: 'x', foods: [] }] })).map(m => m.id)).toEqual(['abc'])
  })
  it('picks the variant from the plan, and only when the diet has a rest day', () => {
    expect(variantFor(diet(), plan(), '2026-09-28')).toBe('t')        // Monday: routine
    expect(variantFor(diet(), plan(), '2026-09-29')).toBe('r')        // Tuesday: none
    expect(variantFor(diet({ rest: undefined }), plan(), '2026-09-29')).toBe('t')
    expect(variantFor(diet(), plan({ dayPlan: { '2026-09-29': 'r1' } }), '2026-09-29')).toBe('t')   // moved in
    expect(variantFor(diet(), plan({ dayPlan: { '2026-09-28': 'rest' } }), '2026-09-28')).toBe('r') // moved out
  })
  it('falls back to the training day when the rest day is empty or gone', () => {
    expect(hasRest(diet({ rest: { meals: [] } }))).toBe(false)
    expect(mealsOf(diet({ rest: undefined }), 'r').map(m => m.id)).toEqual(['t0', 't1'])
    expect(targetsOf(diet({ rest: undefined }), 'r')).toEqual({ kcal: 2800 })
    expect(targetsOf(diet(), 'r')).toEqual({ kcal: 2200 })
    expect(dayTotals(diet(), 'r').kcal).toBe(200)
    expect(dayTotals(diet(), 't').kcal).toBe(630)
  })
  it('keeps the variant a day was logged with, unless the rest day no longer exists', () => {
    const S = plan({ dietLog: { '2026-09-29': { v: 't', n: 2, m: { t0: 'ok' } } } })
    expect(dayVariant(S, diet(), '2026-09-29')).toBe('t')
    const S2 = plan({ dietLog: { '2026-09-28': { v: 'r', n: 1, m: { r0: 'ok' } } } })
    expect(dayVariant(S2, diet(), '2026-09-28')).toBe('r')
    expect(dayVariant(S2, diet({ rest: undefined }), '2026-09-28')).toBe('t')
  })
})

describe('marking meals', () => {
  it('records a mark with the day’s variant and meal count, and clears the day when emptied', () => {
    const S = plan()
    markMeal(S, diet(), '2026-09-28', 't1', 'half')
    expect(S.dietLog['2026-09-28']).toEqual({ v: 't', n: 2, m: { t1: 'half' } })
    markMeal(S, diet(), '2026-09-28', 't0', 'ok')
    markMeal(S, diet(), '2026-09-28', 't1', null)
    expect(S.dietLog['2026-09-28'].m).toEqual({ t0: 'ok' })
    markMeal(S, diet(), '2026-09-28', 't0', null)
    expect(S.dietLog['2026-09-28']).toBeUndefined()
  })
  it('ignores unknown meals and unknown marks', () => {
    const S = plan()
    markMeal(S, diet(), '2026-09-28', 'nope', 'ok')
    markMeal(S, diet(), '2026-09-28', 'r0', 'ok')       // a rest-day meal on a training day
    markMeal(S, diet(), '2026-09-28', 't0', 'eaten')
    expect(S.dietLog).toEqual({})
  })
  it('drops marks for meals the trainer removed and follows the new meal count', () => {
    const S = plan()
    markMeal(S, diet(), '2026-09-28', 't0', 'ok')
    markMeal(S, diet(), '2026-09-28', 't1', 'ok')
    const edited = diet({ meals: [{ id: 't1', name: 'Comida', foods: [] }, { id: 'nueva', name: 'Cena', foods: [] }, { id: 'x', name: 'Snack', foods: [] }] })
    markMeal(S, edited, '2026-09-28', 'nueva', 'skip')
    expect(S.dietLog['2026-09-28']).toEqual({ v: 't', n: 3, m: { t1: 'ok', nueva: 'skip' } })
  })
  it('prunes entries older than KEEP_DAYS', () => {
    const old = addDays('2026-09-28', -KEEP_DAYS - 1)
    const edge = addDays('2026-09-28', -KEEP_DAYS)
    const S = plan({ dietLog: { [old]: { v: 't', n: 2, m: { t0: 'ok' } }, [edge]: { v: 't', n: 2, m: { t0: 'ok' } } } })
    markMeal(S, diet(), '2026-09-28', 't0', 'ok')
    expect(Object.keys(S.dietLog).sort()).toEqual([edge, '2026-09-28'])
  })
  it('lets the athlete mark today and the two days before, nothing else', () => {
    const today = '2026-09-29'
    expect(canMark(today, today)).toBe(true)
    expect(canMark('2026-09-27', today)).toBe(true)
    expect(canMark('2026-09-26', today)).toBe(false)
    expect(canMark('2026-09-30', today)).toBe(false)
    expect(canMark('2026-10-01', '2026-10-01')).toBe(true)
    expect(canMark('2026-09-30', '2026-10-01')).toBe(true)   // across a month boundary
  })
})

describe('diet adherence', () => {
  it('scores a day: done 1, half ½, skipped or unmarked 0, over that day’s meals', () => {
    const S = plan({ dietLog: { '2026-09-28': { v: 't', n: 2, m: { t0: 'ok', t1: 'half' } } } })
    expect(dayScore(S, diet(), '2026-09-28')).toMatchObject({ score: 0.75, logged: true, v: 't' })
    expect(dayScore(S, diet(), '2026-09-29')).toMatchObject({ score: 0, logged: false, v: 'r' })
    expect(dayScore(plan(), diet({ meals: [], rest: undefined }), '2026-09-28')).toBeNull()
  })
  it('never counts a day more than whole, even with a stale meal count', () => {
    const S = plan({ dietLog: { '2026-09-28': { v: 't', n: 1, m: { t0: 'ok', t1: 'ok' } } } })
    expect(dayScore(S, diet(), '2026-09-28').score).toBe(1)
  })
  it('averages the window and starts no earlier than the first sending', () => {
    const S = plan({ dietLog: {
      '2026-09-21': { v: 't', n: 2, m: { t0: 'ok', t1: 'ok' } },
      '2026-09-22': { v: 'r', n: 1, m: { r0: 'ok' } }
    } })
    const a = dietAdherence(S, diet(), '2026-09-15', '2026-09-23')
    expect(a.days.map(d => d.d)).toEqual(['2026-09-21', '2026-09-22', '2026-09-23'])
    expect(a.evaluated).toBe(3)
    expect(a.logged).toBe(2)
    expect(a.rate).toBeCloseTo(2 / 3)
  })
  it('uses the last revision as start for diets sent before `since` existed', () => {
    const a = dietAdherence(plan(), diet({ since: undefined }), '2026-09-15', '2026-09-28')
    expect(a.days[0].d).toBe('2026-09-27')
  })
  it('gives no rate without a diet or with an empty window', () => {
    expect(dietAdherence(plan(), null, '2026-09-01', '2026-09-28').rate).toBeNull()
    expect(dietAdherence(plan(), diet(), '2026-09-01', '2026-09-10')).toMatchObject({ rate: null, evaluated: 0 })
  })
  it('the trainer’s window is the 7 complete days before today', () => {
    const a = recentDietAdherence(plan(), diet({ since: ms('2026-09-01') }), '2026-09-29')
    expect(a.days.map(d => d.d)).toEqual(['2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28'])
  })
})

describe('editor with a rest day', () => {
  it('round-trips both variants', () => {
    const d = { ...diet(), since: undefined, at: undefined }
    delete d.since; delete d.at
    const back = fromForm(toForm(d))
    expect(back.rest.targets).toEqual({ kcal: 2200 })
    expect(back.rest.meals.map(m => m.id)).toEqual(['r0'])
    expect(back.meals.map(m => m.id)).toEqual(['t0', 't1'])
    expect(fromForm(toForm(back))).toEqual(back)
  })
  it('has no rest day until the trainer adds one, and an empty one is dropped', () => {
    expect(toForm(diet({ rest: undefined })).rest).toBeNull()
    const f = toForm(diet({ rest: undefined }))
    f.rest = { targets: { kcal: '', p: '', c: '', f: '' }, meals: [] }
    expect(fromForm(f).rest).toBeUndefined()
  })
  it('starts the rest day as a copy of the training day with fresh ids', () => {
    const f = toForm(diet({ rest: undefined }))
    const r = restFromTraining(f)
    expect(r.meals.map(m => m.name)).toEqual(['Desayuno', 'Comida'])
    expect(r.meals.map(m => m.id)).not.toContain('t0')
    r.meals[0].foods[0].name = 'cambiado'
    expect(f.meals[0].foods[0].name).toBe('Avena')
  })
  it('replaces duplicated ids so two meals never share one', () => {
    const f = toForm(diet({ rest: undefined }))
    f.meals[1].id = f.meals[0].id
    const ids = fromForm(f).meals.map(m => m.id)
    expect(new Set(ids).size).toBe(2)
    expect(ids[0]).toBe('t0')
  })
  it('totals each variant from the form', () => {
    const f = toForm(diet())
    expect(formTotals(f, 't').kcal).toBe(630)
    expect(formTotals(f, 'r').kcal).toBe(200)
  })
})

describe('catalog rows in the editor', () => {
  it('recomputes the macros of a linked row from quantity and unit', () => {
    const row = withCatalog({ name: 'Huevo entero', ref: 'huevo', qty: '2', unit: 'pieza', kcal: '', p: '', c: '', f: '' })
    expect(row).toMatchObject({ kcal: '143', p: '12.6', c: '0.7', f: '9.5' })
    expect(withCatalog({ ...row, qty: '150', unit: 'g' })).toMatchObject({ kcal: '215', p: '18.9' })
  })
  it('leaves rows alone when unlinked or when the unit can’t be converted', () => {
    const typed = { name: 'Mi receta', ref: '', qty: '1', unit: 'taza', kcal: '300', p: '', c: '', f: '' }
    expect(withCatalog(typed)).toBe(typed)
    const cup = { ...typed, ref: 'avena' }
    expect(withCatalog(cup)).toEqual(cup)
  })
  it('round-trips the catalog link', () => {
    const f = toForm(null)
    f.meals[0].foods = [withCatalog({ name: 'Avena en hojuelas', ref: 'avena', qty: '80', unit: 'g', kcal: '', p: '', c: '', f: '' })]
    const food = fromForm(f).meals[0].foods[0]
    expect(food).toEqual({ name: 'Avena en hojuelas', ref: 'avena', qty: 80, unit: 'g', kcal: 303, p: 10.6, c: 54.2, f: 5.2 })
  })
})
