import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { isAthlete } from '../lib/roles.js'

export default function TabBar() {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  const hasDiet = useStore(s => !!s.diet)
  const athlete = isAthlete(user)
  const trainer = !!user?.admin
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
      {/* EM Fitness: an athlete's three tabs are Plan | Inicio | Dieta — the diet tab is always
          there, with its empty state until the trainer sends one. The trainer's are Rutinas |
          Tablero | Deportistas (Spanish on purpose, D6). No exercise library for anyone (D14). */}
      <div className="side">
        <Tab k="plan" icon="calendar" to="/plan" label={trainer ? 'Rutinas' : t('Plan')} />
        {trainer && <Tab k="nutricion" icon="apple" to="/nutricion" label="Nutrición" />}
      </div>
      <button className={'start' + (running ? ' rec' : on('home') ? ' on' : '')} onClick={center} aria-current={on('home') ? 'page' : undefined}>
        <span className="cir"><Icon name={running ? 'play' : trainer ? 'chart' : 'house'} /></span>
        <span>{running ? t('Resume') : trainer ? 'Tablero' : t('Home')}</span>
      </button>
      <div className="side">
        {trainer ? <Tab k="admin" icon="person" to="/admin" label="Deportistas" />
          : (athlete || hasDiet) && <Tab k="diet" icon="apple" to="/diet" label={t('Diet')} />}
      </div>
    </nav>
  )
}
