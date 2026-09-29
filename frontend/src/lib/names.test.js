import { describe, it, expect, afterAll } from 'vitest'
import { setLang, nameOf, nameMatches } from './i18n.js'
import { EXDB, EXIDX } from './exercises.js'
import es from '../names/es.js'

const bench = () => EXIDX['0025']            // "barbell bench press"
const custom = { id: 'c1abc', n: 'Mi press raro', bp: 'chest', custom: true }

describe('Spanish exercise name pack', () => {
  it('covers every dataset exercise with a non-empty, sentence-case name', () => {
    expect(Object.keys(es)).toHaveLength(EXDB.length)
    EXDB.forEach(e => {
      expect(typeof es[e.id]).toBe('string')
      expect(es[e.id].trim()).toBe(es[e.id])
      expect(es[e.id].length).toBeGreaterThan(0)
      expect(es[e.id][0]).toBe(es[e.id][0].toLocaleUpperCase('es'))
    })
  })
})

describe('nameOf / nameMatches', () => {
  afterAll(() => setLang('en'))

  it('shows the dataset name in English', async () => {
    await setLang('en')
    expect(nameOf(bench())).toBe('barbell bench press')
  })

  it('shows the translated name in Spanish, and switches back', async () => {
    await setLang('es')
    expect(nameOf(bench())).toBe('Press de banca con barra')
    await setLang('en')
    expect(nameOf(bench())).toBe('barbell bench press')
  })

  it('leaves custom exercises, unknown ids and missing input alone', async () => {
    await setLang('es')
    expect(nameOf(custom)).toBe('Mi press raro')
    expect(nameOf({ id: '9999', n: 'from another dataset' })).toBe('from another dataset')
    expect(nameOf(undefined)).toBe('')
  })

  it('falls back to English for a language without a pack', async () => {
    await setLang('fr')
    expect(nameOf(bench())).toBe('barbell bench press')
  })

  it('matches the Spanish name ignoring case and accents, and the English one too', async () => {
    await setLang('es')
    const curl = EXIDX['0285']                 // "dumbbell alternate biceps curl"
    expect(nameMatches(curl, 'biceps')).toBe(true)          // "bíceps" without the accent
    expect(nameMatches(curl, 'BÍCEPS ALTERNO')).toBe(true)
    expect(nameMatches(bench(), 'press de banca')).toBe(true)
    expect(nameMatches(bench(), 'bench press')).toBe(true)  // English still works
    expect(nameMatches(bench(), 'sentadilla')).toBe(false)
    expect(nameMatches(custom, 'raro')).toBe(true)
  })
})
