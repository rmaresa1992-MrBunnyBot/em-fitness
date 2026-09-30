import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { api } from '../lib/api.js'
import { t, dateLocale } from '../lib/i18n.js'
import Chat from '../components/Chat.jsx'
import Icon from '../components/Icon.jsx'

// EM Fitness: the athlete's chat with their trainer (api/messages/).
export default function Messages() {
  const nav = useNavigate()
  const syncInbox = useStore(s => s.syncInbox)
  const markRead = () => api('/api/athlete/messages/read', { method: 'POST', body: '{}' }).then(() => syncInbox())

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/home')} aria-label={t('Home')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 10 }}><h1>{t('Messages')}</h1><div className="sub">{t('Your trainer')}</div></div>
    </div>
    <Chat me="athlete" locale={dateLocale()}
      load={after => api('/api/athlete/messages?after=' + after)}
      send={text => api('/api/athlete/messages', { method: 'POST', body: JSON.stringify({ text }) }).then(r => r.msg)}
      markRead={markRead}
      labels={{
        loading: t('Loading…'), today: t('Today'), send: t('Send'),
        placeholder: t('Write to your trainer'),
        empty: t('No messages yet. Your trainer’s messages show up here, and you can answer them.')
      }} />
  </div>
}
