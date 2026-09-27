import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { fmtDate } from '../lib/format.js'
import { dayTotals, mealTotals, fmtMacro, progress } from '../lib/diet.js'
import Icon from '../components/Icon.jsx'

// EM Fitness: the athlete's diet, read-only. Built for a phone held in one hand at the table:
// the day's target first, then one card per meal with each food on its own line.

const GRAMS = [['p', 'Protein'], ['c', 'Carbs'], ['f', 'Fat']]

function Bar({ value }) {
  if (value == null) return null
  const over = value > 1.05
  return <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden', marginTop: 6 }}>
    <div style={{ width: Math.min(100, value * 100) + '%', height: '100%', borderRadius: 3, background: over ? 'var(--orange, var(--red))' : 'var(--acc)', transition: 'width .4s ease' }} />
  </div>
}

// The athlete's own calendar day — toISOString would be UTC, a day off in the evening in América.
const localISO = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// "1.850 / 2.800" when there's a target, just the total when there isn't.
const ofTarget = (m, total, target) => fmtMacro(m, total) + (typeof target === 'number' ? ' / ' + fmtMacro(m, target) : '')

export default function Diet() {
  const diet = useStore(s => s.diet)

  if (!diet) return <>
    <div className="hdr"><div><h1>{t('Diet')}</h1></div></div>
    <div className="empty"><div className="ico"><Icon name="apple" /></div>{t('Your trainer hasn’t sent you a diet yet.')}</div>
  </>

  const day = dayTotals(diet)
  const tg = diet.targets || {}
  const updated = diet.at ? fmtDate(localISO(diet.at)) : null

  return <div className="narrow">
    <div className="hdr">
      <div><h1>{t('Diet')}</h1>
        <div className="sub">{[diet.name, updated && t('Updated {0}', updated)].filter(Boolean).join(' · ')}</div></div>
    </div>

    <div className="card">
      <div className="small muted">{t('Daily total')}</div>
      <div className="big" style={{ marginTop: 2 }}>{ofTarget('kcal', day.kcal, tg.kcal)} <span className="small muted">kcal</span></div>
      <Bar value={progress(day.kcal, tg.kcal)} />
      <div className="tiles" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginTop: 12, marginBottom: 0 }}>
        {GRAMS.map(([m, label]) => <div key={m} className="tile" style={{ padding: 10 }}>
          <div className="l">{t(label)}</div>
          <div className="v" style={{ fontSize: '1.05rem' }}>{ofTarget(m, day[m], tg[m])} <span className="small muted">g</span></div>
          <Bar value={progress(day[m], tg[m])} />
        </div>)}
      </div>
      {day.missing.length > 0 && <div className="dim small" style={{ marginTop: 10 }}>{t('Some foods have no macros, so the totals are approximate.')}</div>}
    </div>

    {diet.notes && <div className="card"><div className="small muted" style={{ marginBottom: 4 }}>{t('Trainer’s notes')}</div>
      <div style={{ whiteSpace: 'pre-wrap' }}>{diet.notes}</div></div>}

    {diet.meals.map((meal, i) => {
      const mt = mealTotals(meal)
      return <div key={i} className="card">
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
      </div>
    })}
  </div>
}
