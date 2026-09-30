/* Calendar arithmetic for monthly fees. Dates are plain 'YYYY-MM-DD' strings — a due date is a
 * day on the gym's calendar, not an instant — so everything here works on the numbers in the
 * string and never on a Date in some time zone. frontend/src/lib/billing.js carries a copy of
 * addMonth and status (tiny pure helpers, not worth sharing across the two runtimes).
 */

export const ISO = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const pad = n => String(n).padStart(2, '0');
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();   // m is 1-12

/** A real calendar day: '2026-02-30' matches ISO but is not one. */
export function isDay(iso) {
  if (typeof iso !== 'string' || !ISO.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  return d <= daysIn(y, m);
}

/**
 * The due date one month after `iso`, on the billing day `day` (1-31), clamped to the last day
 * of a shorter month. Keeping `day` separate is what stops the drift: 31 Jan → 28 Feb → 31 Mar,
 * not → 28 Mar and 28 forever after.
 */
export function addMonth(iso, day) {
  let [y, m] = iso.split('-').map(Number);
  m += 1;
  if (m > 12) { m = 1; y += 1; }
  return `${y}-${pad(m)}-${pad(Math.min(day, daysIn(y, m)))}`;
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from, to) {
  const t = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(to) - t(from)) / 86400000);
}

export const SOON_DAYS = 5;

/** 'overdue' once the due date has passed, 'soon' within SOON_DAYS of it, else 'ok'. */
export function status(due, today) {
  const left = daysBetween(today, due);
  return { left, state: left < 0 ? 'overdue' : left <= SOON_DAYS ? 'soon' : 'ok' };
}
