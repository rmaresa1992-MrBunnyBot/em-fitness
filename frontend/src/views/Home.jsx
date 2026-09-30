import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutine, effectiveRoutineId, streakWeeks, lastBW, setsDoneActive } from '../lib/history.js'
import { fmtNum, fmtDate, todayISO, isoOf, weekKey, DAYS } from '../lib/format.js'
import { t, dateLocale } from '../lib/i18n.js'
import { bwSheet, goalSheet, dayOverrideSheet, calendarSheet, startFlow, loadStarterPlan, bwDeltaColor } from '../sheets.jsx'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { coachAvailable, hasConsent } from '../lib/coach.js'
import { useCoachStatus } from '../lib/coach-api.js'
import { DEMO } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import { Progress } from './Stats.jsx'
import { weekAdherence } from '../lib/adherence.js'
import { isAthlete } from '../lib/roles.js'
import { petStatus, newPet } from '../lib/pet.js'
import Capybara from '../components/Capybara.jsx'
import { MOOD_NAME } from './Pet.jsx'
import { status as billingStatus, fmtMoney, STATE_COLOR } from '../lib/billing.js'

// A job in flight or a proposal waiting is the only reason the Coach interrupts Home. When it
// has nothing to say it renders nothing at all — and it only polls while Home is on screen.
function CoachCard({ nav }) {
  const S = useStore(s => s.S)
  const { job, pending } = useCoachStatus(hasConsent(S))
  if (!hasConsent(S) || (!job && !pending)) return null
  const ready = !!pending
  return <div className="card" style={ready ? { borderColor: 'var(--acc)' } : null}>
    <div className="today-row" onClick={() => nav(ready ? '/coach/proposal' : '/coach')}>
      <div className="row" style={{ gap: 9, minWidth: 0 }}>
        <span className="lrow-i" style={{ background: ready ? 'var(--acc)' : 'var(--orange)' }}><Icon name="sparkles" /></span>
        <div style={{ minWidth: 0 }}>
          <div className="lbl2">{t('Coach')}</div>
          <div className="ttl">{ready
            ? (pending.kind === 'create'
              ? t('Your plan is ready')
              : t(pending.changes?.length === 1 ? '{0} suggestion for you' : '{0} suggestions for you', pending.changes?.length || 0))
            : t('Reading your training…')}</div>
        </div>
      </div>
      {ready ? <span className="tag acc">{t('Review')}</span> : <Icon name="chevronRight" className="chev" />}
    </div>
  </div>
}

// EM Fitness: the chat with the trainer. Always there for a signed-in athlete (it's also how
// they write first), louder with unread messages.
function InboxCard({ nav }) {
  const inbox = useStore(s => s.inbox)
  if (!inbox) return null
  const n = inbox.unread
  return <div className="card tappable em-card" style={{ cursor: 'pointer', ...(n ? { borderColor: 'var(--acc)' } : null) }} onClick={() => nav('/messages')}>
    <div className="row between" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 9, minWidth: 0 }}>
        <span className="lrow-i" style={{ background: n ? 'var(--acc-fill, var(--acc))' : 'var(--surface-3)' }}><Icon name="chat" /></span>
        <div style={{ minWidth: 0 }}>
          <div className="lbl2">{t('Messages')}</div>
          <div className="ttl" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'none' }}>
            {n ? t(n === 1 ? '1 new message from your trainer' : '{0} new messages from your trainer', n)
              : inbox.last ? inbox.last.text : t('Write to your trainer')}</div>
        </div>
      </div>
      {n ? <span className="badge">{n}</span> : <Icon name="chevronRight" className="chev" />}
    </div>
  </div>
}

