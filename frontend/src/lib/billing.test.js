import { describe, it, expect } from 'vitest'
import { status, stateOf, daysBetween, fmtMoney, dayOf, localISO } from './billing.js'

describe('billing', () => {
  it('status at the edges of the due date', () => {
    expect(status('2027-03-10', '2027-03-11')).toEqual({ left: -1, state: 'overdue' })
    expect(status('2027-03-10', '2027-03-10')).toEqual({ left: 0, state: 'soon' })
    expect(status('2027-03-10', '2027-03-05')).toEqual({ left: 5, state: 'soon' })
    expect(status('2027-03-10', '2027-03-04')).toEqual({ left: 6, state: 'ok' })
  })

  it('counts days across month, year and DST changes', () => {
    expect(daysBetween('2027-02-28', '2027-03-01')).toBe(1)
    expect(daysBetween('2027-12-31', '2028-01-01')).toBe(1)
    expect(daysBetween('2027-03-13', '2027-03-15')).toBe(2)
    expect(daysBetween('2027-03-15', '2027-03-13')).toBe(-2)
  })

  it('stateOf without a record is none', () => {
    expect(stateOf(null, '2027-01-01')).toBe('none')
    expect(stateOf({ due: '2026-12-31' }, '2027-01-01')).toBe('overdue')
  })

  it('formats money without inventing decimals', () => {
    expect(fmtMoney(1250, 'en-US')).toBe('$1,250')
    expect(fmtMoney(99.5, 'en-US')).toBe('$99.50')
    expect(fmtMoney(0, 'en-US')).toBe('$0')
    expect(fmtMoney(undefined)).toBe('—')
    expect(fmtMoney(NaN)).toBe('—')
  })

  it('dayOf and localISO', () => {
    expect(dayOf('2027-01-31')).toBe(31)
    expect(localISO(new Date(2027, 0, 5, 23, 30).getTime())).toBe('2027-01-05')
  })
})
