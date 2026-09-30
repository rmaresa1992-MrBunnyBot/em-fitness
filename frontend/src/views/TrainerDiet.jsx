import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
import { fmtDate } from '../lib/format.js'
import { toForm, fromForm, formTotals, emptyFood, emptyMeal, fmtMacro, MACROS } from '../lib/diet.js'
import { confirmSheet } from '../sheets.jsx'
import { Button, TextField, TextArea } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { nav as goTo } from '../lib/nav.js'

// EM Fitness: the trainer writes one athlete's diet. Full screen rather than a sheet — it is a
// long form, typed on a phone. Spanish only, like the rest of the trainer's tools (D6).

const LABEL = { kcal: 'kcal', p: 'Prot. g', c: 'Carb. g', f: 'Grasa g' }
const cloneForm = f => JSON.parse(JSON.stringify(f))
const localISO = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// Numeric inputs: decimal keypad on phones; the text stays as typed (lib/diet.js num() reads it).
const Num = ({ value, onChange, placeholder, label }) =>
  <TextField inputMode="decimal" value={value} placeholder={placeholder} aria-label={label || placeholder}
    onChange={e => onChange(e.target.value)} style={{ minWidth: 0, textAlign: 'right' }} />

function CopyFrom({ athlete, onPick, close }) {
  const toast = useUI(s => s.toast)
  const [users, setUsers] = useState(null)
  useEffect(() => { api('/api/admin/users').then(d => setUsers(d.users.filter(u => u.id !== athlete))).catch(e => toast(e.message)) }, [])
  const pick = u => api('/api/trainer/diet?id=' + encodeURIComponent(u.id)).then(({ diet }) => {
    if (!diet) { toast(u.name + ' no tiene dieta'); return }
    onPick(diet); close()
  }).catch(e => toast(e.message))
  return <>
    <h3>Copiar dieta de…</h3>
    <div className="small muted" style={{ margin: '4px 0 10px' }}>Reemplaza lo que hay en el editor. No se envía hasta que pulses «Guardar y enviar».</div>
    {users === null ? <div className="muted small">Cargando…</div> : <div className="list">
      {users.map(u => <div key={u.id} className="item" onClick={() => pick(u)}><div className="grow"><div className="tt">{u.name}</div></div><Icon name="chevronRight" className="chev" /></div>)}
      {!users.length && <div className="empty small">No hay otros deportistas.</div>}
    </div>}
  </>
}

/** One line about the athlete's diet inside the Admin user sheet, and the way into the editor. */
export function DietSummary({ athlete, close }) {
  const [d, setD] = useState(undefined)
  useEffect(() => { api('/api/trainer/diet?id=' + encodeURIComponent(athlete)).then(r => setD(r.diet)).catch(() => setD(null)) }, [athlete])
  const open = () => { close(); goTo('/admin/diet/' + athlete) }
  return <>
    <div className="row between" style={{ marginTop: 16 }}>
      <h4 className="sec" style={{ margin: 0 }}>Dieta</h4>
      <Button size="sm" icon={d ? 'pencil' : 'plus'} onClick={open}>{d ? 'Editar dieta' : 'Crear dieta'}</Button>
    </div>
    <div className="dim small" style={{ padding: '6px 2px' }}>
      {d === undefined ? 'Cargando…' : d
        ? [d.name, d.meals.length + ' comidas', d.targets?.kcal ? d.targets.kcal + ' kcal/día' : null, 'versión ' + d.rev].filter(Boolean).join(' · ')
        : 'Sin dieta asignada.'}
    </div>
  </>
}

