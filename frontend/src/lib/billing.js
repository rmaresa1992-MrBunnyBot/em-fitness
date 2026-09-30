// EM Fitness: monthly fees (api/billing/). Pure helpers for the trainer's panel and the
// athlete's Home card.
//
// Due dates are plain 'YYYY-MM-DD' days on the gym's calendar. status and daysBetween are copied
// from api/billing/dates.js (tiny pure helpers, not worth sharing across the two runtimes) —
// keep the two in step.

export const SOON_DAYS = 5

/** Today on this device's calendar. toISOString would be UTC: a day ahead on an American evening. */
export const localISO = (ms = Date.now()) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function daysBetween(from, to) {
  const t = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) }
  return Math.round((t(to) - t(from)) / 86400000)
}

/** 'overdue' once the due date has passed, 'soon' within SOON_DAYS of it, else 'ok'. */
export function status(due, today = localISO()) {
  const left = daysBetween(today, due)
  return { left, state: left < 0 ? 'overdue' : left <= SOON_DAYS ? 'soon' : 'ok' }
}

/** Billing state of one athlete's record from GET /api/trainer/billing, 'none' without one. */
export const stateOf = (rec, today) => (rec ? status(rec.due, today).state : 'none')

// Colours per state, as text: tokens in index.css that stay readable on both themes.
export const STATE_COLOR = { overdue: 'var(--st-overdue)', soon: 'var(--st-soon)', ok: 'var(--st-ok)', none: 'var(--label-3)' }

// One number format for everyone at the gym (the trainer and the athletes read the same fee),
// not each viewer's date locale. The gym is in Mexico (assumed from the owner's time zone).
export const MONEY_LOCALE = 'es-MX'

/** "$1,250" / "$1,250.50" — the gym's currency symbol, no fixed currency code. */
export function fmtMoney(n, locale = MONEY_LOCALE) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  return '$' + n.toLocaleString(locale, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })
}

/** The day of the month a due date falls on — the billing day the server keeps with it. */
export const dayOf = iso => Number(String(iso).slice(8, 10))
