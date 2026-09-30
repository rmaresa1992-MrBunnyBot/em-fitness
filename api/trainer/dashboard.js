/* The trainer's dashboard: one row per athlete and the alerts that need the trainer's eye.
 *
 * A pure function of what the server already has — each athlete's state file (schedule and
 * workouts), their live assignments, fee and chat — handed in by server.js, so it is testable
 * against fakes. Exercise ids go out as ids: the names live in the client's dataset.
 *
 * Alerts, most serious first:
 *   high    pain reported on an exercise (last 14 days)
 *   medium  discomfort reported · adherence under 75 % over the last 4 weeks · no workout for
 *           7+ days with sessions planned · monthly fee overdue
 *   low     sets done under the prescribed weight · unread messages · plan not synced yet
 */
import { adherence, addDays, weekStart, daysBetween, workoutOk, plannedSet, SUCCESS } from './adherence.js';

export const WINDOW_DAYS = 14;
export const INACTIVE_DAYS = 7;
const SEVERITY = { high: 0, medium: 1, low: 2 };

const localDay = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/**
 * @param users        all accounts (the trainer and disabled ones are skipped)
 * @param readState    uid -> state or null
 * @param assignments  uid -> live assignments [{ since|at }]
 * @param billing      uid -> { due } or null
 * @param unread       uid -> unread messages from the athlete
 * @param todayFor     uid -> 'YYYY-MM-DD' in the athlete's own calendar
 * @param isAdmin      user -> bool
 */
export function buildDashboard({ users, readState, assignments, billing, unread, todayFor, isAdmin }) {
  const rows = [], alerts = [];
  const push = (a) => alerts.push(a);

  for (const u of users) {
    if (isAdmin(u) || u.disabled) continue;
    const today = todayFor(u.id);
    const S = readState(u.id) || {};
    const live = assignments(u.id);
    const hasPlan = Object.values(S.week || {}).some(Boolean);
    // Adherence counts from the first day the athlete had a routine from the trainer.
    const firstAt = live.map(a => a.since || a.at).filter(Boolean).sort((a, b) => a - b)[0];
    const since = firstAt ? localDay(firstAt) : null;
    const week = adherence(S, weekStart(today), addDays(weekStart(today), 6), since);
    const month = adherence(S, addDays(today, -28), addDays(today, -1), since);   // today isn't a miss yet
    const okDays = (S.workouts || []).filter(w => workoutOk(w)).map(w => w.d).sort();
    const lastOk = okDays[okDays.length - 1] || null;
    // Days without a workout that counted, but never from before the athlete had a plan: a
    // routine given today is not "10 days idle" because the last workout was 10 days ago.
    const idleFrom = [lastOk, since].filter(Boolean).sort().pop();
    const idle = idleFrom ? daysBetween(idleFrom, today) : null;
    const from = addDays(today, -WINDOW_DAYS);

    // Discomfort reports and sets under the prescribed weight in the window.
    const reports = [], under = [];
    for (const w of S.workouts || []) {
      if (w.d < from || w.d > today) continue;
      for (const e of w.entries || []) {
        if (e.fb && (e.fb.lvl === 'pain' || e.fb.lvl === 'discomfort'))
          reports.push({ d: w.d, exId: e.id, lvl: e.fb.lvl, zone: e.fb.zone || null, note: e.fb.note || null });
        (e.sets || []).forEach((s, i) => {
          const p = plannedSet(e.target, i);
          if (s.done && p && p.w > 0 && (s.w || 0) < p.w) under.push({ d: w.d, exId: e.id, set: i + 1, w: s.w || 0, planned: p.w });
        });
      }
    }
    reports.sort((a, b) => b.d.localeCompare(a.d));

    const fee = billing(u.id);
    const overdue = fee && fee.due < today ? fee.due : null;
    const msgs = unread(u.id) || 0;
    const synced = !live.length || hasPlan;

    rows.push({
      id: u.id, name: u.name, week, month, lastWorkout: lastOk, idle,
      reports, under: under.length, overdue, unread: msgs, synced, hasPlan
    });

    const who = { athlete: u.id, name: u.name };
    for (const r of reports) push({ ...who, kind: r.lvl, severity: r.lvl === 'pain' ? 'high' : 'medium', d: r.d, exId: r.exId, zone: r.zone, note: r.note });
    if (month.planned >= 2 && month.rate < SUCCESS) push({ ...who, kind: 'adherence', severity: 'medium', done: month.done, planned: month.planned, rate: month.rate });
    if (hasPlan && idle != null && idle >= INACTIVE_DAYS) push({ ...who, kind: 'inactive', severity: 'medium', days: idle });
    if (overdue) push({ ...who, kind: 'fee', severity: 'medium', due: overdue });
    if (under.length >= 2) push({ ...who, kind: 'underweight', severity: 'low', count: under.length, exIds: [...new Set(under.map(x => x.exId))] });
    if (msgs) push({ ...who, kind: 'message', severity: 'low', count: msgs });
    if (!synced) push({ ...who, kind: 'nosync', severity: 'low' });
  }

  alerts.sort((a, b) => SEVERITY[a.severity] - SEVERITY[b.severity] || (b.d || '').localeCompare(a.d || ''));
  const withPlan = rows.filter(r => r.week.planned);
  const totals = {
    athletes: rows.length,
    weekPlanned: withPlan.reduce((n, r) => n + r.week.planned, 0),
    weekDone: withPlan.reduce((n, r) => n + r.week.done, 0),
    atRisk: new Set(alerts.filter(a => a.severity !== 'low').map(a => a.athlete)).size,
    high: alerts.filter(a => a.severity === 'high').length
  };
  return { rows, alerts, totals };
}
