import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
import { fmtDate } from '../lib/format.js'
import { localISO } from '../lib/billing.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

// EM Fitness: the trainer's Nutrición tab — who has a diet and who still needs one, and the way
// into the diet editor (TrainerDiet.jsx). Spanish only, like the rest of the trainer's tools (D6).

export default function TrainerNutrition() {
  const nav = useNavigate()
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
  const shown = filter === 'with' ? withDiet : filter === 'without' ? without : (users || [])
  const edit = id => nav('/admin/diet/' + id + '?from=nutricion')

  return <div className="narrow">
    <div className="hdr"><div><h1>Nutrición</h1><div className="sub">Las dietas de tus deportistas</div></div></div>
    {!users ? <div className="muted small">Cargando…</div> : <>
      <div className="tiles">
        <div className="tile"><div className="l"><Icon name="apple" />Con dieta</div><div className="v">{withDiet.length}</div></div>
        <div className="tile"><div className="l"><Icon name="info" />Sin dieta</div><div className="v" style={{ color: without.length ? 'var(--st-soon)' : undefined }}>{without.length}</div></div>
      </div>
      <div className="chips" style={{ margin: '4px 0 12px' }}>
        {[['all', 'Todos'], ['without', 'Sin dieta · ' + without.length], ['with', 'Con dieta · ' + withDiet.length]].map(([k, l]) =>
          <button key={k} className={'chip nocap' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{l}</button>)}
      </div>
      <div className="list">
        {shown.map(u => {
          const d = diets[u.id]
          return <div key={u.id} className="item">
            <div className="grow">
              <div className="tt">{u.name}</div>
              <div className="ss">{d
                ? [d.name || 'Dieta', d.meals + (d.meals === 1 ? ' comida' : ' comidas'), d.kcal ? d.kcal + ' kcal/día' : null, 'enviada ' + fmtDate(localISO(d.at))].filter(Boolean).join(' · ')
                : 'Todavía sin dieta'}</div>
            </div>
            <Button size="sm" variant={d ? undefined : 'primary'} icon={d ? 'pencil' : 'plus'} onClick={() => edit(u.id)}>{d ? 'Editar' : 'Crear'}</Button>
          </div>
        })}
        {!shown.length && <div className="empty small">{users.length ? 'Nadie en este filtro.' : 'Todavía no hay deportistas. Créalos en Deportistas.'}</div>}
      </div>
    </>}
  </div>
}
