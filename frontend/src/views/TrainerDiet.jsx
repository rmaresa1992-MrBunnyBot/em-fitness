import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
import { fmtDate } from '../lib/format.js'
import { toForm, fromForm, formTotals, emptyFood, emptyMeal, fmtMacro, MACROS, restFromTraining, withCatalog } from '../lib/diet.js'
import { searchFoods, defaultPortion } from '../lib/foods.js'
import { confirmSheet } from '../sheets.jsx'
import { Button, TextField, TextArea, Segmented, Switch, Check } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { nav as goTo } from '../lib/nav.js'

// EM Fitness: the trainer writes one athlete's diet, or a template to hand out (the same editor,
// `template` mode). Full screen rather than a sheet — it is a long form, typed on a phone.
// Spanish only, like the rest of the trainer's tools (D6).

const LABEL = { kcal: 'kcal', p: 'Prot. g', c: 'Carb. g', f: 'Grasa g' }
const cloneForm = f => JSON.parse(JSON.stringify(f))
const localISO = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const athletesOnly = users => users.filter(u => !u.admin && !u.disabled)

// Numeric inputs: decimal keypad on phones; the text stays as typed (lib/diet.js num() reads it).
const Num = ({ value, onChange, placeholder, label }) =>
  <TextField inputMode="decimal" value={value} placeholder={placeholder} aria-label={label || placeholder}
    onChange={e => onChange(e.target.value)} style={{ minWidth: 0, textAlign: 'right' }} />

/** The food's name, with suggestions from the catalog (lib/foods.js) while typing. */
function FoodName({ food, onType, onPick }) {
  const [open, setOpen] = useState(false)
  const hits = open && !food.ref ? searchFoods(food.name) : []
  return <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
    <TextField value={food.name} placeholder="Alimento (escribe para buscar)" style={{ width: '100%' }}
      onChange={e => { onType(e.target.value); setOpen(true) }}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} />
    {hits.length > 0 && <div role="listbox" style={{
      position: 'absolute', zIndex: 5, left: 0, right: 0, top: 'calc(100% + 4px)', background: 'var(--surface)',
      border: '1px solid var(--sep)', borderRadius: 'var(--r-sm)', boxShadow: '0 8px 24px rgba(0,0,0,.14)', overflow: 'hidden'
    }}>
      {hits.map(f => <button key={f.id} type="button" role="option"
        // mousedown, not click: the input's blur would close the list before the click lands
        onMouseDown={e => { e.preventDefault(); onPick(f); setOpen(false) }}
        style={{ display: 'flex', justifyContent: 'space-between', gap: 8, width: '100%', padding: '9px 12px', textAlign: 'left', borderTop: '1px solid var(--sep)' }}>
        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{f.name}</span>
        <span className="dim" style={{ fontSize: '.75rem', whiteSpace: 'nowrap' }}>{f.kcal} kcal/100 g{f.piece ? ' · pieza ' + f.piece + ' g' : ''}</span>
      </button>)}
    </div>}
  </div>
}

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

function LoadTemplate({ onPick, close }) {
  const toast = useUI(s => s.toast)
  const [list, setList] = useState(null)
  useEffect(() => { api('/api/trainer/diet-templates').then(d => setList(d.templates)).catch(e => toast(e.message)) }, [])
  const pick = t => api('/api/trainer/diet-template?id=' + encodeURIComponent(t.id))
    .then(({ template }) => { onPick(template.diet); close() }).catch(e => toast(e.message))
  return <>
    <h3>Cargar plantilla</h3>
    <div className="small muted" style={{ margin: '4px 0 10px' }}>Reemplaza lo que hay en el editor; puedes ajustarla antes de enviarla.</div>
    {list === null ? <div className="muted small">Cargando…</div> : <div className="list">
      {list.map(t => <div key={t.id} className="item" onClick={() => pick(t)}>
        <div className="grow"><div className="tt">{t.name}</div><div className="ss">{templateLine(t)}</div></div>
        <Icon name="chevronRight" className="chev" /></div>)}
      {!list.length && <div className="empty small">Aún no tienes plantillas. Créalas en Nutrición → Plantillas.</div>}
    </div>}
  </>
}

