// Backend + WebAuthn helpers (ported from the vanilla app).
import { getLang } from './i18n.js'
export const IS_APPLE = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)
export const IS_ANDROID = /Android/.test(navigator.userAgent)
export const BIO = IS_APPLE ? 'Face ID / Touch ID' : IS_ANDROID ? 'fingerprint or face unlock' : 'your fingerprint, face or PIN'
export const VAULT = IS_APPLE ? 'iCloud Keychain' : IS_ANDROID ? 'Google Password Manager' : 'your password manager'
export const webauthnOK = () => !!(window.PublicKeyCredential && navigator.credentials)

// EM Fitness: the server answers errors in English (upstream's API, untouched). The app runs in
// Spanish, so the messages a user can actually see in a toast are translated here, by exact
// text. Other languages keep the server's English as before. Nothing compares e.message to
// these strings — callers branch on e.status / e.code — so translating them is display-only.
const SERVER_ES = {
  'a valid invite code is required': 'Hace falta un código de invitación válido',
  'already used — cannot revoke': 'Ya se usó; no se puede revocar',
  'cannot disable an admin': 'No se puede desactivar al entrenador',
  'challenge expired — try again': 'La solicitud caducó; inténtalo de nuevo',
  'credential already registered': 'Esta passkey ya está registrada',
  'forbidden': 'No tienes permiso para hacer esto',
  'invalid assignment': 'La asignación no es válida',
  'invalid diet': 'La dieta no es válida: revisa los campos',
  'invalid subscription': 'La suscripción a notificaciones no es válida',
  'invite code is no longer valid — ask for a new one': 'El código de invitación ya no es válido; pide uno nuevo',
  'name required': 'Escribe un nombre',
  'no diet': 'No tiene dieta',
  'no such code': 'Ese código no existe',
  'no such user': 'Ese usuario no existe',
  'not assigned': 'Esa rutina no está asignada',
  'not found': 'No encontrado',
  'not signed in': 'No has iniciado sesión',
  'not verified': 'No se pudo verificar la passkey',
  'seconds required': 'Faltan los segundos',
  'server error': 'Error del servidor; inténtalo de nuevo',
  'state required': 'Faltan los datos',
  'this account has been disabled': 'Esta cuenta está desactivada',
  'unknown passkey — create a profile first': 'Passkey desconocida: crea primero un perfil',
  'unknown provider': 'Proveedor desconocido',
  'the Coach is not set up on this instance': 'El Entrenador no está configurado en este servidor',
  'the Coach is already thinking about your training': 'El Entrenador ya está analizando tu entrenamiento',
  'the Coach is resting — try again tomorrow': 'El Entrenador está descansando: inténtalo mañana',
  'the Coach needs your go-ahead first': 'El Entrenador necesita primero tu permiso'
}
export function serverMessage(msg, status) {
  if (getLang() !== 'es') return msg || ('HTTP ' + status)
  if (!msg) return 'Error de conexión (HTTP ' + status + ')'
  if (SERVER_ES[msg]) return SERVER_ES[msg]
  if (msg.startsWith('verification failed')) return 'No se pudo verificar la passkey'
  return msg
}

export async function api(path, opts) {
  let r
  try { r = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts)) }
  catch (e) {
    // fetch only rejects when the server can't be reached at all ("Failed to fetch").
    const err = new Error(getLang() === 'es' ? 'Sin conexión con el servidor' : e.message); err.status = 0; throw err
  }
  const data = await r.json().catch(() => ({}))
  if (!r.ok) { const e = new Error(serverMessage(data.error, r.status)); e.status = r.status; e.code = data.code; throw e }
  return data
}

const bufToB64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const b64uToBuf = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)).buffer

function toCreationOptions(o) {
  o.challenge = b64uToBuf(o.challenge)
  o.user.id = b64uToBuf(o.user.id)
  ;(o.excludeCredentials || []).forEach(c => { c.id = b64uToBuf(c.id) })
  return o
}
function toRequestOptions(o) {
  o.challenge = b64uToBuf(o.challenge)
  ;(o.allowCredentials || []).forEach(c => { c.id = b64uToBuf(c.id) })
  return o
}
function credToJSON(cred) {
  const r = cred.response
  const out = {
    id: cred.id, rawId: bufToB64u(cred.rawId), type: cred.type,
    clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
    authenticatorAttachment: cred.authenticatorAttachment || null,
    response: { clientDataJSON: bufToB64u(r.clientDataJSON) }
  }
  if (r.attestationObject) {
    out.response.attestationObject = bufToB64u(r.attestationObject)
    out.response.transports = r.getTransports ? r.getTransports() : ['internal']
  }
  if (r.authenticatorData) {
    out.response.authenticatorData = bufToB64u(r.authenticatorData)
    out.response.signature = bufToB64u(r.signature)
    out.response.userHandle = r.userHandle ? bufToB64u(r.userHandle) : null
  }
  return out
}
export async function passkeyRegister(name, code) {
  const { cid, options } = await api('/api/register/options', { method: 'POST', body: JSON.stringify({ name, code: code || '' }) })
  const cred = await navigator.credentials.create({ publicKey: toCreationOptions(options) })
  const res = await api('/api/register/verify', { method: 'POST', body: JSON.stringify({ cid, credential: credToJSON(cred) }) })
  return res.user
}
export async function passkeyLogin() {
  const { cid, options } = await api('/api/login/options', { method: 'POST', body: '{}' })
  const cred = await navigator.credentials.get({ publicKey: toRequestOptions(options) })
  const res = await api('/api/login/verify', { method: 'POST', body: JSON.stringify({ cid, credential: credToJSON(cred) }) })
  return res.user
}
