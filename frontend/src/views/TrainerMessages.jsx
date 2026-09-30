import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
import Chat from '../components/Chat.jsx'
import Icon from '../components/Icon.jsx'
import { Button, TextArea } from '../components/ui.jsx'

// EM Fitness: the trainer's side of one athlete's chat, and the message to everyone.
// Spanish only, like the rest of the trainer's tools (D6).

export default function TrainerMessages() {
  const { id } = useParams()
  const nav = useNavigate()
  const [name, setName] = useState('')
  useEffect(() => { api('/api/admin/user?id=' + encodeURIComponent(id)).then(d => setName(d.user.name)).catch(() => {}) }, [id])

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/admin')} aria-label="Volver al panel"><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 10 }}><h1 className="capitalize">{name || 'Mensajes'}</h1><div className="sub">Mensajes</div></div>
    </div>
    <Chat me="trainer" locale="es-MX"
      load={after => api('/api/trainer/messages?id=' + encodeURIComponent(id) + '&after=' + after)}
      send={text => api('/api/trainer/messages', { method: 'POST', body: JSON.stringify({ to: [id], text }) }).then(r => r.sent[0].msg)}
      markRead={() => api('/api/trainer/messages/read', { method: 'POST', body: JSON.stringify({ id }) })}
      labels={{
        loading: 'Cargando…', today: 'Hoy', send: 'Enviar', placeholder: 'Escribe un mensaje',
        empty: 'Todavía no hay mensajes con este deportista.'
      }} />
  </div>
}

/** Sheet: one message to every active athlete, each in their own thread. */
export function BroadcastSheet({ count, close, onSent }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useUI(s => s.toast)
  const go = () => {
    if (!text.trim() || busy) return
    setBusy(true)
    api('/api/trainer/messages', { method: 'POST', body: JSON.stringify({ to: 'all', text }) })
      .then(r => { toast('Enviado a ' + r.sent.length + (r.sent.length === 1 ? ' deportista' : ' deportistas')); onSent?.(); close() })
      .catch(e => { toast(e.message); setBusy(false) })
  }
  return <>
    <h3>Mensaje a todos</h3>
    <div className="small muted" style={{ margin: '4px 0 10px' }}>
      Llega a {count} {count === 1 ? 'deportista activo' : 'deportistas activos'}, a cada uno en su conversación, con notificación. Pueden responderte.
    </div>
    <TextArea value={text} maxLength={2000} placeholder="Ej.: El lunes el gimnasio abre a las 9:00" onChange={e => setText(e.target.value)} />
    <div style={{ height: 12 }} />
    <Button variant="primary" icon="send" disabled={!text.trim() || busy} onClick={go}>Enviar a todos</Button>
  </>
}