// EM Fitness: the next monthly fee, when the trainer has set one. Quiet until it's close.
function BillingCard() {
  const billing = useStore(s => s.billing)
  if (!billing) return null
  const { left, state } = billingStatus(billing.due)
  const when = left === 0 ? t('due today') : left === 1 ? t('due tomorrow') : left > 1 ? t('due in {0} days', left)
    : left === -1 ? t('overdue since yesterday') : t('overdue by {0} days', -left)
  return <div className="card em-card">
    <div className="row" style={{ gap: 9 }}>
      <span className="lrow-i" style={{ background: state === 'ok' ? 'var(--surface-3)' : STATE_COLOR[state] }}><Icon name="money" /></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="lbl2">{t('Monthly fee')}</div>
        <div className="ttl" style={{ textTransform: 'none' }}>{fmtMoney(billing.fee)} · {fmtDate(billing.due)}</div>
        <div className="small" style={{ color: state === 'ok' ? 'var(--label-2)' : STATE_COLOR[state], fontWeight: state === 'ok' ? 400 : 500 }}>{when}</div>
      </div>
    </div>
  </div>
}

// EM Fitness fase 6: the capybara on Inicio — how it is at a glance, the way into its place.
function PetCard({ nav }) {
  const S = useStore(s => s.S)
  const st = S.pet ? petStatus(S, todayISO()) : null
  if (!st) return null
  const bar = (v, c) => <div className="meter" style={{ height: 6 }}><i style={{ width: v + '%', background: c }} /></div>
  return <div className="card tappable em-card" style={{ cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center', padding: 12 }} onClick={() => nav('/capibara')}>
    <Capybara mood={st.mood} wear={S.pet.wear || {}} size={88} title={S.pet.name} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="lbl2">{S.pet.name}</div>
      <div className="ttl" style={{ textTransform: 'none' }}>{t(MOOD_NAME[st.mood])}</div>
      <div style={{ display: 'grid', gap: 5, marginTop: 8 }}>
        {bar(st.food, 'var(--acc-fill, var(--acc))')}{bar(st.water, '#3b9ad9')}{bar(st.happy, '#e0567a')}
      </div>
    </div>
    <span className="tag nocap"><Icon name="coin" />{st.coins}</span>
  </div>
}

// EM Fitness: this week's adherence (D16) — the athlete's main indicator.
function AdherenceCard({ nav }) {
  const S = useStore(s => s.S)
  const a = weekAdherence(S, todayISO())
  if (!a.planned) return null
  const pct = Math.round(a.rate * 100)
  const color = a.rate >= 0.75 ? 'var(--st-ok)' : 'var(--st-soon)'
  return <div className="card tappable em-card" style={{ cursor: 'pointer' }} onClick={() => nav('/plan')}>
    <div className="row between">
      <div>
        <div className="lbl2">{t('This week')}</div>
        <div className="ttl">{t('{0} of {1} workouts', a.done, a.planned)}</div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 650, color }}>{pct}%</div>
    </div>
    <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden', marginTop: 10 }}>
      <div style={{ width: pct + '%', height: '100%', borderRadius: 3, background: 'var(--acc-fill, var(--acc))', transition: 'width .4s ease' }} />
    </div>
  </div>
}

