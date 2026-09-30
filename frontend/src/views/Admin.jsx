import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { EXIDX } from '../lib/exercises.js'
import { nameOf } from '../lib/i18n.js'
import { deviations } from '../lib/history.js'
import { fbLabel } from '../lib/feedback.js'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
import { fmtDate, fmtNum, fmtVol, fmtDur } from '../lib/format.js'
import { workoutVolume, setsDone } from '../lib/history.js'
import { confirmSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button, TextField } from '../components/ui.jsx'
import AdminCoach from './AdminCoach.jsx'
import TrainerAssign from './TrainerAssign.jsx'
import { DietSummary } from './TrainerDiet.jsx'
import { BillingSection, BillingTag, dueText } from './TrainerBilling.jsx'
import { BroadcastSheet } from './TrainerMessages.jsx'
import { stateOf, STATE_COLOR } from '../lib/billing.js'
import { nav as goTo } from '../lib/nav.js'

// Admin-only operator dashboard (owner passkey + admin flag; guarded again server-side).
// Outside the per-language string packs on purpose (upstream kept it English-only). EM Fitness
// runs it in Spanish, the trainer's language (D6).

const rel = ts => {
  if (!ts) return 'nunca'
  const s = Math.max(0, (Date.now() - ts) / 1000)
  if (s < 60) return 'ahora'
  if (s < 3600) return 'hace ' + Math.floor(s / 60) + ' min'
  if (s < 86400) return 'hace ' + Math.floor(s / 3600) + ' h'
  return 'hace ' + Math.floor(s / 86400) + ' d'
}
const dur = ms => { const m = Math.max(0, Math.floor(ms / 60000)); return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h' + (m % 60) + 'm' }

// EM Fitness: username + password accounts (api/auth/). A readable first password the
// trainer can dictate: no 0/O or 1/l/I to mix up.
const genPassword = () => {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789'
  const r = crypto.getRandomValues(new Uint32Array(10))
  return Array.from(r, n => abc[n % abc.length]).join('')
}
const suggestUsername = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .trim().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '').slice(0, 32)