export const templateLine = t => [t.meals + (t.meals === 1 ? ' comida' : ' comidas'), t.kcal ? t.kcal + ' kcal/día' : null, t.rest ? 'con día de descanso' : null].filter(Boolean).join(' · ')

/** Hands a saved template out to several athletes at once. */
export function AssignTemplate({ template, close }) {
  const toast = useUI(s => s.toast)
  const [users, setUsers] = useState(null)
  const [diets, setDiets] = useState({})
  const [picked, setPicked] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    Promise.all([api('/api/admin/users'), api('/api/trainer/diets')])
      .then(([u, d]) => { setUsers(athletesOnly(u.users)); setDiets(d.diets) }).catch(e => toast(e.message))
  }, [])
  const flip = id => setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const replacing = [...picked].filter(id => diets[id]).length
  const send = () => {
    setBusy(true)
    api('/api/trainer/diet-template/assign', { method: 'POST', body: JSON.stringify({ id: template.id, athletes: [...picked] }) })
      .then(r => { toast('Enviada a ' + r.sent.length + (r.sent.length === 1 ? ' deportista' : ' deportistas')); close() })
      .catch(e => toast(e.message)).finally(() => setBusy(false))
  }
  return <>
    <h3>Enviar «{template.diet.name}»</h3>
    <div className="small muted" style={{ margin: '4px 0 10px' }}>Cada uno recibe su propia copia. Cambiar la plantilla después no cambia sus dietas.</div>
    {users === null ? <div className="muted small">Cargando…</div> : <div className="list">
      {users.map(u => <div key={u.id} className="item" onClick={() => flip(u.id)}>
        {/* The row handles the tap; the box's own click bubbles up to it, so it must not flip too. */}
        <Check checked={picked.has(u.id)} onChange={() => {}} />
        <div className="grow"><div className="tt">{u.name}</div><div className="ss">{diets[u.id] ? 'Tiene «' + (diets[u.id].name || 'Dieta') + '»: se reemplaza' : 'Sin dieta'}</div></div>
      </div>)}
      {!users.length && <div className="empty small">Todavía no hay deportistas.</div>}
    </div>}
    {replacing > 0 && <div className="small" style={{ color: 'var(--st-soon)', margin: '10px 2px 0' }}>Reemplaza la dieta actual de {replacing === 1 ? '1 deportista' : replacing + ' deportistas'}.</div>}
    <div style={{ height: 12 }} />
    <Button variant="primary" icon="check" disabled={!picked.size || busy} onClick={send}>
      {busy ? 'Enviando…' : picked.size ? 'Enviar a ' + picked.size : 'Elige deportistas'}</Button>
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
        ? [d.name, d.meals.length + ' comidas', d.targets?.kcal ? d.targets.kcal + ' kcal/día' : null, d.rest ? 'con día de descanso' : null, 'versión ' + d.rev].filter(Boolean).join(' · ')
        : 'Sin dieta asignada.'}
    </div>
  </>
}

