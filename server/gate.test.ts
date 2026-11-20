import { describe, expect, it } from 'vitest'
import { COOKIE_NAME, LOCK_PATH, UNLOCK_PATH, handleGate, makeToken, verifyToken } from './gate.ts'

const SECRET = 'correct horse'
const BASE = 'https://woodpecker.example'

function unlock(passcode: string, next = '/') {
  const body = new URLSearchParams({ passcode, next })
  return new Request(BASE + UNLOCK_PATH, { method: 'POST', body })
}

function cookieFrom(res: Response): string {
  const header = res.headers.get('set-cookie') ?? ''
  return header.split(';')[0]
}

describe('passcode gate', () => {
  it('shows the passcode page instead of the app when locked', async () => {
    const res = await handleGate(new Request(BASE + '/'), SECRET)
    expect(res?.status).toBe(401)
    const html = await res!.text()
    expect(html).toContain('Enter passcode')
    expect(html).not.toContain(SECRET)
  })

  it('also locks the JavaScript and other files', async () => {
    const res = await handleGate(new Request(BASE + '/assets/index-abc.js'), SECRET)
    expect(res?.status).toBe(401)
  })

  it('refuses to open when no passcode is configured', async () => {
    const res = await handleGate(new Request(BASE + '/'), undefined)
    expect(res?.status).toBe(503)
    expect(await res!.text()).not.toContain('<form')
  })

  it('rejects a wrong passcode without setting a cookie', async () => {
    const res = await handleGate(unlock('nope'), SECRET)
    expect(res?.status).toBe(401)
    expect(res?.headers.get('set-cookie')).toBeNull()
    expect(await res!.text()).toContain('Wrong passcode')
  }, 5000)

  it('lets you in with the right passcode and remembers it', async () => {
    const res = await handleGate(unlock(SECRET), SECRET)
    expect(res?.status).toBe(303)
    const setCookie = res!.headers.get('set-cookie')!
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
    expect(setCookie).not.toContain(SECRET)

    const next = await handleGate(new Request(BASE + '/', { headers: { cookie: cookieFrom(res!) } }), SECRET)
    expect(next).toBeNull()
  })

  it('keeps the #fragment so the sign-in link and hash routes still work', async () => {
    const target = '/#access_token=abc&refresh_token=def&type=magiclink'
    const res = await handleGate(unlock(SECRET, target), SECRET)
    expect(res?.headers.get('location')).toBe(target)
  })

  it('never redirects to another site after unlocking', async () => {
    for (const evil of ['https://evil.example', '//evil.example', '/\\evil.example']) {
      const res = await handleGate(unlock(SECRET, evil), SECRET)
      expect(res?.headers.get('location')).toBe('/')
    }
  })

  it('rejects forged, tampered and expired cookies', async () => {
    const good = await makeToken(SECRET)
    const [expires, sig] = good.split('.')
    expect(await verifyToken(SECRET, good)).toBe(true)
    expect(await verifyToken('other passcode', good)).toBe(false)
    expect(await verifyToken(SECRET, `${Number(expires) + 1}.${sig}`)).toBe(false)
    expect(await verifyToken(SECRET, 'garbage')).toBe(false)
    const old = await makeToken(SECRET, Date.now() - 365 * 24 * 60 * 60 * 1000)
    expect(await verifyToken(SECRET, old)).toBe(false)

    const res = await handleGate(new Request(BASE + '/', { headers: { cookie: `${COOKIE_NAME}=garbage` } }), SECRET)
    expect(res?.status).toBe(401)
  })

  it('locks again from the lock link', async () => {
    const res = await handleGate(new Request(BASE + LOCK_PATH), SECRET)
    expect(res?.status).toBe(303)
    expect(res?.headers.get('set-cookie')).toContain('Max-Age=0')
  })
})
