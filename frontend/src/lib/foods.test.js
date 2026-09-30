import { describe, it, expect } from 'vitest'
import { FOODS, findFood, searchFoods, gramsOf, macrosFor, defaultPortion } from './foods.js'

describe('food catalog', () => {
  it('has unique ids and sane figures', () => {
    expect(new Set(FOODS.map(f => f.id)).size).toBe(FOODS.length)
    for (const f of FOODS) {
      expect(f.id).toMatch(/^[a-z0-9-]{1,40}$/)
      for (const k of ['kcal', 'p', 'c', 'f']) expect(f[k]).toBeGreaterThanOrEqual(0)
      // Energy from macros (4/4/9) within a loose margin of the stated kcal — catches typos
      // such as a swapped column, not rounding. Fibre and alcohol explain small gaps.
      const est = f.p * 4 + f.c * 4 + f.f * 9
      expect(Math.abs(est - f.kcal), f.name).toBeLessThanOrEqual(Math.max(15, f.kcal * 0.2))
      if (f.piece) expect(f.piece).toBeGreaterThan(0)
    }
  })
  it('searches without caring about case or accents, words in any order', () => {
    expect(searchFoods('platano').map(f => f.id)).toContain('platano')
    expect(searchFoods('PLÁTANO')[0].id).toBe('platano')
    expect(searchFoods('pollo cocida').map(f => f.id)).toEqual(['pechuga-pollo'])
    expect(searchFoods('cocida pollo pechuga').map(f => f.id)).toEqual(['pechuga-pollo'])
    expect(searchFoods('cocida pechuga').map(f => f.id).sort()).toEqual(['pavo-pechuga', 'pechuga-pollo'])
    expect(searchFoods('')).toEqual([])
    expect(searchFoods('   ')).toEqual([])
    expect(searchFoods('zzzz')).toEqual([])
    expect(searchFoods('a', 3)).toHaveLength(3)
  })
  it('puts names that start with the query first', () => {
    expect(searchFoods('arroz')[0].name.startsWith('Arroz')).toBe(true)
  })
  it('converts grams, ml and pieces, and nothing else', () => {
    const egg = findFood('huevo')
    expect(gramsOf(egg, 2, 'pieza')).toBe(100)
    expect(gramsOf(egg, 2, 'Piezas')).toBe(100)
    expect(gramsOf(egg, 120, 'g')).toBe(120)
    expect(gramsOf(findFood('leche-entera'), 250, 'ml')).toBe(250)
    expect(gramsOf(findFood('avena'), 1, 'pieza')).toBeNull()   // no piece weight
    expect(gramsOf(egg, 1, 'taza')).toBeNull()
    expect(gramsOf(egg, undefined, 'g')).toBeNull()
    expect(gramsOf(egg, -1, 'g')).toBeNull()
    expect(gramsOf(null, 1, 'g')).toBeNull()
  })
  it('scales macros to the portion', () => {
    const m = macrosFor('pechuga-pollo', 200, 'g')
    expect(m.kcal).toBeCloseTo(330)
    expect(m.p).toBeCloseTo(62)
    expect(macrosFor('pechuga-pollo', 0, 'g').kcal).toBe(0)
    expect(macrosFor('no-existe', 100, 'g')).toBeNull()
  })
  it('suggests a piece for foods counted in pieces, else 100 g', () => {
    expect(defaultPortion(findFood('huevo'))).toEqual({ qty: '1', unit: 'pieza' })
    expect(defaultPortion(findFood('arroz-blanco'))).toEqual({ qty: '100', unit: 'g' })
  })
})