function CopyBox({ username, password }) {
  const toast = useUI(s => s.toast)
  const text = 'EM Fitness\nUsuario: ' + username + '\nContraseña: ' + password
  return <div className="card" style={{ background: 'var(--surface-2)', margin: '12px 0 0' }}>
    <div className="small" style={{ fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', lineHeight: 1.6 }}>
      Usuario: <b>{username}</b><br />Contraseña: <b>{password}</b>
    </div>
    <div className="dim" style={{ fontSize: '.75rem', margin: '6px 0 8px' }}>Pásaselos ahora: la contraseña no se vuelve a mostrar. Puede cambiarla en Ajustes.</div>
    <Button size="sm" icon="download" onClick={() => navigator.clipboard?.writeText(text).then(() => toast('Datos copiados')).catch(() => toast('No se pudo copiar'))}>Copiar datos de acceso</Button>
  </div>
}

// Username and password inputs: no capitalisation, no autocorrect, monospace for the password
// so a dictated one reads unambiguously.
const plainField = { textTransform: 'none' }
const monoField = { textTransform: 'none', fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace' }

function PasswordField({ id, value, onChange }) {
  return <div className="row" style={{ gap: 8 }}>
    <TextField id={id} value={value} maxLength={200} autoComplete="off" spellCheck={false} style={monoField} onChange={e => onChange(e.target.value)} />
    <button className="iconbtn" onClick={() => onChange(genPassword())} aria-label="Generar otra contraseña"><Icon name="shuffle" /></button>
  </div>
}

function NewAthleteSheet({ close, onCreated }) {
  const toast = useUI(s => s.toast)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [edited, setEdited] = useState(false)
  const [password, setPassword] = useState(genPassword)
  const [done, setDone] = useState(null)
  const create = () => api('/api/admin/athletes/new', { method: 'POST', body: JSON.stringify({ name: name.trim(), username, password }) })
    .then(r => { setDone({ username: r.user.username, password }); onCreated() })
    .catch(e => toast(e.message))
  if (done) return <>
    <h3>Deportista creado</h3>
    <CopyBox {...done} />
    <div style={{ height: 12 }} /><Button onClick={close}>Listo</Button>
  </>
  return <>
    <h3>Nuevo deportista</h3>
    <div className="small muted" style={{ margin: '4px 0 12px' }}>Entrará por «Soy deportista» con este usuario y contraseña.</div>
    <label className="small muted" htmlFor="na">Nombre</label>
    <TextField id="na" value={name} maxLength={40} placeholder="Ana García" autoComplete="off"
      onChange={e => { setName(e.target.value); if (!edited) setUsername(suggestUsername(e.target.value)) }} />
    <div style={{ height: 10 }} />
    <label className="small muted" htmlFor="nu">Usuario</label>
    <TextField id="nu" value={username} maxLength={32} placeholder="ana.garcia" autoCapitalize="none" autoComplete="off" spellCheck={false}
      style={plainField} onChange={e => { setEdited(true); setUsername(e.target.value.toLowerCase()) }} />
    <div style={{ height: 10 }} />
    <label className="small muted" htmlFor="np">Contraseña inicial</label>
    <PasswordField id="np" value={password} onChange={setPassword} />
    <div style={{ height: 14 }} />
    <Button variant="primary" icon="plus" disabled={!name.trim() || username.length < 3 || password.length < 8} onClick={create}>Crear deportista</Button>
  </>
}

function AccessSheet({ u, close, onSaved }) {
  const toast = useUI(s => s.toast)
  const [username, setUsername] = useState(u.username || suggestUsername(u.name))
  const [password, setPassword] = useState(genPassword)
  const [done, setDone] = useState(null)
  const save = () => api('/api/admin/user/credentials', { method: 'POST', body: JSON.stringify({ id: u.id, username, password }) })
    .then(r => { setDone({ username: r.user.username, password }); onSaved() })
    .catch(e => toast(e.message))
  if (done) return <>
    <h3>Acceso actualizado</h3>
    <CopyBox {...done} />
    <div style={{ height: 12 }} /><Button onClick={close}>Listo</Button>
  </>
  return <>
    <h3>{u.hasPassword ? 'Nueva contraseña' : 'Dar usuario y contraseña'}</h3>
    <div className="small muted" style={{ margin: '4px 0 12px' }}>{u.hasPassword
      ? 'Se cierra su sesión en todos sus dispositivos y tendrá que entrar con la nueva.'
      : 'Podrá entrar con usuario y contraseña además de con su passkey.'}</div>
    <label className="small muted" htmlFor="au">Usuario</label>
    <TextField id="au" value={username} maxLength={32} autoCapitalize="none" autoComplete="off" spellCheck={false}
      style={plainField} onChange={e => setUsername(e.target.value.toLowerCase())} />
    <div style={{ height: 10 }} />
    <label className="small muted" htmlFor="ap">Contraseña</label>
    <PasswordField id="ap" value={password} onChange={setPassword} />
    <div style={{ height: 14 }} />
    <Button variant="primary" disabled={username.length < 3 || password.length < 8} onClick={save}>Guardar</Button>
  </>
}

// EM Fitness fase 5: adherence and discomfort reports for one athlete, from the dashboard.
const pctOf = r => (r == null ? '—' : Math.round(r * 100) + '%')
const exName = id => (EXIDX[id] ? nameOf(EXIDX[id]) : 'un ejercicio')
function FollowUp({ athlete }) {
  const [row, setRow] = useState(undefined)
  useEffect(() => { api('/api/trainer/dashboard').then(d => setRow(d.rows.find(r => r.id === athlete) || null)).catch(() => setRow(null)) }, [athlete])
  if (row === undefined) return <div className="dim small" style={{ padding: '6px 2px' }}>Cargando seguimiento…</div>
  if (!row) return null
  return <>
    <h4 className="sec" style={{ marginTop: 16 }}>Seguimiento</h4>
    <div className="tiles" style={{ textAlign: 'left' }}>
      <div className="tile"><div className="l">Esta semana</div><div className="v" style={{ fontSize: '1.1rem' }}>{row.week.planned ? row.week.done + ' de ' + row.week.planned : 'sin plan'}</div></div>
      <div className="tile"><div className="l">4 semanas</div><div className="v" style={{ fontSize: '1.1rem', color: row.month.rate != null && row.month.rate < 0.75 ? 'var(--st-soon)' : undefined }}>{pctOf(row.month.rate)}</div></div>
    </div>
    {row.reports.length > 0 && <div className="list" style={{ gap: 0, marginBottom: 6 }}>
      {row.reports.map((r, i) => <div key={i} className="small" style={{ padding: '7px 2px', borderBottom: '1px solid var(--sep)', color: r.lvl === 'pain' ? 'var(--st-overdue)' : 'var(--st-soon)' }}>
        <b style={{ fontWeight: 600 }}>{fbLabel(r)}</b> · {exName(r.exId)} · {fmtDate(r.d)}{r.note ? ' — “' + r.note + '”' : ''}
      </div>)}
    </div>}
    {!row.synced && <div className="small" style={{ color: 'var(--st-soon)' }}>Tiene rutina asignada pero aún no abrió la app para recibirla.</div>}
  </>
}

function UserDetail({ id, onChanged, close }) {
  const [d, setD] = useState(null)
  const toast = useUI(s => s.toast)
  const openSheet = useUI(s => s.openSheet)
  const load = () => api('/api/admin/user?id=' + encodeURIComponent(id)).then(setD).catch(e => toast(e.message))
  useEffect(() => { load() }, [id])
  if (!d) return <div className="muted small">Cargando…</div>
  const u = d.user
  const setDisabled = disabled => {
    api('/api/admin/user/disable', { method: 'POST', body: JSON.stringify({ id: u.id, disabled }) })
      .then(() => { toast(disabled ? 'Usuario desactivado' : 'Usuario activado'); onChanged(); close() })
      .catch(e => toast(e.message))
  }
  return <>
    <h3 className="capitalize">{u.name}</h3>
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '8px 0 12px' }}>
      {u.admin && <span className="tag acc">entrenador</span>}
      {u.disabled && <span className="tag" style={{ color: 'var(--red)' }}>desactivado</span>}
      {u.invitedBy && <span className="tag">invitación {u.invitedBy}</span>}
      <span className="tag">alta {u.created ? fmtDate(u.created.slice(0, 10)) : '—'}</span>
      {u.username && <span className="tag" style={{ textTransform: 'none' }}>@{u.username}</span>}
    </div>
    {!u.admin && <div className="row" style={{ gap: 8, marginBottom: 12 }}>
      <Button size="sm" variant="primary" icon="chat" onClick={() => { close(); goTo('/admin/messages/' + u.id) }}>Mensajes</Button>
      <Button size="sm" icon="key" onClick={() => openSheet(c => <AccessSheet u={u} close={c} onSaved={() => { load(); onChanged() }} />)}>
        {u.hasPassword ? 'Nueva contraseña' : 'Dar acceso'}</Button>
    </div>}
    <div className="tiles" style={{ textAlign: 'left' }}>
      <div className="tile"><div className="l">Entrenos</div><div className="v" style={{ fontSize: '1.1rem' }}>{d.workouts.length}</div></div>
      <div className="tile"><div className="l">Pesajes</div><div className="v" style={{ fontSize: '1.1rem' }}>{d.bodyweight.length}</div></div>
      <div className="tile"><div className="l">Rutinas</div><div className="v" style={{ fontSize: '1.1rem' }}>{d.routines.length}</div></div>
      <div className="tile"><div className="l">Última sincr.</div><div className="v" style={{ fontSize: '.95rem' }}>{rel(d.lastSync)}</div></div>
    </div>
    {!u.admin && <button className={'btn ' + (u.disabled ? 'primary' : 'danger')} style={{ margin: '12px 0 4px' }}
      onClick={() => u.disabled ? setDisabled(false)
        : confirmSheet({ title: '¿Desactivar a ' + u.name + '?', message: 'Se cierra su sesión en todos sus dispositivos y no podrá entrar ni sincronizar hasta que lo reactives.', confirmText: 'Desactivar', danger: true, onConfirm: () => setDisabled(true) })}>
      {u.disabled ? 'Reactivar cuenta' : 'Desactivar cuenta'}</button>}
    {!u.admin && <FollowUp athlete={u.id} />}
    {!u.admin && <BillingSection athlete={u.id} onChanged={onChanged} />}
    <TrainerAssign athlete={u.id} />
    <DietSummary athlete={u.id} close={close} />
    <h4 className="sec">Historial de entrenos</h4>
    {d.workouts.length ? <div className="list" style={{ gap: 0 }}>
      {d.workouts.slice(0, 60).map(w => <div key={w.id} className="row between" style={{ padding: '9px 2px', borderBottom: '1px solid var(--sep)' }}>
        <div><div className="small" style={{ fontWeight: 600 }}>{w.name}</div>
          <div className="dim" style={{ fontSize: '.72rem' }}>{fmtDate(w.d, true)} · {fmtDur((w.end || w.start) - w.start)} · {setsDone(w)}{w.setsPlanned ? ' de ' + w.setsPlanned : ''} series{w.prs?.length ? ' · ' + w.prs.length + ' récord' + (w.prs.length > 1 ? 's' : '') : ''}</div>
          {(w.entries || []).map(e => {
            const under = deviations(e).filter(x => (x.set.w || 0) < x.planned.w)
            if (!e.fb && !under.length) return null
            return <div key={e.id} style={{ fontSize: '.72rem', marginTop: 2, color: e.fb?.lvl === 'pain' ? 'var(--st-overdue)' : 'var(--st-soon)' }}>
              {exName(e.id)}: {[e.fb ? fbLabel(e.fb) + (e.fb.note ? ' “' + e.fb.note + '”' : '') : null,
                under.length ? under.map(x => 'serie ' + (x.i + 1) + ' ' + (x.set.w || 0) + ' de ' + x.planned.w + ' ' + d.unit).join(', ') : null].filter(Boolean).join(' · ')}
            </div>
          })}</div>
        <span className="small muted">{fmtVol(w.vol ?? workoutVolume(w), d.unit)}</span>
      </div>)}
    </div> : <div className="empty small">Sin entrenos registrados.</div>}
  </>
}

function InvitesCard({ invites, reload }) {
  const toast = useUI(s => s.toast)
  const gen = () => api('/api/admin/invites/new', { method: 'POST', body: '{}' })
    .then(({ invite }) => { navigator.clipboard?.writeText(invite.code).catch(() => {}); toast('Código ' + invite.code + ' creado y copiado'); reload() })
    .catch(e => toast(e.message))
  const revoke = code => api('/api/admin/invites/revoke', { method: 'POST', body: JSON.stringify({ code }) })
    .then(() => { toast('Código revocado'); reload() }).catch(e => toast(e.message))
  const open = (invites || []).filter(i => !i.usedBy)
  const used = (invites || []).filter(i => i.usedBy)
  return <div className="card">
    <div className="row between"><h2 style={{ margin: 0 }}>Códigos de invitación</h2>
      <Button variant="primary" size="sm" onClick={gen} icon="plus">Generar</Button></div>
    <div className="small muted" style={{ margin: '6px 0 10px' }}>{open.length} sin usar · {used.length} usados</div>
    {open.map(i => <div key={i.code} className="row between" style={{ padding: '7px 2px', borderBottom: '1px solid var(--sep)' }}>
      <span style={{ fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', fontWeight: 500, letterSpacing: '.06em' }}
        onClick={() => { navigator.clipboard?.writeText(i.code).catch(() => {}); toast('Copiado ' + i.code) }}>{i.code}</span>
      <button className="iconbtn" style={{ width: 32, height: 30, borderRadius: 8, fontSize: 15, color: 'var(--red)' }} onClick={() => revoke(i.code)} aria-label="revocar"><Icon name="trash" /></button>
    </div>)}
    {used.map(i => <div key={i.code} className="row between dim" style={{ padding: '7px 2px', fontSize: '.8rem' }}>
      <span style={{ fontFamily: 'monospace' }}>{i.code}</span><span>→ {i.usedByName || 'usado'}</span>
    </div>)}
    {!open.length && !used.length && <div className="dim small">Todavía no hay códigos: genera uno para invitar a un deportista.</div>}
  </div>
}

export default function Admin() {
  const user = useStore(s => s.user)
  const toast = useUI(s => s.toast)
  const openSheet = useUI(s => s.openSheet)
  const [users, setUsers] = useState(null)
  const [invites, setInvites] = useState(null)
  const [inviteOnly, setInviteOnly] = useState(false)
  const [billing, setBilling] = useState({})
  const [threads, setThreads] = useState({})
  const [filter, setFilter] = useState('all')

  // Users, fees and chats together, every 15 s: the unread badges stay live like "training now".
  const loadUsers = () => Promise.all([
    api('/api/admin/users').then(d => { setUsers(d.users); setInviteOnly(d.invite_only) }).catch(e => toast(e.message || 'No se pudo cargar')),
    api('/api/trainer/billing').then(d => setBilling(d.billing)).catch(() => {}),
    api('/api/trainer/messages/summary').then(d => setThreads(d.threads)).catch(() => {})
  ])
  const loadInvites = () => api('/api/admin/invites').then(d => setInvites(d.invites)).catch(() => {})
  // poll every 15s so the "training now" section stays live without a manual refresh
  useEffect(() => { if (!user?.admin) return; loadUsers(); loadInvites(); const iv = setInterval(loadUsers, 15000); return () => clearInterval(iv) }, [])
  // EM Fitness fase 5: an alert on the dashboard links here with ?u=<athlete>
  const loc = useLocation()
  useEffect(() => {
    const u = new URLSearchParams(loc.search).get('u')
    if (u && user?.admin) openSheet(close => <UserDetail id={u} onChanged={loadUsers} close={close} />)
  }, [loc.search])
  if (!user?.admin) return null

  const openUser = id => openSheet(close => <UserDetail id={id} onChanged={loadUsers} close={close} />)
  const liveUsers = (users || []).filter(u => u.live)
  const activeCount = (users || []).filter(u => u.lastSync && Date.now() - u.lastSync < 7 * 86400000).length
  const disabledCount = (users || []).filter(u => u.disabled).length
  const athletes = (users || []).filter(u => !u.admin)
  const activeAthletes = athletes.filter(u => !u.disabled)
  const byState = st => activeAthletes.filter(u => stateOf(billing[u.id]) === st)
  const overdue = byState('overdue'), soon = byState('soon')
  const unreadOf = u => threads[u.id]?.unread || 0
  const FILTERS = [
    ['all', 'Todos', () => true],
    ['unread', 'Sin leer', u => unreadOf(u) > 0],
    ['overdue', 'Vencidas', u => !u.admin && stateOf(billing[u.id]) === 'overdue'],
    ['soon', 'Por vencer', u => !u.admin && stateOf(billing[u.id]) === 'soon'],
    ['ok', 'Al día', u => !u.admin && stateOf(billing[u.id]) === 'ok'],
    ['none', 'Sin cuota', u => !u.admin && stateOf(billing[u.id]) === 'none']
  ]
  // Unread first, then by name: who is waiting for an answer is who the trainer looks for.
  const shown = (users || []).filter(FILTERS.find(f => f[0] === filter)[2])
    .sort((a, b) => (unreadOf(b) > 0) - (unreadOf(a) > 0) || a.name.localeCompare(b.name, 'es'))

  return <div className="narrow">
    <div className="hdr">
      <div style={{ flex: 1 }}><h1 style={{ margin: 0 }}>Deportistas</h1>
        <div className="sub">{users ? users.length + ' usuarios · ' + activeCount + ' activos esta semana' : 'Cargando…'}</div></div>
      <button className="iconbtn" onClick={() => { loadUsers(); loadInvites() }} aria-label="actualizar">↻</button>
    </div>

    <div className="tiles" style={{ marginBottom: 12 }}>
      <div className="tile"><div className="l">Usuarios</div><div className="v">{users ? users.length : '—'}</div></div>
      <div className="tile"><div className="l">Entrenando</div><div className="v" style={{ color: liveUsers.length ? 'var(--acc)' : undefined }}>{users ? liveUsers.length : '—'}</div></div>
      <div className="tile"><div className="l">Activos 7 d</div><div className="v">{users ? activeCount : '—'}</div></div>
      <div className="tile"><div className="l">Desactivados</div><div className="v">{users ? disabledCount : '—'}</div></div>
    </div>

    {liveUsers.length > 0 && <div className="card" style={{ borderColor: 'var(--acc)' }}>
      <h2 className="row" style={{ margin: '0 0 8px', gap: 6 }}><Icon name="dot" style={{ fontSize: 10, color: 'var(--green)' }} />Entrenando ahora</h2>
      {liveUsers.map(u => <div key={u.id} className="row between" style={{ padding: '8px 2px', borderBottom: '1px solid var(--sep)' }} onClick={() => openUser(u.id)}>
        <div><div className="small" style={{ fontWeight: 600 }}>{u.name}</div>
          <div className="dim" style={{ fontSize: '.72rem' }}>{u.live.name} · ejercicio {u.live.exIdx}/{u.live.exTotal} · {u.live.setsDone}/{u.live.setsTotal} series</div></div>
        <span className="tag acc">{dur(Date.now() - u.live.startedAt)}</span>
      </div>)}
    </div>}

    <div className="row" style={{ gap: 8, marginBottom: 12 }}>
      <Button variant="primary" icon="plus" onClick={() => openSheet(close => <NewAthleteSheet close={close} onCreated={loadUsers} />)}>Nuevo deportista</Button>
      <Button icon="chat" disabled={!activeAthletes.length} onClick={() => openSheet(close => <BroadcastSheet count={activeAthletes.length} close={close} onSent={loadUsers} />)}>Mensaje a todos</Button>
    </div>

    {users && <div className="card">
      <h2 className="row" style={{ margin: '0 0 8px', gap: 6 }}><Icon name="money" />Mensualidades</h2>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginBottom: overdue.length + soon.length ? 8 : 0 }}>
        <span className="small"><b style={{ color: STATE_COLOR.overdue }}>{overdue.length}</b> vencidas</span>
        <span className="small"><b style={{ color: STATE_COLOR.soon }}>{soon.length}</b> por vencer</span>
        <span className="small"><b style={{ color: STATE_COLOR.ok }}>{byState('ok').length}</b> al día</span>
        <span className="small dim">{byState('none').length} sin cuota</span>
      </div>
      {[...overdue, ...soon].sort((a, b) => billing[a.id].due.localeCompare(billing[b.id].due)).map(u =>
        <div key={u.id} className="row between" style={{ padding: '7px 2px', borderTop: '1px solid var(--sep)', cursor: 'pointer', gap: 8 }} onClick={() => openUser(u.id)}>
          <span className="small" style={{ fontWeight: 600 }}>{u.name}</span>
          <span className="small" style={{ color: STATE_COLOR[stateOf(billing[u.id])], textAlign: 'right' }}>{fmtDate(billing[u.id].due)} · {dueText(billing[u.id].due)}</span>
        </div>)}
      {!overdue.length && !soon.length && <div className="dim small">Nadie tiene pagos vencidos ni por vencer en los próximos 5 días.</div>}
    </div>}

    <AdminCoach />

    <InvitesCard invites={invites} reload={loadInvites} />

    <h4 className="sec">Deportistas</h4>
    <div className="chips" style={{ marginBottom: 10 }}>
      {FILTERS.map(([k, label, fn]) => <button key={k} className={'chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>
        {label}{k !== 'all' && users ? ' · ' + users.filter(fn).length : ''}</button>)}
    </div>
    <div className="list">
      {shown.map(u => <div key={u.id} className="item" onClick={() => openUser(u.id)} style={u.disabled ? { opacity: .55 } : null}>
        <div className="grow"><div className="tt">{u.live && <Icon name="dot" style={{ fontSize: 9, color: 'var(--green)', display: 'inline-block', marginRight: 5 }} />}{u.name} {u.admin && <span className="tag acc" style={{ marginLeft: 4 }}>entrenador</span>}{u.disabled && <span className="tag" style={{ marginLeft: 4, color: 'var(--red)' }}>desact.</span>}</div>
          <div className="ss">{u.live ? 'entrenando · ' + u.live.name : u.workouts + ' entrenos' + (u.lastWorkout ? ' · último ' + fmtDate(u.lastWorkout) : '') + ' · sincr. ' + rel(u.lastSync)}</div>
          {threads[u.id]?.last && <div className="ss" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: unreadOf(u) ? 'var(--label)' : undefined }}>
            {threads[u.id].last.from === 'trainer' ? 'Tú: ' : ''}{threads[u.id].last.text}</div>}</div>
        {!u.admin && <BillingTag rec={billing[u.id]} />}
        {unreadOf(u) > 0 && <span className="badge" aria-label={unreadOf(u) + ' sin leer'}>{unreadOf(u)}</span>}
        {u.hasPush && <Icon name="bell" title="notificaciones activadas" style={{ fontSize: 15, color: 'var(--label-3)' }} />}<Icon name="chevronRight" className="chev" />
      </div>)}
      {users && !users.length && <div className="empty">Todavía no hay deportistas.</div>}
      {users && !!users.length && !shown.length && <div className="empty small">Nadie en este filtro.</div>}
    </div>
  </div>
}
