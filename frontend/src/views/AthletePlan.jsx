import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { exOr } from '../lib/exercises.js'
import { effectiveRoutine, effectiveRoutineId, exLine, supersetUnits, modeOf } from '../lib/history.js'
import { todayISO, isoOf, DAYN, exCount } from '../lib/format.js'
import { t, nameOf, dateLocale } from '../lib/i18n.js'
import { glyphOf } from '../lib/glyphs.js'
import { startFlow } from '../sheets.jsx'
import { Thumb } from '../components/Media.jsx'
import Icon from '../components/Icon.jsx'
import { Button, Segmented } from '../components/ui.jsx'

// EM Fitness: the athlete's Plan (D14). Two views behind two buttons: today's routine (default)
// and the week. Read-only: routines come from the trainer, the athlete follows them.

const WEEK = [1, 2, 3, 4, 5, 6, 0]

/** One routine as the athlete reads it: each exercise with its sets, reps, weights and rest. */
export function RoutineSummary({ routine }) {
  const S = useStore(s => s.S)
  const units = supersetUnits(routine.ex)
  return <div className="list">
    {units.map((u, k) => <div key={k} className={u.length > 1 ? 'card' : undefined} style={u.length > 1 ? { padding: 8, marginBottom: 0 } : undefined}>
      {u.length > 1 && <div className="small muted row" style={{ gap: 5, padding: '2px 4px 8px' }}><Icon name="link" />{t('Superset · do these back-to-back, rest after both')}</div>}
      {u.map(i => {
        const cfg = routine.ex[i], ex = exOr(cfg.id)
        const rest = cfg.rest > 0 ? cfg.rest : S.restSec
        return <div key={i} className="item" style={u.length > 1 ? { marginBottom: 6 } : undefined}>
          <Thumb ex={ex} />
          <div className="grow">
            <div className="tt capitalize">{nameOf(ex)}</div>
            <div className="ss nocap">{exLine(cfg, S.unit)}</div>
            {modeOf(cfg) !== 'cardio' && <div className="ss row" style={{ gap: 4 }}><Icon name="timer" style={{ fontSize: 12 }} />{t('Rest {0} s', rest)}</div>}
          </div>
        </div>
      })}
    </div>)}
  </div>
}

function Today() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const today = todayISO()
  const r = effectiveRoutine(S, today)
  if (S.active) return <div className="card">
    <h2>{t('In progress')}</h2>
    <div className="big" style={{ fontSize: 22, marginBottom: 12 }}>{S.active.name}</div>
    <Button variant="primary" icon="play" onClick={() => nav('/workout')}>{t('Resume')}</Button>
  </div>
  if (!r || !r.ex.length) {
    // The next day with something planned, within a week, so a rest day still says what's next.
    let next = null
    for (let i = 1; i <= 7 && !next; i++) {
      const d = new Date(); d.setDate(d.getDate() + i)
      const nr = effectiveRoutine(S, isoOf(d))
      if (nr) next = { r: nr, d }
    }
    return <>
      <div className="card" style={{ textAlign: 'center', padding: '26px 18px' }}>
        <div style={{ fontSize: 30, color: 'var(--label-2)', display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Icon name="moon" /></div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{t('Rest day')}</div>
        <div className="muted small" style={{ marginTop: 4 }}>{S.routines.length ? t('Recover well — it is part of the plan.') : t('Your trainer is preparing your routine.')}</div>
      </div>
      {next && <>
        <h4 className="sec">{t('Next: {0}, {1}', next.d.toLocaleDateString(dateLocale(), { weekday: 'long' }), next.r.name)}</h4>
        <RoutineSummary routine={next.r} />
      </>}
    </>
  }
  const sets = r.ex.reduce((n, e) => n + (e.sets || 1), 0)
  return <>
    <div className="card">
      <div className="row" style={{ gap: 12 }}>
        <span className="lrow-i" style={{ width: 40, height: 40, borderRadius: 11, fontSize: 22 }}><Icon name={glyphOf(r.emoji)} /></span>
        <div style={{ minWidth: 0 }}>
          <div className="big" style={{ fontSize: 22 }}>{r.name}</div>
          <div className="muted small">{exCount(r.ex.length)} · {t('{0} sets', sets)}</div>
        </div>
      </div>
      <div style={{ height: 14 }} />
      <Button variant="primary" icon="play" onClick={() => startFlow(r.id)}>{t('Start')}</Button>
    </div>
    <h4 className="sec">{t('Exercises')}</h4>
    <RoutineSummary routine={r} />
  </>
}

function Week() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  // This calendar week, Monday first, with today marked.
  const monday = new Date(); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const today = todayISO()
  return <>
    <div className="list">
      {WEEK.map((wd, i) => {
        const d = new Date(monday); d.setDate(monday.getDate() + i)
        const iso = isoOf(d)
        const rid = effectiveRoutineId(S, iso)
        const r = rid ? S.routines.find(x => x.id === rid) : null
        const done = S.workouts.some(w => w.d === iso)
        return <div key={wd} className="item" style={iso === today ? { borderColor: 'var(--acc)' } : undefined}
          onClick={r ? () => nav('/plan/r/' + r.id) : undefined}>
          <div className="grow">
            <div className="tt">{t(DAYN[wd])} <span className="dim small">{d.getDate()}</span></div>
            <div className="ss">{r ? r.name + ' · ' + exCount(r.ex.length) : t('Rest')}</div>
          </div>
          {done && <span className="tag acc"><Icon name="check" />{t('Done')}</span>}
          {r && <Icon name="chevronRight" className="chev" />}
        </div>
      })}
    </div>
  </>
}

export default function AthletePlan() {
  const [view, setView] = useState('today')
  return <>
    <div className="hdr"><div><h1>{t('Plan')}</h1><div className="sub">{t('Set by your trainer')}</div></div></div>
    <Segmented value={view} onChange={setView} options={[
      { value: 'today', label: t('Today’s routine') },
      { value: 'week', label: t('My week') }
    ]} />
    <div style={{ height: 16 }} />
    {view === 'today' ? <Today /> : <Week />}
  </>
}

/** /plan/r/:id for an athlete: the routine to read, not to edit. */
export function AthleteRoutine() {
  const nav = useNavigate()
  const { id } = useParams()
  const r = useStore(s => s.S.routines.find(x => x.id === id))
  if (!r) return <div className="empty">{t('No routines yet.')}</div>
  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/plan')} aria-label={t('Plan')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 12 }}><h1>{r.name}</h1><div className="sub">{exCount(r.ex.length)}</div></div>
    </div>
    <RoutineSummary routine={r} />
  </div>
}
