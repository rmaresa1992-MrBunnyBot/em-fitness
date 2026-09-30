import { useEffect, useRef, useState } from 'react'
import { useUI } from '../store/useUI.js'
import Icon from './Icon.jsx'

// EM Fitness: one trainer ↔ athlete thread (api/messages/). Shared by the athlete's Messages
// screen and the trainer's panel, which pass their own endpoints and labels — the athlete's go
// through t(), the trainer's are Spanish (D6).
//
// No sockets on this server: while the thread is on screen and the tab visible it asks for
// anything newer than the last message every few seconds. A push covers the rest of the time.

const POLL_MS = 5000

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()

export default function Chat({ me, load, send, markRead, labels, locale }) {
  const [msgs, setMsgs] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useUI(s => s.toast)
  const end = useRef(null)
  const lastAt = useRef(0)

  // Merge by id: a poll and a send can both return the same message.
  const merge = incoming => setMsgs(prev => {
    const seen = new Set((prev || []).map(m => m.id))
    const next = [...(prev || []), ...incoming.filter(m => !seen.has(m.id))].sort((a, b) => a.at - b.at)
    if (next.length) lastAt.current = next[next.length - 1].at
    return next
  })

  useEffect(() => {
    let alive = true
    const tick = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const { msgs: fresh } = await load(lastAt.current)
        if (!alive) return
        if (fresh.length || lastAt.current === 0) merge(fresh)
        if (fresh.some(m => m.from !== me)) markRead().catch(() => {})
      } catch (e) { if (alive && lastAt.current === 0) { setMsgs(m => m || []); toast(e.message) } }
    }
    tick()
    const iv = setInterval(tick, POLL_MS)
    return () => { alive = false; clearInterval(iv) }
  }, [])

  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: msgs?.length > 30 ? 'auto' : 'smooth' }) }, [msgs?.length])

  const submit = async e => {
    e?.preventDefault()
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    try { const msg = await send(body); merge([msg]); setText('') }
    catch (err) { toast(err.message) }
    finally { setBusy(false) }
  }
  // Enter sends on a keyboard; Shift+Enter is a new line. Phones have no Enter-to-send habit
  // worth fighting, and their return key just adds a line.
  const onKey = e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && matchMedia('(hover: hover)').matches) submit(e) }

  const fmtTime = at => new Date(at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const fmtDay = at => sameDay(at, Date.now()) ? labels.today : new Date(at).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })

  return <div className="chat">
    {msgs === null ? <div className="muted small" style={{ padding: 20, textAlign: 'center' }}>{labels.loading}</div>
      : !msgs.length ? <div className="empty"><div className="ico"><Icon name="chat" /></div>{labels.empty}</div>
      : <div className="chat-log" role="log" aria-live="polite">
        {msgs.map((m, i) => <div key={m.id}>
          {(i === 0 || !sameDay(msgs[i - 1].at, m.at)) && <div className="chat-day">{fmtDay(m.at)}</div>}
          <div className={'bubble ' + (m.from === me ? 'mine' : 'theirs')}>
            <div className="bubble-t">{m.text}</div>
            <div className="bubble-at">{fmtTime(m.at)}</div>
          </div>
        </div>)}
      </div>}
    <div ref={end} />
    <form className="chat-compose" onSubmit={submit}>
      <textarea className="field" rows={1} value={text} maxLength={2000} placeholder={labels.placeholder}
        aria-label={labels.placeholder} onChange={e => setText(e.target.value)} onKeyDown={onKey} />
      <button className="chat-send" type="submit" disabled={!text.trim() || busy} aria-label={labels.send}><Icon name="send" /></button>
    </form>
  </div>
}
