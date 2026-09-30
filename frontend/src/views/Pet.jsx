import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { petStatus, buy, toggleWear } from '../lib/pet.js'
import { ITEMS, SLOTS, SLOT_NAME } from '../lib/pet-items.js'
import Capybara from '../components/Capybara.jsx'
import Icon from '../components/Icon.jsx'
import { Button, Segmented, TextField } from '../components/ui.jsx'

// EM Fitness fase 6: the capybara's own place — how it is, why, and its wardrobe and shop.

export const MOOD_TEXT = {
  happy: 'Happy — you did every session.',
  ok: 'Doing fine. Keep training to fill it up.',
  hungry: 'Hungry — it missed a session this week.',
  tired: 'Very tired. Train to feed it before it faints.',
  sleeping: 'Asleep until your trainer gives you a routine.',
  fainted: 'Fainted. Complete a whole week of your plan to wake it up.'
}
export const MOOD_NAME = { happy: 'Happy', ok: 'Fine', hungry: 'Hungry', tired: 'Tired', sleeping: 'Asleep', fainted: 'Fainted' }

export function Meter({ icon, label, value, color }) {
  return <div style={{ marginBottom: 10 }}>
    <div className="row between small" style={{ marginBottom: 4 }}>
      <span className="row" style={{ gap: 5 }}><Icon name={icon} />{label}</span><b style={{ fontWeight: 600 }}>{value}%</b>
    </div>
    <div className="meter"><i style={{ width: value + '%', background: color }} /></div>
  </div>
}

function RenameSheet({ close }) {
  const pet = useStore(s => s.S.pet)
  const [name, setName] = useState(pet?.name || '')
  const save = () => {
    const n = name.trim().slice(0, 20)
    if (!n) return
    useStore.getState().update(s => { s.pet.name = n })
    close()
  }
  return <>
    <h3>{t('Name your capybara')}</h3>
    <div style={{ height: 10 }} />
    <TextField value={name} maxLength={20} onChange={e => setName(e.target.value)} autoFocus />
    <div style={{ height: 12 }} /><Button variant="primary" onClick={save}>{t('Save')}</Button>
  </>
}

export default function Pet() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)
  const [tab, setTab] = useState('wardrobe')
  const today = todayISO()
  const st = S.pet ? petStatus(S, today) : null
  if (!st) return <div className="empty">{t('Your capybara arrives with your first routine.')}</div>
  const owned = new Set(S.pet.owned || [])
  const wear = S.pet.wear || {}

  const doBuy = item => {
    let err = null
    update(s => { err = buy(s, item.id, today) })
    if (err === 'not enough coins') toast(t('Not enough coins yet — keep training'))
    else if (!err) toast(t('{0} is yours!', t(item.name)))
  }

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/home')} aria-label={t('Home')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 12 }}>
        <h1 onClick={() => useUI.getState().openSheet(close => <RenameSheet close={close} />)} style={{ cursor: 'pointer' }}>{S.pet.name} <Icon name="pencil" style={{ display: 'inline-block', fontSize: 18, color: 'var(--label-3)' }} /></h1>
        <div className="sub">{t(MOOD_NAME[st.mood])}</div>
      </div>
      <span className="tag nocap" style={{ fontSize: 15, padding: '6px 10px' }}><Icon name="coin" />{st.coins}</span>
    </div>

    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 12 }}>
      <Capybara mood={st.mood} wear={wear} size={260} title={S.pet.name} />
      <div className="small muted" style={{ textAlign: 'center', margin: '10px 8px 2px' }}>{t(MOOD_TEXT[st.mood])}</div>
    </div>

    <div className="card">
      <Meter icon="apple" label={t('Food')} value={st.food} color="var(--acc-fill, var(--acc))" />
      <Meter icon="drop" label={t('Water')} value={st.water} color="#3b9ad9" />
      <Meter icon="heart" label={t('Happiness')} value={st.happy} color="#e0567a" />
      <div className="small dim">{t('Each completed workout feeds it. Training at least 75% of your plan keeps it alive.')}</div>
    </div>

    <Segmented value={tab} onChange={setTab} options={[{ value: 'wardrobe', label: t('Wardrobe') }, { value: 'shop', label: t('Shop') }]} />
    <div style={{ height: 12 }} />

    {tab === 'wardrobe' ? (owned.size ? SLOTS.filter(sl => ITEMS.some(i => i.slot === sl && owned.has(i.id))).map(sl => <div key={sl}>
      <h4 className="sec">{t(SLOT_NAME[sl])}</h4>
      <div className="chips" style={{ flexWrap: 'wrap' }}>
        {ITEMS.filter(i => i.slot === sl && owned.has(i.id)).map(i =>
          <button key={i.id} className={'chip' + (wear[sl] === i.id ? ' on' : '')} onClick={() => update(s => toggleWear(s, i.id))}>{t(i.name)}</button>)}
      </div>
    </div>) : <div className="empty small">{t('Nothing yet. Buy something in the shop with the coins you earn training.')}</div>)
    : SLOTS.map(sl => <div key={sl}>
      <h4 className="sec">{t(SLOT_NAME[sl])}</h4>
      <div className="grid2">
        {ITEMS.filter(i => i.slot === sl).map(i => {
          const have = owned.has(i.id)
          return <div key={i.id} className="card" style={{ marginBottom: 0, padding: 10, textAlign: 'center' }}>
            <Capybara mood="ok" wear={{ ...wear, [sl]: i.id }} size={120} title={t(i.name)} />
            <div className="small" style={{ fontWeight: 600, margin: '6px 0 6px' }}>{t(i.name)}</div>
            {have ? <span className="tag acc"><Icon name="check" />{t('Yours')}</span>
              : <Button size="sm" disabled={st.coins < i.price} onClick={() => doBuy(i)} style={{ width: '100%' }}><Icon name="coin" />{i.price}</Button>}
          </div>
        })}
      </div>
    </div>)}
  </div>
}
