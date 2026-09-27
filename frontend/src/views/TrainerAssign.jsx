import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
import { assignmentPayload } from '../lib/trainer.js'
import { confirmSheet } from '../sheets.jsx'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { glyphOf } from '../lib/glyphs.js'

// EM Fitness: the trainer's side of routine assignment, shown inside the Admin user sheet.
// Spanish only on purpose, like Admin.jsx is English only: it is the trainer's tool, not part
// of the translated athlete app (D6). The routines offered are the trainer's own — built with
// the normal routine editor — so there is no second editor to keep in step.

const DAYS = [[1, 'L'], [2, 'M'], [3, 'X'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']]
const dayList = days => (days || []).length
  ? DAYS.filter(([d]) => days.includes(d)).map(([, l]) => l).join(' · ')
  : 'sin día fijo'

async function send(athlete, S, routineId, days) {
  const p = assignmentPayload(S, routineId)
  if (!p) throw new Error('Esa rutina ya no existe en tu plan')
  return api('/api/trainer/assign', { method: 'POST', body: JSON.stringify({ athletes: [athlete], ...p, days }) })
}

function AssignForm({ athlete, onDone }) {
  const S = useStore(s => s.S)
  const toast = useUI(s => s.toast)
  const mine = (S.routines || []).filter(r => !r.fromTrainer && (r.ex || []).length)
  const [rid, setRid] = useState(mine[0]?.id || '')
  const [days, setDays] = useState([])
  const [busy, setBusy] = useState(false)
  if (!mine.length) return <div className="dim small">Crea primero una rutina en tu Plan; aquí podrás asignarla.</div>
  const toggle = d => setDays(ds => ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d])
  const go = () => {
    setBusy(true)
    send(athlete, S, rid, days)
      .then(() => { toast('Rutina asignada'); setDays([]); onDone() })
      .catch(e => toast(e.message))
      .finally(() => setBusy(false))
  }
  return <div className="card" style={{ marginTop: 8 }}>
    <div className="chips" style={{ marginBottom: 10 }}>
      {mine.map(r => <button key={r.id} className={'chip' + (r.id === rid ? ' on' : '')} onClick={() => setRid(r.id)}><Icon name={glyphOf(r.emoji)} /> {r.name}</button>)}
    </div>
    <div className="small muted" style={{ marginBottom: 6 }}>Días de la semana</div>
    <div className="chips" style={{ marginBottom: 12 }}>
      {DAYS.map(([d, l]) => <button key={d} className={'chip nocap' + (days.includes(d) ? ' on' : '')} onClick={() => toggle(d)} aria-pressed={days.includes(d)}>{l}</button>)}
    </div>
    <Button variant="primary" size="sm" icon="plus" onClick={go} disabled={busy || !rid}>{busy ? 'Asignando…' : 'Asignar'}</Button>
  </div>
}

export default function TrainerAssign({ athlete }) {
  const S = useStore(s => s.S)
  const toast = useUI(s => s.toast)
  const [list, setList] = useState(null)
  const [adding, setAdding] = useState(false)
  const load = () => api('/api/trainer/assignments?id=' + encodeURIComponent(athlete))
    .then(d => setList(d.assignments)).catch(e => toast(e.message))
  useEffect(() => { load() }, [athlete])

  const update = a => send(athlete, S, a.rid, a.days || [])
    .then(() => { toast('Rutina actualizada'); load() }).catch(e => toast(e.message))
  const withdraw = a => confirmSheet({
    title: '¿Retirar «' + a.routine.name + '»?',
    message: 'Desaparece del plan del deportista la próxima vez que abra la app. Su historial de entrenamientos no se toca.',
    confirmText: 'Retirar', danger: true,
    onConfirm: () => api('/api/trainer/unassign', { method: 'POST', body: JSON.stringify({ athlete, rid: a.rid }) })
      .then(() => { toast('Rutina retirada'); load() }).catch(e => toast(e.message))
  })

  return <>
    <div className="row between" style={{ marginTop: 16 }}>
      <h4 className="sec" style={{ margin: 0 }}>Rutinas asignadas</h4>
      {!adding && <Button size="sm" icon="plus" onClick={() => setAdding(true)}>Asignar rutina</Button>}
    </div>
    {adding && <AssignForm athlete={athlete} onDone={() => { setAdding(false); load() }} />}
    {list === null ? <div className="muted small">Cargando…</div>
      : list.length ? <div className="list" style={{ gap: 0 }}>
        {list.map(a => {
          const source = (S.routines || []).some(r => r.id === a.rid)
          return <div key={a.rid} className="row between" style={{ padding: '9px 2px', borderBottom: '1px solid var(--sep)', gap: 8 }}>
            <div><div className="small" style={{ fontWeight: 600 }}><Icon name={glyphOf(a.routine.emoji)} /> {a.routine.name}</div>
              <div className="dim" style={{ fontSize: '.72rem' }}>{dayList(a.days)} · {a.routine.ex.length} ejercicios · versión {a.rev}{source ? '' : ' · ya no está en tu plan'}</div></div>
            <div className="row" style={{ gap: 6 }}>
              {source && <Button size="sm" onClick={() => update(a)}>Actualizar</Button>}
              <Button size="sm" variant="danger" onClick={() => withdraw(a)}>Retirar</Button>
            </div>
          </div>
        })}
      </div> : <div className="empty small">Sin rutinas asignadas.</div>}
  </>
}
