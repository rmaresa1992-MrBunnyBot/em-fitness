import { describe, it, expect } from 'vitest'
import {
  num, sumFoods, dayTotals, mealTotals, fmtMacro, progress, toForm, fromForm, formTotals, emptyFood,
  mealsOf, targetsOf, hasRest, variantFor, dayVariant, markMeal, dayScore, dietAdherence, recentDietAdherence,
  canMark, restFromTraining, withCatalog, addDays, KEEP_DAYS
} from './diet.js'

describe('num', () => {
  it('reads numbers as typed on a phone', () => {
    expect(num('1,5')).toBe(1.5)
    expect(num('1.5')).toBe(1.5)
    expect(num(' 80 ')).toBe(80)
    expect(num('0')).toBe(0)
    expect(num(2)).toBe(2)
  })
  it('treats blank, junk, negatives and non-finite values as not given', () => {
    for (const v of ['', '   ', 'abc', '1.000,5', '-3', null, undefined, NaN, Infinity, -1]) expect(num(v)).toBeUndefined()
  })
})

describe('totals', () => {
  const foods = [{ name: 'a', kcal: 100, p: 10, c: 5, f: 2 }, { name: 'b', kcal: 50.4, p: 2.25 }]
  it('adds each macro and names the ones some food left blank', () => {
    const t = sumFoods(foods)
    expect(t.kcal).toBeCloseTo(150.4)
    expect(t.p).toBeCloseTo(12.25)
    expect(t.c).toBe(5)
    expect(t.missing).toEqual(['c', 'f'])
  })
  it('is exact zero, with nothing missing, for no foods at all', () => {
    expect(sumFoods([])).toEqual({ kcal: 0, p: 0, c: 0, f: 0, missing: [] })
    expect(sumFoods(undefined).missing).toEqual([])
    expect(dayTotals(null).kcal).toBe(0)
    expect(mealTotals({}).kcal).toBe(0)
  })
  it('sums the day across meals', () => {
    const d = { meals: [{ foods: [foods[0]] }, { foods: [{ name: 'c', kcal: 25, p: 1, c: 1, f: 1 }] }] }
    expect(dayTotals(d)).toMatchObject({ kcal: 125, p: 11, c: 6, f: 3, missing: [] })
  })
  it('formats kcal whole and grams to one decimal', () => {
    expect(fmtMacro('kcal', 150.6)).toBe('151')
    expect(fmtMacro('p', 12.25)).toBe('12.3')
    expect(fmtMacro('p', 12)).toBe('12')
    expect(fmtMacro('c', undefined)).toBe('—')
  })
  it('measures progress against a target only when there is one', () => {
    expect(progress(1400, 2800)).toBe(0.5)
    expect(progress(100, '')).toBeNull()
    expect(progress(100, 0)).toBeNull()
    expect(progress(100, undefined)).toBeNull()
  })
})

describe('form ↔ diet', () => {
  const stored = {
    name: 'Volumen', notes: 'Agua 3 L', targets: { kcal: 2800, p: 180 },
    meals: [{ name: 'Desayuno', time: '08:00', foods: [{ name: 'Avena', qty: 80, unit: 'g', kcal: 300, p: 10 }] }]
  }
  it('round-trips a stored diet unchanged, giving id-less meals their position as id', () => {
    const back = fromForm(toForm(stored))
    expect(back).toEqual({ ...stored, meals: [{ ...stored.meals[0], id: 't0' }] })
    expect(fromForm(toForm(back))).toEqual(back)
  })
  it('starts a new diet with three meals ready to fill', () => {
    const f = toForm(null)
    expect(f.meals.map(m => m.name)).toEqual(['Desayuno', 'Comida', 'Cena'])
    expect(f.meals[0].foods).toEqual([emptyFood()])
  })
  it('drops unnamed food rows, blank numbers and bad times; names unnamed meals', () => {
    const f = toForm(null)
    f.meals[0].foods = [{ ...emptyFood(), name: ' Huevo ', qty: '2', kcal: '1,5e2', p: '' }, emptyFood()]
    f.meals[1] = { name: '  ', time: '9:00', notes: ' ', foods: [emptyFood()] }
    f.targets.kcal = 'abc'
    const d = fromForm(f)
    expect(d.targets).toBeUndefined()
    expect(d.notes).toBeUndefined()
    expect(d.meals[0].foods).toEqual([{ name: 'Huevo', qty: 2, kcal: 150 }])
    expect(d.meals[1]).toEqual({ id: expect.any(String), name: 'Comida 2', foods: [] })
    expect(d.meals[2].name).toBe('Cena')
  })
  it('keeps an explicit 0 — zero fat is a claim, blank is not', () => {
    const f = toForm(null)
    f.meals[0].foods = [{ ...emptyFood(), name: 'Pechuga', f: '0' }]
    expect(fromForm(f).meals[0].foods[0]).toEqual({ name: 'Pechuga', f: 0 })
  })
  it('gives live totals from the raw form', () => {
    const f = toForm(stored)
    f.meals[0].foods.push({ ...emptyFood(), name: 'Leche', kcal: '120,5' })
    expect(formTotals(f).kcal).toBeCloseTo(420.5)
  })
  it('keeps unicode names intact', () => {
    const f = toForm(null)
    f.meals[0].foods = [{ ...emptyFood(), name: 'Jalapeño 🌶️ piña' }]
    expect(fromForm(f).meals[0].foods[0].name).toBe('Jalapeño 🌶️ piña')
  })
})