// Home = what to do now + a quick glance. Deep charts & history live in Stats.
export default function Home() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const config = useStore(s => s.config)
  const [weekOffset, setWeekOffset] = useState(0)
  const coachOn = coachAvailable(config, user, { demo: DEMO, mobile: MOBILE })
  // EM Fitness: an athlete follows the trainer's schedule and can't rearrange it (D14).
  const athlete = isAthlete(user)
  const syncInbox = useStore(s => s.syncInbox)
  useEffect(() => { syncInbox() }, [])
  // EM Fitness fase 6: every athlete gets a capybara on their first visit (D15).
  const pulledAt = useStore(s => s.pulledAt)
  useEffect(() => { if (pulledAt && isAthlete(user) && !S.pet) useStore.getState().update(s => { if (!s.pet) s.pet = newPet(todayISO()) }) }, [user?.id, !!S.pet, pulledAt])

  const today = new Date()
  const routine = effectiveRoutine(S, todayISO())
  const todayOvr = S.dayPlan[todayISO()] !== undefined
  const bw = lastBW(S)
  const prevBW = S.bodyweight.length > 1 ? S.bodyweight[S.bodyweight.length - 2] : null
  const delta = bw && prevBW ? bw.w - prevBW.w : null

  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)
  const doneDays = new Set(S.workouts.map(w => w.d))
  const strip = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    const iso = isoOf(d)
    const eff = effectiveRoutineId(S, iso), ovr = S.dayPlan[iso] !== undefined, done = doneDays.has(iso)
    const dot = done ? ' done' : ovr && eff ? ' ovr' : eff ? ' plan' : ''
    strip.push(<div key={i} className={'wday' + (iso === todayISO() ? ' today' : '')} onClick={() => athlete ? nav('/plan') : dayOverrideSheet(iso)}>
      <div className="lbl">{t(DAYS[d.getDay()])}</div><div className="num">{d.getDate()}</div><div className={'dot' + dot} /></div>)
  }
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const wkLabel = weekOffset === 0 ? t('This week') : `${monday.getDate()} ${monday.toLocaleDateString(dateLocale(), { month: 'short' })} – ${sunday.getDate()} ${sunday.toLocaleDateString(dateLocale(), { month: 'short' })}`

  const wThisWeek = S.workouts.filter(w => weekKey(w.d) === weekKey(todayISO())).length
  const plannedPerWeek = Object.keys(S.week).filter(k => S.week[k]).length
  const bwPoints = S.bodyweight.slice(-30).map(b => ({ t: b.t || new Date(b.d).getTime(), y: b.w, d: b.d }))

  // today's session shown right under the week strip
  const onToday = () => { if (S.active) nav('/workout'); else if (routine) startFlow(routine.id); else if (athlete) nav('/plan'); else dayOverrideSheet(todayISO()) }

  return <div className="narrow">
    {/* EM Fitness: date above, greeting as the title; Settings lives in the top bar now */}
    <div className="hdr">
      <div><div className="kicker">{today.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1>{user ? t('Hi {0}', user.name) : 'EM Fitness'}</h1></div>
    </div>

    <div className="card">
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setWeekOffset(w => w - 1)} aria-label={t('Previous week')}><Icon name="chevronLeft" /></button>
        <div className="small muted" style={{ fontWeight: 500 }}>{wkLabel}</div>
        <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setWeekOffset(w => w + 1)} aria-label={t('Next week')}><Icon name="chevronRight" /></button>
      </div>
      <div className="week">{strip}</div>
      <div className="today-row" onClick={onToday}>
        <div className="row" style={{ gap: 9, minWidth: 0 }}>
          <span className="lrow-i" style={{ background: S.active ? 'var(--orange)' : routine ? 'var(--acc)' : 'var(--surface-3)' }}>
            <Icon name={S.active ? 'timer' : routine ? glyphOf(routine.emoji) : 'moon'} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="lbl2">{t('Today')}</div>
            <div className="ttl">{S.active ? t('{0} — in progress', S.active.name) : routine ? routine.name : t('Rest day')}{todayOvr && routine ? ' · ' + t('rescheduled') : ''}</div>
          </div>
        </div>
        {/* EM Fitness: the button below says Start/Resume now, so the row only points the way */}
        {S.active || routine ? <Icon name="chevronRight" className="chev" />
          : athlete ? null : <Icon name="plus" className="chev" />}
      </div>
      {/* EM Fitness: the tab bar's centre is Inicio now, so starting lives here. A rest day
          still offers a free session, as the old centre button did. */}
      <div style={{ marginTop: 12 }}>
        {S.active ? <Button variant="primary" icon="play" onClick={() => nav('/workout')}>{t('Resume')}</Button>
          : routine && routine.ex.length ? <Button variant="primary" icon="dumbbell" onClick={() => startFlow(routine.id)}>{t('Start')}</Button>
          : !athlete && <Button icon="dumbbell" onClick={() => nav('/workout')}>{t('Freestyle workout (pick as you go)')}</Button>}
      </div>
    </div>

    {coachOn && <CoachCard nav={nav} />}
    {athlete && <><AdherenceCard nav={nav} /><PetCard nav={nav} /><InboxCard nav={nav} /><BillingCard /></>}

    {athlete && !S.routines.length && !S.active && <div className="card">
      <div className="row" style={{ gap: 10, marginBottom: 6 }}>
        <span className="lrow-i"><Icon name="clipboard" /></span>
        <div className="big" style={{ fontSize: 22 }}>{t('Welcome!')}</div>
      </div>
      <div className="muted small">{t('Your trainer is preparing your routine.')}</div>
    </div>}

    {!athlete && !S.routines.length && !S.active && (
      <div className="card">
        <div className="row" style={{ gap: 10, marginBottom: 6 }}>
          <span className="lrow-i"><Icon name="sparkles" /></span>
          <div className="big" style={{ fontSize: 22 }}>{t('Welcome!')}</div>
        </div>
        <div className="muted small" style={{ marginBottom: 12 }}>{t('Set up your weekly routine to get going — or load a ready-made Push / Pull / Legs plan.')}</div>
        {coachOn && <>
          <Button variant="primary" icon="sparkles" onClick={() => nav(hasConsent(S) ? '/coach/intake' : '/coach')}>{t('Let the Coach build it')}</Button>
          <div style={{ height: 8 }} />
        </>}
        <Button variant={coachOn ? 'plain' : 'primary'} icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (PPL)')}</Button>
        <div style={{ height: 8 }} /><Button onClick={() => nav('/plan')}>{t('Build my own plan')}</Button>
      </div>
    )}

    {/* EM Fitness: Inicio and Progreso are one view — body weight opens the progress half */}
    <h4 className="sec">{t('Stats')}</h4>
    <div className="card">
      <div className="row between" style={{ marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>{t('Body weight')}</h2>
        <div className="row" style={{ gap: 8 }}>
          <Button size="sm" icon="target" style={S.targetW ? { color: 'var(--yellow)' } : undefined} onClick={goalSheet}>{S.targetW ? fmtNum(S.targetW) : t('Goal')}</Button>
          <Button size="sm" icon="plus" onClick={() => bwSheet()}>{t('Log')}</Button>
        </div>
      </div>
      {bw ? <>
        <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
          <div className="big">{fmtNum(bw.w)} <span className="muted" style={{ fontSize: '1rem' }}>{S.unit}</span></div>
          {/* only when it actually moved — an unchanged weight used to read as "− 0" */}
          {!!delta && (
            <span className="small row" style={{ gap: 2, fontWeight: 500, color: bwDeltaColor(delta, bw.w) }}>
              <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} style={{ fontSize: 12 }} />
              {fmtNum(Math.abs(delta))}
            </span>
          )}
          <span className="dim small" style={{ marginLeft: 'auto' }}>{fmtDate(bw.d, true)}</span>
        </div>
        {S.targetW && (
          <div className="small row" style={{ color: 'var(--yellow)', marginTop: 4, gap: 5 }}>
            <Icon name="target" style={{ fontSize: 13 }} />
            <span>{t('Goal')} {fmtNum(S.targetW)} {S.unit} · {Math.abs(S.targetW - bw.w) < 0.05 ? t('reached!') : t(S.targetW > bw.w ? '{0} to gain' : '{0} to lose', fmtNum(Math.abs(S.targetW - bw.w)) + ' ' + S.unit)}</span>
          </div>
        )}
        <div className="chart" style={{ marginTop: 8 }}><LineChart points={bwPoints} h={130} unit={S.unit} goal={S.targetW} /></div>
      </> : <div className="muted small">{t("No entries yet — log your weight to start the curve. It's also asked before every workout.")}</div>}
    </div>

    <Progress />
  </div>
}
