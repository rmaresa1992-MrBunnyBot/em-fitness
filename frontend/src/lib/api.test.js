import { describe, it, expect, afterEach } from 'vitest'
import { serverMessage } from './api.js'
import { setLang } from './i18n.js'

describe('serverMessage', () => {
  afterEach(() => setLang('en'))

  it('translates the server’s messages to Spanish when the app is in Spanish', async () => {
    await setLang('es')
    expect(serverMessage('not signed in', 401)).toBe('No has iniciado sesión')
    expect(serverMessage('a valid invite code is required', 403)).toBe('Hace falta un código de invitación válido')
    expect(serverMessage('the Coach needs your go-ahead first', 403)).toBe('El Entrenador necesita primero tu permiso')
  })
  it('covers the variable WebAuthn failure and a missing message', async () => {
    await setLang('es')
    expect(serverMessage('verification failed: Unexpected authentication response origin', 400)).toBe('No se pudo verificar la passkey')
    expect(serverMessage(undefined, 502)).toBe('Error de conexión (HTTP 502)')
  })
  it('passes unknown messages through rather than hiding them', async () => {
    await setLang('es')
    expect(serverMessage('something new upstream added', 400)).toBe('something new upstream added')
  })
  it('leaves other languages exactly as the server said', async () => {
    await setLang('en')
    expect(serverMessage('not signed in', 401)).toBe('not signed in')
    expect(serverMessage(undefined, 502)).toBe('HTTP 502')
  })
})