export default function TrainerDiet({ template = false }) {
  const { id, tid } = useParams()
  const nav = useNavigate()
  // Back to where the editor was opened from: the Nutrición tab or the athlete's sheet.
  const fromNutricion = new URLSearchParams(useLocation().search).get('from') === 'nutricion'
  const backTo = template ? '/nutricion?tab=plantillas' : fromNutricion ? '/nutricion' : '/admin'
  const toast = useUI(s => s.toast)
  const openSheet = useUI(s => s.openSheet)
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(undefined)   // undefined = loading, null = nothing saved yet
  const [form, setForm] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [cur, setCur] = useState('t')              // which day is being edited: training or rest

  useEffect(() => {
    setForm(null); setCur('t'); setDirty(false)
    if (template) {
      if (tid === 'nueva') { setSaved(null); setForm(toForm(null)); return }
      api('/api/trainer/diet-template?id=' + encodeURIComponent(tid))
        .then(({ template: t }) => { setSaved(t); setForm(toForm(t.diet)) })
        .catch(e => { toast(e.message); nav(backTo) })
      return
    }
    Promise.all([api('/api/admin/user?id=' + encodeURIComponent(id)), api('/api/trainer/diet?id=' + encodeURIComponent(id))])
      .then(([u, d]) => { setName(u.user.name); setSaved(d.diet); setForm(toForm(d.diet)) })
      .catch(e => toast(e.message))
  }, [id, tid, template])

  // Closing the tab or reloading with unsent changes asks first.
  useEffect(() => {
    if (!dirty) return
    const h = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  if (!form) return <div className="narrow"><div className="muted small" style={{ padding: 20 }}>Cargando…</div></div>

  const edit = fn => { setForm(f => { const n = cloneForm(f); fn(n); return n }); setDirty(true) }
  // The variant on screen: the training day is the form itself, the rest day lives in form.rest.
  const day = cur === 'r' && form.rest ? form.rest : form
  const onDay = (f, fn) => fn(cur === 'r' && f.rest ? f.rest : f)
  const editFood = (mi, fi, fn) => edit(f => onDay(f, d => { d.meals[mi].foods[fi] = fn(d.meals[mi].foods[fi]) }))

  const back = () => dirty
    ? confirmSheet({ title: template ? '¿Salir sin guardar?' : '¿Salir sin enviar?', message: 'Los cambios se perderán.', confirmText: 'Salir', danger: true, onConfirm: () => nav(backTo) })
    : nav(backTo)

  // What goes to the server, or null (with a toast) when it can't go yet.
  const payload = () => {
    if (!form.meals.length) { toast('Añade al menos una comida'); setCur('t'); return null }
    if (form.rest && !form.rest.meals.length) { toast('El día de descanso no tiene comidas: añade una o desactívalo'); setCur('r'); return null }
    return fromForm(form)
  }

  const send = () => {
    const diet = payload()
    if (!diet) return
    setBusy(true)
    api('/api/trainer/diet', { method: 'PUT', body: JSON.stringify({ athlete: id, diet }) })
      .then(r => { setSaved(r.diet); setForm(toForm(r.diet)); setDirty(false); toast('Dieta enviada a ' + name) })
      .catch(e => toast(e.message))
      .finally(() => setBusy(false))
  }
  const saveTemplate = () => {
    const diet = payload()
    if (!diet) return
    if (!diet.name) { toast('Ponle nombre a la plantilla'); return }
    setBusy(true)
    api('/api/trainer/diet-template', { method: 'PUT', body: JSON.stringify({ id: saved?.id, diet }) })
      .then(({ template: t }) => {
        setSaved(t); setForm(toForm(t.diet)); setDirty(false); toast('Plantilla guardada')
        if (tid === 'nueva') nav('/nutricion/plantilla/' + t.id, { replace: true })
      })
      .catch(e => toast(e.message))
      .finally(() => setBusy(false))
  }
  const saveAsTemplate = () => {
    const diet = payload()
    if (!diet) return
    if (!diet.name) { toast('Ponle nombre a la dieta para guardarla como plantilla'); return }
    api('/api/trainer/diet-template', { method: 'PUT', body: JSON.stringify({ diet }) })
      .then(() => toast('Guardada como plantilla «' + diet.name + '»'))
      .catch(e => toast(e.message))
  }
  const remove = () => template
    ? confirmSheet({
      title: '¿Eliminar la plantilla «' + (saved.diet.name) + '»?', message: 'Las dietas que ya enviaste con ella no cambian.',
      confirmText: 'Eliminar', danger: true,
      onConfirm: () => api('/api/trainer/diet-template?id=' + encodeURIComponent(saved.id), { method: 'DELETE' })
        .then(() => { setDirty(false); toast('Plantilla eliminada'); nav(backTo) }).catch(e => toast(e.message))
    })
    : confirmSheet({
      title: '¿Quitar la dieta de ' + name + '?', message: 'Deja de verla en su teléfono la próxima vez que abra la app.',
      confirmText: 'Quitar', danger: true,
      onConfirm: () => api('/api/trainer/diet?id=' + encodeURIComponent(id), { method: 'DELETE' })
        .then(() => { setSaved(null); setForm(toForm(null)); setCur('t'); setDirty(false); toast('Dieta quitada') })
        .catch(e => toast(e.message))
    })
  const replaceWith = (diet, msg) => { setForm(f => ({ ...toForm(diet), name: diet.name || f.name })); setCur('t'); setDirty(true); toast(msg) }
  const copyFrom = () => openSheet(close => <CopyFrom athlete={id} close={close} onPick={d => replaceWith(d, 'Copiada; revisa y envía')} />)
  const loadTemplate = () => openSheet(close => <LoadTemplate close={close} onPick={d => replaceWith(d, 'Plantilla cargada; revisa y envía')} />)
  const assign = () => openSheet(close => <AssignTemplate template={saved} close={close} />)

  const toggleRest = on => {
    if (on) { edit(f => { f.rest = restFromTraining(f) }); setCur('r'); return }
    confirmSheet({
      title: '¿Quitar el día de descanso?', message: 'Todos los días usarán la dieta de entreno.', confirmText: 'Quitar', danger: true,
      onConfirm: () => { edit(f => { f.rest = null }); setCur('t') }
    })
  }

  const tot = formTotals(form, cur === 'r' && form.rest ? 'r' : 't')
  const linked = [...form.meals, ...(form.rest?.meals || [])].some(m => m.foods.some(f => f.ref))
  const sub = template
    ? (saved ? 'Plantilla · guardada ' + fmtDate(localISO(saved.at)) : 'Plantilla nueva')
    : name + (saved ? ' · versión ' + saved.rev + ' · enviada ' + fmtDate(localISO(saved.at)) : ' · sin dieta todavía')

  return <div className="narrow" style={{ paddingBottom: 40 }}>
    <div className="hdr">
      <button className="iconbtn" onClick={back} aria-label="Volver"><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 8, minWidth: 0 }}><h1 style={{ margin: 0 }}>{template ? 'Plantilla' : 'Dieta'}</h1>
        <div className="sub">{sub}{dirty ? (template ? ' · sin guardar' : ' · sin enviar') : ''}</div></div>
    </div>

    <div className="card">
      <TextField value={form.name} placeholder={template ? 'Nombre de la plantilla (obligatorio)' : 'Nombre (p. ej. Volumen, Definición)'} onChange={e => edit(f => { f.name = e.target.value })} />
      <TextArea value={form.notes} placeholder="Notas para el deportista (agua, suplementos, horarios…)" rows={3} style={{ marginTop: 10 }}
        onChange={e => edit(f => { f.notes = e.target.value })} />
      <div className="row between" style={{ marginTop: 12, gap: 12 }}>
        <div><div style={{ fontWeight: 500 }}>Dieta distinta en días de descanso</div>
          <div className="dim small">Los días sin rutina en su plan usan otra dieta.</div></div>
        <Switch checked={!!form.rest} onChange={toggleRest} />
      </div>
      {form.rest && <div style={{ marginTop: 12 }}><Segmented value={cur} onChange={setCur} className="nocap" options={[{ value: 't', label: 'Día de entreno' }, { value: 'r', label: 'Día de descanso' }]} /></div>}
      <div className="small muted" style={{ margin: '12px 0 6px' }}>Objetivo diario{form.rest ? (cur === 'r' ? ' · descanso' : ' · entreno') : ''}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {MACROS.map(m => <Num key={m} value={day.targets[m]} placeholder={LABEL[m]} onChange={v => edit(f => onDay(f, d => { d.targets[m] = v }))} />)}
      </div>
    </div>

    {day.meals.map((meal, mi) => <div key={meal.id || mi} className="card">
      <div className="row" style={{ gap: 6 }}>
        <TextField value={meal.name} placeholder={'Comida ' + (mi + 1)} style={{ flex: 1, minWidth: 0, fontWeight: 600 }} onChange={e => edit(f => onDay(f, d => { d.meals[mi].name = e.target.value }))} />
        <TextField type="time" value={meal.time} aria-label="Hora" style={{ width: 104 }} onChange={e => edit(f => onDay(f, d => { d.meals[mi].time = e.target.value }))} />
        <button className="iconbtn" aria-label="Quitar comida" style={{ color: 'var(--red)' }}
          onClick={() => confirmSheet({ title: '¿Quitar «' + (meal.name || 'Comida ' + (mi + 1)) + '»?', confirmText: 'Quitar', danger: true, onConfirm: () => edit(f => onDay(f, d => { d.meals.splice(mi, 1) })) })}><Icon name="trash" /></button>
      </div>

      {meal.foods.map((food, fi) => <div key={fi} style={{ borderTop: '1px solid var(--sep)', marginTop: 10, paddingTop: 10 }}>
        <div className="row" style={{ gap: 6 }}>
          <FoodName food={food}
            onType={v => editFood(mi, fi, x => ({ ...x, name: v, ref: '' }))}
            onPick={c => editFood(mi, fi, x => withCatalog({ ...x, name: c.name, ref: c.id, ...(x.qty ? {} : defaultPortion(c)) }))} />
          <button className="iconbtn" aria-label="Quitar alimento" style={{ color: 'var(--label-3)' }} onClick={() => edit(f => onDay(f, d => { d.meals[mi].foods.splice(fi, 1) }))}><Icon name="trash" /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
          <Num value={food.qty} placeholder="Cantidad" onChange={v => editFood(mi, fi, x => withCatalog({ ...x, qty: v }))} />
          <TextField value={food.unit} placeholder="Unidad (g, ml, pieza)" onChange={e => { const v = e.target.value; editFood(mi, fi, x => withCatalog({ ...x, unit: v })) }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 6 }}>
          {/* Typing a figure by hand unlinks the row: from then on it's the trainer's number. */}
          {MACROS.map(m => <Num key={m} value={food[m]} placeholder={LABEL[m]} onChange={v => editFood(mi, fi, x => ({ ...x, [m]: v, ref: '' }))} />)}
        </div>
        {food.ref && <div className="dim" style={{ fontSize: '.72rem', marginTop: 4 }}><Icon name="check" style={{ display: 'inline-block', verticalAlign: '-2px' }} /> Del catálogo: se recalcula con la cantidad (g, ml o pieza)</div>}
      </div>)}
      <Button size="sm" icon="plus" style={{ marginTop: 10 }} onClick={() => edit(f => onDay(f, d => { d.meals[mi].foods.push(emptyFood()) }))}>Alimento</Button>
      <TextArea value={meal.notes} placeholder="Nota de esta comida (opcional)" rows={2} style={{ marginTop: 10 }} onChange={e => edit(f => onDay(f, d => { d.meals[mi].notes = e.target.value }))} />
    </div>)}

    {day.meals.length < 12 && <Button icon="plus" onClick={() => edit(f => onDay(f, d => { d.meals.push(emptyMeal('')) }))}>Añadir comida{form.rest ? (cur === 'r' ? ' al descanso' : ' al entreno') : ''}</Button>}

    <div className="card" style={{ marginTop: 14 }}>
      <div className="small muted">Total del día{form.rest ? (cur === 'r' ? ' de descanso' : ' de entreno') : ''}{tot.missing.length ? ' (hay alimentos sin macros)' : ''}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
        {MACROS.map(m => <div key={m}><div className="dim" style={{ fontSize: '.72rem' }}>{LABEL[m]}</div>
          <div style={{ fontWeight: 600 }}>{fmtMacro(m, tot[m])}{day.targets[m] ? <span className="dim" style={{ fontWeight: 400 }}> / {day.targets[m]}</span> : null}</div></div>)}
      </div>
      {linked && <div className="dim" style={{ fontSize: '.72rem', marginTop: 8 }}>Los valores del catálogo son de referencia y aproximados; corrígelos si conoces los de la marca.</div>}
    </div>

    <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
      {template ? <>
        <Button variant="primary" icon="check" onClick={saveTemplate} disabled={busy}>{busy ? 'Guardando…' : 'Guardar plantilla'}</Button>
        {saved && <Button icon="person" onClick={assign} disabled={dirty} title={dirty ? 'Guarda antes de enviarla' : undefined}>Enviar a deportistas</Button>}
        {saved && <Button variant="danger" onClick={remove}>Eliminar plantilla</Button>}
      </> : <>
        <Button variant="primary" icon="check" onClick={send} disabled={busy}>{busy ? 'Enviando…' : 'Guardar y enviar'}</Button>
        <Button onClick={loadTemplate}>Cargar plantilla</Button>
        <Button onClick={saveAsTemplate}>Guardar como plantilla</Button>
        <Button onClick={copyFrom}>Copiar de otro deportista</Button>
        {saved && <Button variant="danger" onClick={remove}>Quitar dieta</Button>}
      </>}
    </div>
    {template && saved && dirty && <div className="dim small" style={{ marginTop: 8 }}>Guarda los cambios antes de enviarla.</div>}
  </div>
}
