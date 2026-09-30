import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { fmtDate, todayISO } from '../lib/format.js'
import {
  dayTotals, mealTotals, fmtMacro, progress, mealsOf, targetsOf, hasRest, dayVariant, markMeal,
  dietAdherence, recentDietAdherence, addDays, EDIT_DAYS
} from '../lib/diet.js'
import Icon from '../components/Icon.jsx'

// EM Fitness: the athlete's diet. Built for a phone held in one hand at the table: which day it
// is (training or rest, when the trainer set both), the day's target, then one card per meal
// with each food on its own line — and a way to say how each meal went, today or the two days
// before. The trainer sees that as diet adherence (lib/diet.js).

const GRAMS = [['p', 'Protein'], ['c', 'Carbs'], ['f', 'Fat']]
const MARK = [['ok', 'Eaten', 'check'], ['half', 'Partly', 'minus'], ['skip', 'Skipped', 'xmark']]

function Bar({ value }) {
  if (value == null) return null
  const over = value > 1.05
  return <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden', marginTop: 6 }}>
    <div style={{ width: Math.min(100, value * 100) + '%', height: '100%', borderRadius: 3, background: over ? 'var(--red)' : 'var(--acc-fill, var(--acc))', transition: 'width .4s ease' }} />
  </div>
}

// The athlete's own calendar day — toISOString would be UTC, a day off in the evening in América.
const localISO = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// "1.850 / 2.800" when there's a target, just the total when there isn't.
const ofTarget = (m, total, target) => fmtMacro(m, total) + (typeof target === 'number' ? ' / ' + fmtMacro(m, target) : '')

/** The last seven days, oldest first: a bar per day, as full as that day went; today last. */
function WeekStrip({ S, diet, today }) {
  const days = dietAdherence(S, diet, addDays(today, -6), today).days
  const done = recentDietAdherence(S, diet, today)
  return <div className="card">
    <div className="row between" style={{ alignItems: 'baseline' }}>
      <div className="small muted">{t('Diet kept, last 7 days')}</div>
      <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{done.evaluated ? Math.round(done.rate * 100) + ' %' : '—'}</div>
    </div>
    {days.length ? <div style={{ display: 'grid', gridTemplateColumns: `repeat(${days.length}, 1fr)`, gap: 6, marginTop: 10 }}>
      {days.map(d => <div key={d.d} style={{ textAlign: 'center' }}>
        <div style={{ height: 34, borderRadius: 6, background: 'var(--surface-2)', display: 'flex', alignItems: 'flex-end', overflow: 'hidden', outline: d.d === today ? '1.5px solid var(--acc-line, var(--acc))' : 'none' }}>
          <div style={{ width: '100%', height: Math.max(d.logged ? 8 : 0, d.score * 100) + '%', background: 'var(--acc-fill, var(--acc))', opacity: d.d === today ? 0.55 : 1, transition: 'height .4s ease' }} />
        </div>
        <div className="dim" style={{ fontSize: '.68rem', marginTop: 3 }}>{fmtDate(d.d).split(' ')[0]}</div>
      </div>)}
    </div> : <div className="dim small" style={{ marginTop: 6 }}>{t('No full days yet')}</div>}
  </div>
}

