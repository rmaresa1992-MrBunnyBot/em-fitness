import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
import { EXIDX } from '../lib/exercises.js'
import { fmtDate } from '../lib/format.js'
import { t, nameOf } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'

// EM Fitness fase 5: the trainer's Inicio is this dashboard — figures on top, then the alerts
// that need a look (api/trainer/dashboard.js), then how each athlete's week is going. Spanish
// only, like the rest of the trainer's tools (D6).

const exName = id => (EXIDX[id] ? nameOf(EXIDX[id]) : 'un ejercicio')
const pct = r => Math.round((r || 0) * 100) + '%'
const SEV = {
  high: { color: 'var(--st-overdue)', icon: 'bolt' },
  medium: { color: 'var(--st-soon)', icon: 'info' },
  low: { color: 'var(--label-2)', icon: 'dot' }
}

/** Title and detail of one alert, and where tapping it goes. */
function describe(a) {
  switch (a.kind) {
    case 'pain':
    case 'discomfort':
      return {
        title: (a.kind === 'pain' ? 'Dolor' : 'Molestia') + (a.zone ? ' · ' + t(a.zone) : ''),
        detail: exName(a.exId) + ' · ' + fmtDate(a.d) + (a.note ? ' — “' + a.note + '”' : '')
      }
    case 'adherence': return { title: 'Cumplimiento ' + pct(a.rate), detail: a.done + ' de ' + a.planned + ' entrenos en las últimas 4 semanas' }
    case 'inactive': return { title: a.days + ' días sin entrenar', detail: 'Tiene sesiones en su plan y no ha completado ninguna' }
    case 'fee': return { title: 'Mensualidad vencida', detail: 'Venció el ' + fmtDate(a.due) }
    case 'underweight': return { title: a.count + ' series por debajo del peso indicado', detail: a.exIds.map(exName).join(', ') }
    case 'message': return { title: a.count === 1 ? '1 mensaje sin leer' : a.count + ' mensajes sin leer', detail: 'Te escribió en el chat', to: '/admin/messages/' + a.athlete }
    case 'nosync': return { title: 'Aún no abre su rutina', detail: 'Tiene rutina asignada pero su app no la ha recibido' }
    default: return { title: a.kind, detail: '' }
  }
}

export default function TrainerDashboard() {
  const nav = useNavigate()
  const toast = useUI(s => s.toast)
  const [d, setD] = useState(null)
  const load = () => api('/api/trainer/dashboard').then(setD).catch(e => toast(e.message))
  // Refreshes every minute while on screen: an alert that shows up mid-session should appear.
  useEffect(() => { load(); const iv = setInterval(load, 60000); return () => clearInterval(iv) }, [])
  const open = id => nav('/admin?u=' + encodeURIComponent(id))
  const today = new Date()

  return <div className="narrow">
    <div className="hdr">
      <div><div className="kicker">{today.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</div><h1>Tablero</h1></div>
      <button className="iconbtn" onClick={load} aria-label="Actualizar">↻</button>
    </div>
    {!d ? <div className="muted small">Cargando…</div> : <>
      <div className="tiles">
        <div className="tile"><div className="l"><Icon name="person" />Deportistas</div><div className="v">{d.totals.athletes}</div></div>
        <div className="tile"><div className="l"><Icon name="calendar" />Semana</div>
          <div className="v">{d.totals.weekPlanned ? pct(d.totals.weekDone / d.totals.weekPlanned) : '—'}</div>
          <div className="dim" style={{ fontSize: '.72rem', marginTop: 2 }}>{d.totals.weekDone} de {d.totals.weekPlanned} entrenos</div></div>
        <div className="tile"><div className="l"><Icon name="info" />Requieren atención</div><div className="v" style={{ color: d.totals.atRisk ? 'var(--st-soon)' : undefined }}>{d.totals.atRisk}</div></div>
        <div className="tile"><div className="l"><Icon name="bolt" />Dolor reportado</div><div className="v" style={{ color: d.totals.high ? 'var(--st-overdue)' : undefined }}>{d.totals.high}</div></div>
      </div>

      <h4 className="sec">Alertas</h4>
      {d.alerts.length ? <div className="list">
        {d.alerts.map((a, i) => {
          const x = describe(a), sev = SEV[a.severity]
          return <div key={i} className="item" style={{ cursor: 'pointer', borderLeft: '3px solid ' + sev.color }} onClick={() => x.to ? nav(x.to) : open(a.athlete)}>
            <span style={{ color: sev.color, fontSize: 18, flex: 'none', display: 'flex' }}><Icon name={sev.icon} /></span>
            <div className="grow">
              <div className="tt"><b style={{ fontWeight: 600 }}>{a.name}</b> · <span style={{ color: sev.color }}>{x.title}</span></div>
              <div className="ss">{x.detail}</div>
            </div>
            <Icon name="chevronRight" className="chev" />
          </div>
        })}
      </div> : <div className="card small muted">Todo en orden: nadie reportó molestias, todos van al día con sus entrenos y sus pagos.</div>}

      <h4 className="sec">La semana de cada deportista</h4>
      <div className="list">
        {d.rows.map(r => {
          const rate = r.week.planned ? r.week.done / r.week.planned : null
          return <div key={r.id} className="item" style={{ cursor: 'pointer' }} onClick={() => open(r.id)}>
            <div className="grow">
              <div className="row between" style={{ gap: 8 }}>
                <span className="tt">{r.name}</span>
                <span className="small" style={{ fontWeight: 600 }}>{r.week.planned ? r.week.done + '/' + r.week.planned : 'sin plan'}</span>
              </div>
              {r.week.planned > 0 && <div style={{ height: 5, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden', margin: '6px 0 4px' }}>
                <div style={{ width: pct(rate), height: '100%', background: 'var(--acc-fill, var(--acc))', borderRadius: 3 }} />
              </div>}
              <div className="ss">{r.lastWorkout ? 'Último entreno ' + fmtDate(r.lastWorkout) : 'Sin entrenos todavía'}
                {r.month.rate != null ? ' · 4 semanas ' + pct(r.month.rate) : ''}</div>
            </div>
            <Icon name="chevronRight" className="chev" />
          </div>
        })}
        {!d.rows.length && <div className="empty small">Todavía no hay deportistas. Créalos en Deportistas.</div>}
      </div>
    </>}
  </div>
}