export default function TrainerDiet() {
  const { id } = useParams()
  const nav = useNavigate()
  // Back to where the editor was opened from: the Nutrición tab or the athlete's sheet.
  const backTo = new URLSearchParams(useLocation().search).get('from') === 'nutricion' ? '/nutricion' : '/admin'
  const toast = useUI(s => s.toast)
  const openSheet = useUI(s => s.openSheet)
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(undefined)   // undefined = loading, null = no diet yet
  const [form, setForm] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([api('/api/admin/user?id=' + encodeURIComponent(id)), api('/api/trainer/diet?id=' + encodeURIComponent(id))])
      .then(([u, d]) => { setName(u.user.name); setSaved(d.diet); setForm(toForm(d.diet)) })
      .catch(e => toast(e.message))
  }, [id])

  // Closing the tab or reloading with unsent changes asks first.
  useEffect(() => {
    if (!dirty) return
    const h = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  if (!form) return <div className="narrow"><div className="muted small" style={{ padding: 20 }}>Cargando…</div></div>

  const edit = fn => { setForm(f => { const n = cloneForm(f); fn(n); return n }); setDirty(true) }
  const back = () => dirty
    ? confirmSheet({ title: '¿Salir sin enviar?', message: 'Los cambios de esta dieta se perderán.', confirmText: 'Salir', danger: true, onConfirm: () => nav(backTo) })
    : nav(backTo)

  const send = () => {
    const diet = fromForm(form)
    if (!diet.meals.length) { toast('Añade al menos una comida'); return }
    setBusy(true)
    api('/api/trainer/diet', { method: 'PUT', body: JSON.stringify({ athlete: id, diet }) })
      .then(r => { setSaved(r.diet); setForm(toForm(r.diet)); setDirty(false); toast('Dieta enviada a ' + name) })
      .catch(e => toast(e.message))
      .finally(() => setBusy(false))
  }
  const remove = () => confirmSheet({
    title: '¿Quitar la dieta de ' + name + '?', message: 'Deja de verla en su teléfono la próxima vez que abra la app.',
    confirmText: 'Quitar', danger: true,
    onConfirm: () => api('/api/trainer/diet?id=' + encodeURIComponent(id), { method: 'DELETE' })
      .then(() => { setSaved(null); setForm(toForm(null)); setDirty(false); toast('Dieta quitada') })
      .catch(e => toast(e.message))
  })
  const copyFrom = () => openSheet(close => <CopyFrom athlete={id} close={close}
    onPick={d => { setForm(toForm(d)); setDirty(true); toast('Copiada; revisa y envía') }} />)

  const tot = formTotals(form)

  return <div className="narrow" style={{ paddingBottom: 40 }}>
    <div className="hdr">
      <button className="iconbtn" onClick={back} aria-label="Volver"><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 8, minWidth: 0 }}><h1 style={{ margin: 0 }}>Dieta</h1>
        <div className="sub">{name}{saved ? ' · versión ' + saved.rev + ' · enviada ' + fmtDate(localISO(saved.at)) : ' · sin dieta todavía'}{dirty ? ' · sin enviar' : ''}</div></div>
    </div>

    <div className="card">
      <TextField value={form.name} placeholder="Nombre (p. ej. Volumen, Definición)" onChange={e => edit(f => { f.name = e.target.value })} />
      <div className="small muted" style={{ margin: '12px 0 6px' }}>Objetivo diario</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {MACROS.map(m => <Num key={m} value={form.targets[m]} placeholder={LABEL[m]} onChange={v => edit(f => { f.targets[m] = v })} />)}
      </div>
      <TextArea value={form.notes} placeholder="Notas para el deportista (agua, suplementos, horarios…)" rows={3} style={{ marginTop: 10 }}
        onChange={e => edit(f => { f.notes = e.target.value })} />
    </div>

    {form.meals.map((meal, mi) => <div key={mi} className="card">
      <div className="row" style={{ gap: 6 }}>
        <TextField value={meal.name} placeholder={'Comida ' + (mi + 1)} style={{ flex: 1, minWidth: 0, fontWeight: 600 }} onChange={e => edit(f => { f.meals[mi].name = e.target.value })} />
        <TextField type="time" value={meal.time} aria-label="Hora" style={{ width: 104 }} onChange={e => edit(f => { f.meals[mi].time = e.target.value })} />
        <button className="iconbtn" aria-label="Quitar comida" style={{ color: 'var(--red)' }}
          onClick={() => confirmSheet({ title: '¿Quitar «' + (meal.name || 'Comida ' + (mi + 1)) + '»?', confirmText: 'Quitar', danger: true, onConfirm: () => edit(f => { f.meals.splice(mi, 1) }) })}><Icon name="trash" /></button>
      </div>

      {meal.foods.map((food, fi) => <div key={fi} style={{ borderTop: '1px solid var(--sep)', marginTop: 10, paddingTop: 10 }}>
        <div className="row" style={{ gap: 6 }}>
          <TextField value={food.name} placeholder="Alimento" style={{ flex: 1, minWidth: 0 }} onChange={e => edit(f => { f.meals[mi].foods[fi].name = e.target.value })} />
          <button className="iconbtn" aria-label="Quitar alimento" style={{ color: 'var(--label-3)' }} onClick={() => edit(f => { f.meals[mi].foods.splice(fi, 1) })}><Icon name="trash" /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
          <Num value={food.qty} placeholder="Cantidad" onChange={v => edit(f => { f.meals[mi].foods[fi].qty = v })} />
          <TextField value={food.unit} placeholder="Unidad (g, ml, pieza)" onChange={e => edit(f => { f.meals[mi].foods[fi].unit = e.target.value })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 6 }}>
          {MACROS.map(m => <Num key={m} value={food[m]} placeholder={LABEL[m]} onChange={v => edit(f => { f.meals[mi].foods[fi][m] = v })} />)}
        </div>
      </div>)}
      <Button size="sm" icon="plus" style={{ marginTop: 10 }} onClick={() => edit(f => { f.meals[mi].foods.push(emptyFood()) })}>Alimento</Button>
      <TextArea value={meal.notes} placeholder="Nota de esta comida (opcional)" rows={2} style={{ marginTop: 10 }} onChange={e => edit(f => { f.meals[mi].notes = e.target.value })} />
    </div>)}

    {form.meals.length < 12 && <Button icon="plus" onClick={() => edit(f => { f.meals.push(emptyMeal('')) })}>Añadir comida</Button>}

    <div className="card" style={{ marginTop: 14 }}>
      <div className="small muted">Total del día{tot.missing.length ? ' (hay alimentos sin macros)' : ''}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
        {MACROS.map(m => <div key={m}><div className="dim" style={{ fontSize: '.72rem' }}>{LABEL[m]}</div>
          <div style={{ fontWeight: 600 }}>{fmtMacro(m, tot[m])}{form.targets[m] ? <span className="dim" style={{ fontWeight: 400 }}> / {form.targets[m]}</span> : null}</div></div>)}
      </div>
    </div>

    <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
      <Button variant="primary" icon="check" onClick={send} disabled={busy}>{busy ? 'Enviando…' : 'Guardar y enviar'}</Button>
      <Button onClick={copyFrom}>Copiar de otro deportista</Button>
      {saved && <Button variant="danger" onClick={remove}>Quitar dieta</Button>}
    </div>
  </div>
}