export default function Diet() {
  const diet = useStore(s => s.diet)
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const today = todayISO()
  const [iso, setIso] = useState(today)

  if (!diet) return <>
    <div className="hdr"><div><h1>{t('Diet')}</h1></div></div>
    <div className="empty"><div className="ico"><Icon name="apple" /></div>{t('Your trainer hasn’t sent you a diet yet.')}</div>
  </>

  // A day that slid out of reach while the screen stayed open (past midnight) goes back to today.
  const day = iso <= today && iso >= addDays(today, -EDIT_DAYS) ? iso : today
  const v = dayVariant(S, diet, day)
  const meals = mealsOf(diet, v)
  const tot = dayTotals(diet, v)
  const tg = targetsOf(diet, v)
  const marks = S.dietLog?.[day]?.m || {}
  const marked = meals.filter(m => marks[m.id]).length
  const updated = diet.at ? fmtDate(localISO(diet.at)) : null
  const mark = (id, k) => update(s => markMeal(s, diet, day, id, marks[id] === k ? null : k))
  const dayLabel = d => d === today ? t('Today') : d === addDays(today, -1) ? t('Yesterday') : fmtDate(d)

  return <div className="narrow">
    <div className="hdr">
      <div><h1>{t('Diet')}</h1>
        <div className="sub">{[diet.name, updated && t('Updated {0}', updated)].filter(Boolean).join(' · ')}</div></div>
    </div>

    <div className="chips" style={{ margin: '0 0 12px' }}>
      {[0, 1, 2].slice(0, EDIT_DAYS + 1).map(n => addDays(today, -n)).map(d =>
        <button key={d} className={'chip nocap' + (d === day ? ' on' : '')} onClick={() => setIso(d)}>{dayLabel(d)}</button>)}
      {hasRest(diet) && <span className="tag nocap" style={{ alignSelf: 'center', marginLeft: 'auto' }}>
        <Icon name={v === 'r' ? 'moon' : 'dumbbell'} />{t(v === 'r' ? 'Rest day' : 'Training day')}</span>}
    </div>

    <div className="card">
      <div className="small muted">{t('Daily total')}</div>
      <div className="big" style={{ marginTop: 2 }}>{ofTarget('kcal', tot.kcal, tg.kcal)} <span className="small muted">kcal</span></div>
      <Bar value={progress(tot.kcal, tg.kcal)} />
      <div className="tiles" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginTop: 12, marginBottom: 0 }}>
        {GRAMS.map(([m, label]) => <div key={m} className="tile" style={{ padding: 10 }}>
          <div className="l">{t(label)}</div>
          <div className="v" style={{ fontSize: '1.05rem' }}>{ofTarget(m, tot[m], tg[m])} <span className="small muted">g</span></div>
          <Bar value={progress(tot[m], tg[m])} />
        </div>)}
      </div>
      {tot.missing.length > 0 && <div className="dim small" style={{ marginTop: 10 }}>{t('Some foods have no macros, so the totals are approximate.')}</div>}
    </div>

    <WeekStrip S={S} diet={diet} today={today} />

    {diet.notes && <div className="card"><div className="small muted" style={{ marginBottom: 4 }}>{t('Trainer’s notes')}</div>
      <div style={{ whiteSpace: 'pre-wrap' }}>{diet.notes}</div></div>}

    <div className="dim small" style={{ margin: '4px 2px 10px' }}>
      {t('Mark each meal after you eat it — your trainer sees how it goes.')} {meals.length > 0 && t('Marked {0} of {1}', marked, meals.length)}</div>

    {meals.map(meal => {
      const mt = mealTotals(meal)
      const cur = marks[meal.id]
      return <div key={meal.id} className="card" style={cur === 'ok' ? { boxShadow: 'inset 3px 0 0 var(--acc-fill, var(--acc))' } : undefined}>
        <div className="row between" style={{ alignItems: 'baseline' }}>
          <h2 style={{ margin: 0 }}>{meal.name}</h2>
          {meal.time && <span className="tag">{meal.time}</span>}
        </div>
        {meal.foods.length ? <div style={{ marginTop: 8 }}>
          {meal.foods.map((f, j) => <div key={j} className="row between" style={{ padding: '8px 0', borderTop: j ? '1px solid var(--sep)' : 0, gap: 10, alignItems: 'baseline' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 500, overflowWrap: 'anywhere' }}>{f.name}</div>
              {GRAMS.some(([m]) => typeof f[m] === 'number') && <div className="dim" style={{ fontSize: '.75rem' }}>
                {GRAMS.filter(([m]) => typeof f[m] === 'number').map(([m, label]) => t(label).charAt(0) + ' ' + fmtMacro(m, f[m]) + 'g').join(' · ')}</div>}
            </div>
            <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              {typeof f.qty === 'number' && <div className="small">{fmtMacro('p', f.qty)} {f.unit || ''}</div>}
              {typeof f.kcal === 'number' && <div className="dim" style={{ fontSize: '.75rem' }}>{fmtMacro('kcal', f.kcal)} kcal</div>}
            </div>
          </div>)}
          <div className="dim small" style={{ borderTop: '1px solid var(--sep)', paddingTop: 8, marginTop: 2 }}>
            {fmtMacro('kcal', mt.kcal)} kcal · {GRAMS.map(([m, label]) => t(label).charAt(0) + ' ' + fmtMacro(m, mt[m]) + 'g').join(' · ')}</div>
        </div> : null}
        {meal.notes && <div className="small muted" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{meal.notes}</div>}
        <div role="group" aria-label={meal.name} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 12 }}>
          {MARK.map(([k, label, icon]) => <button key={k} type="button" aria-pressed={cur === k} onClick={() => mark(meal.id, k)}
            className={'chip nocap' + (cur === k ? ' on' : '')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, margin: 0, ...(cur === k ? null : { background: 'var(--surface-2)' }) }}>
            <Icon name={icon} />{t(label)}</button>)}
        </div>
      </div>
    })}
  </div>
}
