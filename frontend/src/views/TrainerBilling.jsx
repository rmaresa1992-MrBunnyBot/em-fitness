import { useEffect, useState } from 'react'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
import { fmtDate } from '../lib/format.js'
import { status, fmtMoney, dayOf, localISO, STATE_COLOR } from '../lib/billing.js'
import { num } from '../lib/diet.js'
import { confirmSheet } from '../sheets.jsx'
import { Button, TextField } from '../components/ui.jsx'

// EM Fitness: an athlete's monthly fee inside the trainer's user sheet (api/billing/).
// Spanish only, like the rest of the trainer's tools (D6).

const money = n => fmtMoney(n)

/** "vence en 3 días" / "vence hoy" / "vencida hace 2 días". */
export function dueText(due, today = localISO()) {
  const { left } = status(due, today)
  if (left === 0) return 'vence hoy'
  if (left === 1) return 'vence mañana'
  if (left > 1) return 'vence en ' + left + ' días'
  return left === -1 ? 'vencida desde ayer' : 'vencida hace ' + -left + ' días'
}

/** A small coloured label for a record's state, for lists. */
export function BillingTag({ rec }) {
  if (!rec) return null
  const { state } = status(rec.due)
  const text = state === 'overdue' ? 'Vencida' : state === 'soon' ? 'Por vencer' : 'Al día'
  // Sentence case, written out: .tag capitalises every word, which is English style (see D10).
  return <span className="tag" style={{ textTransform: 'none', color: STATE_COLOR[state], background: `color-mix(in srgb, ${STATE_COLOR[state]} 14%, transparent)` }}>{text}</span>
}

function PlanSheet({ athlete, rec, close, onSaved }) {
  const toast = useUI(s => s.toast)
  const [fee, setFee] = useState(rec ? String(rec.fee) : '')
  const [due, setDue] = useState(rec?.due || localISO())
  const save = () => {
    const f = num(fee)
    if (f === undefined) { toast('Escribe la cuota'); return }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) { toast('Elige la fecha del próximo pago'); return }
    // The billing day comes from the date itself, so the two can never disagree.
    api('/api/trainer/billing', { method: 'PUT', body: JSON.stringify({ athlete, fee: f, day: dayOf(due), due }) })
      .then(() => { toast('Mensualidad guardada'); onSaved(); close() })
      .catch(e => toast(e.message))
  }
  return <>
    <h3>{rec ? 'Editar mensualidad' : 'Poner mensualidad'}</h3>
    <div className="small muted" style={{ margin: '4px 0 12px' }}>Cada pago que registres mueve el vencimiento un mes, el mismo día (o el último del mes si ese día no existe).</div>
    <label className="small muted" htmlFor="bf">Cuota mensual ($)</label>
    <TextField id="bf" inputMode="decimal" value={fee} placeholder="Ej.: 600" onChange={e => setFee(e.target.value)} />
    <div style={{ height: 10 }} />
    <label className="small muted" htmlFor="bd">Próximo pago</label>
    <TextField id="bd" type="date" value={due} onChange={e => setDue(e.target.value)} />
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={save}>Guardar</Button>
  </>
}

function PaySheet({ athlete, rec, close, onSaved }) {
  const toast = useUI(s => s.toast)
  const [amount, setAmount] = useState(String(rec.fee))
  const [note, setNote] = useState('')
  const save = () => {
    const a = num(amount)
    if (a === undefined) { toast('Escribe el importe'); return }
    api('/api/trainer/billing/pay', { method: 'POST', body: JSON.stringify({ athlete, amount: a, note: note.trim() || undefined }) })
      .then(r => { toast('Pago registrado · próximo ' + fmtDate(r.billing.due)); onSaved(); close() })
      .catch(e => toast(e.message))
  }
  return <>
    <h3>Registrar pago</h3>
    <div className="small muted" style={{ margin: '4px 0 12px' }}>Salda el vencimiento del {fmtDate(rec.due)}. No cobra nada: solo lo anota.</div>
    <label className="small muted" htmlFor="pa">Importe ($)</label>
    <TextField id="pa" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
    <div style={{ height: 10 }} />
    <label className="small muted" htmlFor="pn">Nota (opcional)</label>
    <TextField id="pn" value={note} maxLength={120} placeholder="Efectivo, transferencia…" onChange={e => setNote(e.target.value)} />
    <div style={{ height: 14 }} />
    <Button variant="primary" icon="check" onClick={save}>Registrar pago</Button>
  </>
}

/** The fee block in the Admin user sheet. */
export function BillingSection({ athlete, onChanged }) {
  const toast = useUI(s => s.toast)
  const openSheet = useUI(s => s.openSheet)
  const [rec, setRec] = useState(undefined)
  const load = () => api('/api/trainer/billing/user?id=' + encodeURIComponent(athlete)).then(r => setRec(r.billing)).catch(() => setRec(null))
  useEffect(() => { load() }, [athlete])
  const saved = () => { load(); onChanged?.() }

  const undo = p => confirmSheet({
    title: '¿Deshacer este pago?',
    message: 'Se borra el pago de ' + money(p.amount) + ' del ' + fmtDate(localISO(p.at)) + ' y el vencimiento vuelve al ' + fmtDate(p.period) + '.',
    confirmText: 'Deshacer', danger: true,
    onConfirm: () => api('/api/trainer/billing/undo', { method: 'POST', body: JSON.stringify({ athlete, pid: p.id }) })
      .then(() => { toast('Pago deshecho'); saved() }).catch(e => toast(e.message))
  })

  const st = rec ? status(rec.due) : null
  return <>
    <div className="row between" style={{ marginTop: 16 }}>
      <h4 className="sec" style={{ margin: 0 }}>Mensualidad</h4>
      {rec !== undefined && <Button size="sm" icon={rec ? 'pencil' : 'plus'} onClick={() => openSheet(close => <PlanSheet athlete={athlete} rec={rec} close={close} onSaved={saved} />)}>{rec ? 'Editar' : 'Poner cuota'}</Button>}
    </div>
    {rec === undefined ? <div className="dim small" style={{ padding: '6px 2px' }}>Cargando…</div>
      : !rec ? <div className="dim small" style={{ padding: '6px 2px' }}>Sin mensualidad. Ponle una cuota para llevar el control de sus pagos.</div>
      : <>
        <div className="row between" style={{ padding: '8px 2px', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 600 }}>{money(rec.fee)} <span className="muted small" style={{ fontWeight: 400 }}>al mes · día {rec.day}</span></div>
            <div className="small" style={{ color: STATE_COLOR[st.state], fontWeight: 500 }}>Próximo pago {fmtDate(rec.due)} · {dueText(rec.due)}</div>
          </div>
          <Button size="sm" variant="primary" icon="check" onClick={() => openSheet(close => <PaySheet athlete={athlete} rec={rec} close={close} onSaved={saved} />)}>Pagó</Button>
        </div>
        {rec.payments?.length > 0 && <div className="list" style={{ gap: 0 }}>
          {rec.payments.slice(0, 12).map((p, i) => <div key={p.id} className="row between" style={{ padding: '7px 2px', borderBottom: '1px solid var(--sep)', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div className="small">{money(p.amount)} · periodo {fmtDate(p.period)}</div>
              <div className="dim" style={{ fontSize: '.72rem' }}>pagado {fmtDate(localISO(p.at))}{p.note ? ' · ' + p.note : ''}</div>
            </div>
            {i === 0 && <button className="btn plain sm" onClick={() => undo(p)}>Deshacer</button>}
          </div>)}
        </div>}
      </>}
  </>
}
