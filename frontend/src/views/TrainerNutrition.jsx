import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
import { fmtDate } from '../lib/format.js'
import { localISO } from '../lib/billing.js'
import Icon from '../components/Icon.jsx'
import { Button, Segmented } from '../components/ui.jsx'
import { AssignTemplate, templateLine } from './TrainerDiet.jsx'

// EM Fitness: the trainer's Nutrición tab — who has a diet, who still needs one and how well
// each athlete has kept to it over the last 7 days; and the templates to hand out. The way into
// the diet editor (TrainerDiet.jsx). Spanish only, like the rest of the trainer's tools (D6).

const pct = r => Math.round(r * 100) + ' %'
// Same line as the other alerts: under 75 % is worth a look (D16, D18).
const tone = r => (r == null ? 'var(--label-3)' : r < 0.75 ? 'var(--st-soon)' : 'var(--st-ok)')

/** Seven small squares, oldest first: filled by the day's score, hollow when nothing was marked. */
function Week({ days }) {
  return <span style={{ display: 'inline-flex', gap: 3, verticalAlign: 'middle' }} aria-hidden="true">
    {days.map(d => <i key={d.d} title={d.d} style={{
      width: 9, height: 9, borderRadius: 2, display: 'inline-block',
      border: '1px solid ' + (d.logged ? 'transparent' : 'var(--sep)'),
      background: d.logged ? `color-mix(in srgb, var(--acc-fill, var(--acc)) ${Math.round(15 + d.score * 85)}%, transparent)` : 'transparent'
    }} />)}
  </span>
}

function Athletes({ nav }) {
  const toast = useUI(s => s.toast)
  const [users, setUsers] = useState(null)
  const [diets, setDiets] = useState({})
  const [filter, setFilter] = useState('all')
  useEffect(() => {
    Promise.all([api('/api/admin/users'), api('/api/trainer/diets')])
      .then(([u, d]) => { setUsers(u.users.filter(x => !x.admin && !x.disabled)); setDiets(d.diets) })
      .catch(e => toast(e.message))
  }, [])

  const withDiet = (users || []).filter(u => diets[u.id])
  const without = (users || []).filter(u => !diets[u.id])
  const low = withDiet.filter(u => diets[u.id].adherence?.evaluated >= 3 && diets[u.id].adherence.rate < 0.75)
  const shown = filter === 'with' ? withDiet : filter === 'without' ? without : filter === 'low' ? low : (users || [])
  const edit = id => nav('/admin/diet/' + id + '?from=nutricion')

  if (!users) return <div className="muted small">Cargando…</div>
  return <>
    <div className="tiles">
      <div className="tile"><div className="l"><Icon name="apple" />Con dieta</div><div className="v">{withDiet.length}</div></div>
      <div className="tile"><div className="l"><Icon name="info" />Sin dieta</div><div className="v" style={{ color: without.length ? 'var(--st-soon)' : undefined }}>{without.length}</div></div>
    </div>
    <div className="chips" style={{ margin: '4px 0 12px' }}>
      {[['all', 'Todos'], ['without', 'Sin dieta · ' + without.length], ['with', 'Con dieta · ' + withDiet.length], ['low', 'Bajo 75 % · ' + low.length]].map(([k, l]) =>
        <button key={k} className={'chip nocap' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{l}</button>)}
    </div>
    <div className="list">
      {shown.map(u => {
        const d = diets[u.id]
        const a = d?.adherence
        return <div key={u.id} className="item">
          <div className="grow">
            <div className="tt">{u.name}</div>
            <div className="ss">{d
              ? [d.name || 'Dieta', d.meals + (d.meals === 1 ? ' comida' : ' comidas'), d.kcal ? d.kcal + ' kcal/día' : null, d.rest ? 'con descanso' : null, 'enviada ' + fmtDate(localISO(d.at))].filter(Boolean).join(' · ')
              : 'Todavía sin dieta'}</div>
            {d && <div className="small" style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {a?.evaluated ? <>
                <Week days={a.days} />
                <span style={{ color: tone(a.rate), fontWeight: 600 }}>{pct(a.rate)}</span>
                <span className="dim">{a.evaluated < 7 ? 'en ' + a.evaluated + (a.evaluated === 1 ? ' día' : ' días') : 'últimos 7 días'}{a.logged < a.evaluated ? ' · ' + (a.evaluated - a.logged) + ' sin registrar' : ''}</span>
              </> : <span className="dim">Cumplimiento: aún sin días completos</span>}
            </div>}
          </div>
          <Button size="sm" variant={d ? undefined : 'primary'} icon={d ? 'pencil' : 'plus'} onClick={() => edit(u.id)}>{d ? 'Editar' : 'Crear'}</Button>
        </div>
      })}
      {!shown.length && <div className="empty small">{users.length ? 'Nadie en este filtro.' : 'Todavía no hay deportistas. Créalos en Deportistas.'}</div>}
    </div>
  </>
}

function Templates({ nav }) {
  const toast = useUI(s => s.toast)
  const openSheet = useUI(s => s.openSheet)
  const [list, setList] = useState(null)
  useEffect(() => { api('/api/trainer/diet-templates').then(d => setList(d.templates)).catch(e => toast(e.message)) }, [])
  const assign = t => api('/api/trainer/diet-template?id=' + encodeURIComponent(t.id))
    .then(({ template }) => openSheet(close => <AssignTemplate template={template} close={close} />))
    .catch(e => toast(e.message))

  if (!list) return <div className="muted small">Cargando…</div>
  return <>
    <div className="small muted" style={{ margin: '0 2px 12px' }}>Dietas modelo para enviar a varios deportistas. Cada uno recibe su copia y puedes ajustarla después en su ficha.</div>
    <Button variant="primary" icon="plus" onClick={() => nav('/nutricion/plantilla/nueva')}>Nueva plantilla</Button>
    <div className="list" style={{ marginTop: 12 }}>
      {list.map(t => <div key={t.id} className="item" onClick={() => nav('/nutricion/plantilla/' + t.id)}>
        <div className="grow"><div className="tt">{t.name}</div><div className="ss">{templateLine(t)} · {fmtDate(localISO(t.at))}</div></div>
        <Button size="sm" icon="person" onClick={e => { e.stopPropagation(); assign(t) }}>Enviar</Button>
      </div>)}
      {!list.length && <div className="empty small">Aún no tienes plantillas. Crea una, o guarda la dieta de un deportista como plantilla desde su editor.</div>}
    </div>
  </>
}

export default function TrainerNutrition() {
  const nav = useNavigate()
  const tab = new URLSearchParams(useLocation().search).get('tab') === 'plantillas' ? 'plantillas' : 'deportistas'
  const setTab = v => nav('/nutricion' + (v === 'plantillas' ? '?tab=plantillas' : ''), { replace: true })

  return <div className="narrow">
    <div className="hdr"><div><h1>Nutrición</h1><div className="sub">Las dietas de tus deportistas</div></div></div>
    <div style={{ marginBottom: 12 }}>
      <Segmented value={tab} onChange={setTab} className="nocap" options={[{ value: 'deportistas', label: 'Deportistas' }, { value: 'plantillas', label: 'Plantillas' }]} />
    </div>
    {tab === 'plantillas' ? <Templates nav={nav} /> : <Athletes nav={nav} />}
  </div>
}
