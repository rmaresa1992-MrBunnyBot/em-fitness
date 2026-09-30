import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { useNavigate } from 'react-router-dom'
import { webauthnOK, passkeyLogin, passkeyRegister, passwordLogin, api, BIO } from '../lib/api.js'
import { hasData } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { DEMO, REPO } from '../lib/demo.js'
import { useState, useRef, useEffect } from 'react'
import Icon from '../components/Icon.jsx'
import { Button, Segmented, TextField } from '../components/ui.jsx'

function RegisterSheet({ close }) {
  const { setUser, pushState, pullState } = useStore()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [inviteOnly, setInviteOnly] = useState(false)
  const ref = useRef(null)
  useEffect(() => { setTimeout(() => ref.current?.focus(), 250) }, [])
  useEffect(() => { api('/api/config').then(c => setInviteOnly(!!c.invite_only)).catch(() => {}) }, [])
  const go = async () => {
    const n = name.trim()
    if (!n) { useUI.getState().toast(t('Enter a name')); return }
    if (inviteOnly && !code.trim()) { useUI.getState().toast(t('An invite code is required')); return }
    try {
      const u = await passkeyRegister(n, code.trim())
      setUser(u); close()
      if (hasData(useStore.getState().S)) { await pushState(); useUI.getState().toast(t('Profile created — data from this device moved into it')) }
      else { await pullState(); useUI.getState().toast(t('Welcome, {0}', u.name)) }
    } catch (e) { if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') useUI.getState().toast(e.message || t('Registration failed')) }
  }
  return <>
    <h3>{t('Create your profile')}</h3>
    <div className="muted small" style={{ marginBottom: 14 }}>{t('Pick a name, then confirm with {0}. The passkey is saved in your device — no password needed.', t(BIO))}</div>
    <input ref={ref} className="input" placeholder={t('Your name')} maxLength={40} value={name} onChange={e => setName(e.target.value)} />
    {inviteOnly && <>
      <div style={{ height: 10 }} />
      <input className="input" placeholder={t('Invite code')} maxLength={40} value={code}
        onChange={e => setCode(e.target.value.toUpperCase())} style={{ letterSpacing: '.14em', fontWeight: 600, textAlign: 'center' }} />
      <div className="dim small" style={{ marginTop: 6 }}>{t('This app is invite-only — enter the code you were given.')}</div>
    </>}
    <div style={{ height: 12 }} />
    <Button variant="primary" onClick={go}>{t('Create passkey')}</Button>
  </>
}

export default function Login() {
  const { setUser, pullState, setGuest } = useStore()
  const [more, setMore] = useState(false)
  const signIn = async () => {
    try { const u = await passkeyLogin(); setUser(u); await pullState(); useUI.getState().toast(t('Welcome back, {0}', u.name)) }
    catch (e) { if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') useUI.getState().toast(e.message || t('Sign-in failed')) }
  }
  const head = <>
    <div style={{ fontSize: 54, display: 'flex', justifyContent: 'center', color: 'var(--acc)' }}><Icon name="dumbbell" /></div>
    <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-.028em', margin: '10px 0 4px' }}>EM Fitness</h1>
  </>
  const wrap = { display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '78vh', textAlign: 'center' }

  // Demo build: no backend to sign in against — the only way in is the local guest profile.
  if (DEMO) return (
    <div className="narrow" style={wrap}>
      {head}
      <div className="muted" style={{ marginBottom: 30 }}>{t('Live demo — everything stays in this browser.')}</div>
      <Button variant="primary" icon="sparkles" onClick={() => setGuest(true)}>{t('Start the demo')}</Button>
      <div className="card small muted" style={{ textAlign: 'left', marginTop: 16 }}>
        {t('This demo runs entirely in your browser on example data — nothing is sent anywhere. Passkey sign-in and sync across your devices come with the EM Fitness server, which you get by self-hosting it.')}
      </div>
      <div className="dim small" style={{ marginTop: 22, lineHeight: 1.6 }}>
        <a href={REPO} target="_blank" rel="noopener">{t('Self-host it in a minute →')}</a>
      </div>
    </div>
  )

  // EM Fitness: username + password first, with a door per role (api/auth/). Passkeys and the
  // guest profile stay, folded under "Other ways in".
  return (
    <div className="narrow" style={wrap}>
      {head}
      <div className="muted" style={{ marginBottom: 26 }}>{t('Your workouts. Your weights. Your profile.')}</div>
      <PasswordForm />
      <div style={{ height: 18 }} />
      <button className="btn ghost dim sm" onClick={() => setMore(m => !m)} aria-expanded={more}>
        {t('Other ways in')} <Icon name={more ? 'chevronUp' : 'chevronDown'} />
      </button>
      {more && <div className="vfade" style={{ marginTop: 10 }}>
        {webauthnOK() ? <>
          <Button icon="person" onClick={signIn}>{t('Sign in with passkey')}</Button>
          <div style={{ height: 10 }} />
          <Button icon="sparkles" onClick={() => useUI.getState().openSheet(close => <RegisterSheet close={close} />)}>{t('Create new profile')}</Button>
          <div style={{ height: 10 }} />
        </> : <div className="card small muted" style={{ textAlign: 'left' }}>{t("This browser doesn't support passkeys — you can still use EM Fitness locally on this device.")}</div>}
        <Button variant="ghost" className="dim" onClick={() => setGuest(true)}>{t('Continue without account')}</Button>
        <div className="dim small" style={{ marginTop: 16, lineHeight: 1.5 }}>{t('Passkeys use {0} — no passwords.', t(BIO))}<br />{t('Each profile keeps its own plan, workouts & body weight.')}</div>
      </div>}
    </div>
  )
}

function PasswordForm() {
  const { setUser, pullState } = useStore()
  const navigate = useNavigate()
  const [role, setRole] = useState('athlete')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const trainer = role === 'trainer'

  const go = async e => {
    e.preventDefault()
    if (!username.trim() || !password) { useUI.getState().toast(t('Enter your username and password')); return }
    setBusy(true)
    try {
      const u = await passwordLogin(username.trim(), password, role)
      setUser(u)
      await pullState()
      // The trainer lands on the panel whichever door they used; everyone else on Home.
      navigate(u.admin ? '/admin' : '/home', { replace: true })
      useUI.getState().toast(t('Welcome back, {0}', u.name))
    } catch (err) { useUI.getState().toast(err.message || t('Sign-in failed')); setBusy(false) }
  }

  // No card around it: the fields are white (--surface) and need the page background to show.
  return <form onSubmit={go} style={{ textAlign: 'left' }}>
    <Segmented value={role} onChange={setRole} options={[
      { value: 'athlete', label: t('I’m an athlete') },
      { value: 'trainer', label: t('I’m the trainer') }
    ]} />
    <div className="small muted" style={{ margin: '12px 2px 12px', minHeight: '2.6em' }}>
      {trainer ? t('Your panel: athletes, monthly fees and messages.') : t('Your trainer gives you your username and password.')}
    </div>
    <TextField name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
      placeholder={t('Username')} aria-label={t('Username')} maxLength={32} value={username}
      style={{ textTransform: 'none' }} onChange={e => setUsername(e.target.value)} />
    <div style={{ height: 10 }} />
    <div style={{ position: 'relative' }}>
      <TextField name="password" type={show ? 'text' : 'password'} autoComplete="current-password"
        placeholder={t('Password')} aria-label={t('Password')} maxLength={200} value={password}
        style={{ textTransform: 'none', paddingRight: 48 }} onChange={e => setPassword(e.target.value)} />
      <button type="button" className="iconbtn" onClick={() => setShow(s => !s)} aria-label={show ? t('Hide password') : t('Show password')}
        aria-pressed={show} style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 38, height: 38, background: 'none' }}>
        <Icon name={show ? 'lock' : 'key'} />
      </button>
    </div>
    <div style={{ height: 14 }} />
    <Button variant="primary" type="submit" icon={trainer ? 'clipboard' : 'dumbbell'} disabled={busy}>{trainer ? t('Enter the panel') : t('Sign in')}</Button>
  </form>
}
