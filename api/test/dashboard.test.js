/* Trainer dashboard: adherence (server copy), and each alert from a synthetic athlete. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData } from './helpers.mjs';

tempData();
const { adherence, workoutOk, plannedSet, weekStart } = await import('../trainer/adherence.js');
const { buildDashboard } = await import('../trainer/dashboard.js');

// Today is Wednesday 2026-09-30. Routine Mon/Wed/Fri.
const TODAY = '2026-09-30';
const R = { id: 'r', name: 'Fuerza', ex: [{ id: '0025', sets: 4, reps: 10, weight: 40 }] };
const sets = (done, total = 4, w = 40) => Array.from({ length: total }, (_, i) => ({ w, r: 10, done: i < done }));
const wo = (d, over = {}) => ({ id: d, d, setsPlanned: 4, entries: [{ id: '0025', target: { id: '0025', sets: 4, reps: 10, weight: 40 }, sets: sets(4) }], ...over });
const base = (workouts = [], over = {}) => ({ routines: [R], week: { 1: 'r', 3: 'r', 5: 'r' }, dayPlan: {}, workouts, ...over });
const since = Date.parse('2026-08-01T12:00:00');

function dash(states, extra = {}) {
  const users = [{ id: 'coach', name: 'Coach', admin: true }, ...Object.keys(states).map(id => ({ id, name: id })), { id: 'off', name: 'Off', disabled: true }];
  return buildDashboard({
    users, isAdmin: u => !!u.admin,
    readState: id => states[id] || null,
    assignments: id => (extra.noAssign?.includes(id) ? [] : [{ rid: 'r', since }]),
    billing: id => extra.billing?.[id] || null,
    unread: id => extra.unread?.[id] || 0,
    todayFor: () => TODAY
  });
}
// Every Mon/Wed/Fri from 2026-08-31 to yesterday, all complete: a model athlete.
function allDays(to = '2026-09-29', from = '2026-08-31') {
  const out = [];
  for (let d = new Date(from + 'T12:00:00Z'); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    if ([1, 3, 5].includes(d.getUTCDay())) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

test('server adherence matches the client rules', () => {
  assert.equal(workoutOk(wo('2026-09-28')), true);
  assert.equal(workoutOk(wo('2026-09-28', { setsPlanned: 8 })), false, '4 of 8 sets');
  const S = base(['2026-09-21', '2026-09-23', '2026-09-28'].map(d => wo(d)));
  assert.deepEqual(adherence(S, '2026-09-21', '2026-09-27'), { planned: 3, done: 2, rate: 2 / 3 });
  assert.equal(weekStart('2026-10-04'), '2026-09-28');
  assert.equal(adherence(base([]), '2026-09-21', '2026-09-27', '2026-09-28').rate, null);
});

test('plannedSet reads straight sets and drop sets', () => {
  assert.deepEqual(plannedSet({ reps: 10, weight: 40 }, 3), { w: 40, r: 10 });
  assert.deepEqual(plannedSet({ mode: 'reps', reps: 10, weight: 30, scheme: [{ r: 10, w: 30 }, { r: 15, w: 20 }] }, 1), { w: 20, r: 15 });
  assert.equal(plannedSet({ mode: 'time', sec: 45 }, 0), null);
  assert.equal(plannedSet(null, 0), null);
});

test('a model athlete raises no alert', () => {
  const d = dash({ ana: base(allDays().map(x => wo(x))) });
  assert.deepEqual(d.alerts, []);
  const row = d.rows.find(r => r.id === 'ana');
  assert.equal(row.month.rate, 1);
  assert.equal(row.week.planned, 3);
  assert.equal(d.rows.length, 1, 'the trainer and disabled accounts are not rows');
  assert.equal(d.totals.atRisk, 0);
});

test('pain is high, discomfort medium, with zone, note and exercise', () => {
  const hurt = wo('2026-09-28');
  hurt.entries[0].fb = { lvl: 'pain', zone: 'Shoulder', note: 'al bajar' };
  const mild = wo('2026-09-25');
  mild.entries[0].fb = { lvl: 'discomfort', zone: 'Knee' };
  const d = dash({ ana: base([...allDays().filter(x => x !== '2026-09-28' && x !== '2026-09-25').map(x => wo(x)), hurt, mild]) });
  assert.deepEqual(d.alerts.map(a => [a.kind, a.severity]), [['pain', 'high'], ['discomfort', 'medium']]);
  assert.equal(d.alerts[0].zone, 'Shoulder');
  assert.equal(d.alerts[0].exId, '0025');
  assert.equal(d.totals.high, 1);
});

test('adherence under 75 % over four weeks', () => {
  const days = allDays().filter((_, i) => i % 2 === 0);   // about half
  const d = dash({ luis: base(days.map(x => wo(x))) });
  const a = d.alerts.find(x => x.kind === 'adherence');
  assert.ok(a, 'adherence alert');
  assert.ok(a.rate < 0.75);
});

test('no workout for 7+ days with a plan; nothing for an athlete without one', () => {
  const d = dash({ eva: base([wo('2026-09-18')]), sin: base([], { week: {} }) }, { noAssign: ['sin'] });
  const idle = d.alerts.find(x => x.kind === 'inactive');
  assert.equal(idle.athlete, 'eva');
  assert.equal(idle.days, 12);
  assert.ok(!d.alerts.some(x => x.athlete === 'sin'));
});

test('sets under the prescribed weight, including a drop set', () => {
  const w1 = wo('2026-09-28');
  w1.entries[0].sets = [{ w: 35, r: 10, done: true }, { w: 40, r: 10, done: true }, { w: 40, r: 10, done: true }, { w: 40, r: 10, done: true }];
  const w2 = wo('2026-09-29', { entries: [{ id: '0027', target: { mode: 'reps', reps: 10, weight: 30, scheme: [{ r: 10, w: 30 }, { r: 15, w: 20 }] }, sets: [{ w: 30, r: 10, done: true }, { w: 15, r: 15, done: true }] }] });
  const d = dash({ ana: base([...allDays().filter(x => x !== '2026-09-28').map(x => wo(x)), w1, w2]) });
  const u = d.alerts.find(x => x.kind === 'underweight');
  assert.equal(u.count, 2);
  assert.deepEqual(u.exIds.sort(), ['0025', '0027']);
});

test('overdue fee, unread messages and a plan not synced yet', () => {
  const d = dash({ ana: base(allDays().map(x => wo(x))), nuevo: {} }, { billing: { ana: { due: '2026-09-25' } }, unread: { ana: 2 } });
  const kinds = d.alerts.filter(a => a.athlete === 'ana').map(a => a.kind).sort();
  assert.deepEqual(kinds, ['fee', 'message']);
  assert.ok(d.alerts.some(a => a.athlete === 'nuevo' && a.kind === 'nosync'));
  assert.equal(d.alerts.find(a => a.kind === 'fee').due, '2026-09-25');
});

test('alerts come most serious first', () => {
  const hurt = wo('2026-09-28'); hurt.entries[0].fb = { lvl: 'pain' };
  const d = dash({ a: base([hurt]), b: base(allDays().map(x => wo(x))) }, { unread: { b: 1 } });
  const order = d.alerts.map(x => x.severity);
  assert.deepEqual(order, [...order].sort((x, y) => ({ high: 0, medium: 1, low: 2 })[x] - ({ high: 0, medium: 1, low: 2 })[y]));
  assert.equal(order[0], 'high');
});

test('idle days and adherence never count from before the first assignment', () => {
  const users = [{ id: 'eva', name: 'Eva' }];
  const common = { users, isAdmin: () => false, readState: () => base([wo('2026-09-18')]), billing: () => null, unread: () => 0, todayFor: () => TODAY };
  const fresh = buildDashboard({ ...common, assignments: () => [{ rid: 'r', since: Date.parse('2026-09-30T09:00:00') }] });
  assert.ok(!fresh.alerts.some(a => a.kind === 'inactive' || a.kind === 'adherence'), 'plan given today: nothing to flag yet');
  assert.equal(fresh.rows[0].idle, 0);
  const old = buildDashboard({ ...common, assignments: () => [{ rid: 'r', since }] });
  assert.equal(old.alerts.find(a => a.kind === 'inactive').days, 12);
});
