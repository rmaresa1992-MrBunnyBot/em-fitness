import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

export default function TabBar() {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  const hasDiet = useStore(s => !!s.diet)   // EM Fitness: the Diet tab exists only once there is one
  if (!user && !isGuest) return null
  const cur = loc.pathname.split('/')[1] || 'home'
  const on = k => cur === k || (cur === 'history' && k === 'home') || (cur === 'settings' && k === 'home')

  // EM Fitness: the disc in the middle is Inicio (Home + progress in one view). Starting a
  // workout lives in Inicio's "Hoy" card; while one is running the disc says so and takes you
  // back to it — and from the workout itself, back to Inicio.
  const running = !!S.active && cur !== 'workout'
  const center = () => nav(running ? '/workout' : '/home')
  const Tab = ({ k, icon, to, label }) => (
    <button className={on(k) ? 'on' : ''} onClick={() => nav(to)}>
      <Icon name={icon} /><span>{label}</span>
    </button>
  )

  return (
    // Two halves around the disc, so it stays dead centre whichever tabs this account has.
    <nav id="tabbar">
      <div className="side">
        <Tab k="plan" icon="calendar" to="/plan" label={t('Plan')} />
        {hasDiet && <Tab k="diet" icon="apple" to="/diet" label={t('Diet')} />}
      </div>
      <button className={'start' + (running ? ' rec' : on('home') ? ' on' : '')} onClick={center} aria-current={on('home') ? 'page' : undefined}>
        <span className="cir"><Icon name={running ? 'play' : 'house'} /></span>
        <span>{running ? t('Resume') : t('Home')}</span>
      </button>
      <div className="side">
        {/* EM Fitness: the trainer's panel (/admin) as a tab. Admin only, Spanish on purpose (D6). */}
        {user?.admin && <Tab k="admin" icon="clipboard" to="/admin" label="Entrenador" />}
        <Tab k="library" icon="list" to="/library" label={t('Exercises')} />
      </div>
    </nav>
  )
}
