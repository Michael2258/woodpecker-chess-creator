/**
 * Passcode gate, run on Vercel's servers before any page or file is sent.
 *
 * The passcode lives only in the APP_PASSCODE environment variable on
 * Vercel. It is never in the repository or in the app's JavaScript. Once the
 * right passcode is entered, the browser gets an httpOnly cookie holding an
 * expiry time and an HMAC signature of it, keyed by the passcode. The cookie
 * can't be forged without the passcode, and changing the passcode on Vercel
 * signs everyone out.
 */

export const COOKIE_NAME = 'wp_gate'
export const UNLOCK_PATH = '/__gate/unlock'
export const LOCK_PATH = '/__gate/lock'
/** How long a browser stays unlocked. */
export const SESSION_DAYS = 180
/** Slows down guessing: every wrong attempt waits this long. */
export const WRONG_DELAY_MS = 1500

const encoder = new TextEncoder()

function base64url(bytes: ArrayBuffer): string {
  let s = ''
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`woodpecker-gate:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(message)))
}

/** Compares two strings in time that doesn't depend on where they differ. */
function safeEqual(a: string, b: string): boolean {
  const x = encoder.encode(a)
  const y = encoder.encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

export async function makeToken(secret: string, now = Date.now()): Promise<string> {
  const expires = String(now + SESSION_DAYS * 24 * 60 * 60 * 1000)
  return `${expires}.${await hmac(secret, expires)}`
}

export async function verifyToken(secret: string, token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token) return false
  const [expires, sig] = token.split('.')
  if (!expires || !sig || !/^\d+$/.test(expires) || Number(expires) < now) return false
  return safeEqual(sig, await hmac(secret, expires))
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return undefined
}

/** Only same-site paths, so the redirect after unlocking can't send you elsewhere. */
function safeNext(raw: FormDataEntryValue | null): string {
  const next = typeof raw === 'string' ? raw : '/'
  return next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/'
}

function cookie(value: string, maxAgeSeconds: number): string {
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Decides what to do with a request. Returns a Response to send instead of
 * the app, or null to let the request through.
 */
export async function handleGate(request: Request, secret: string | undefined): Promise<Response | null> {
  if (!secret) {
    return gatePage({
      status: 503,
      message: 'The passcode has not been set up on the server yet (APP_PASSCODE is missing).',
      showForm: false,
    })
  }

  const url = new URL(request.url)

  if (url.pathname === LOCK_PATH) {
    return new Response(null, {
      status: 303,
      headers: { location: '/', 'set-cookie': cookie('', 0), 'cache-control': 'no-store' },
    })
  }

  if (url.pathname === UNLOCK_PATH && request.method === 'POST') {
    const form = await request.formData()
    const passcode = form.get('passcode')
    // `next` is the page you were on, including any #fragment (the app's
    // hash routes and the sign-in link's tokens live there).
    const next = safeNext(form.get('next'))
    if (typeof passcode === 'string' && safeEqual(passcode, secret)) {
      return new Response(null, {
        status: 303,
        headers: {
          location: next,
          'set-cookie': cookie(await makeToken(secret), SESSION_DAYS * 24 * 60 * 60),
          'cache-control': 'no-store',
        },
      })
    }
    await sleep(WRONG_DELAY_MS)
    return gatePage({ status: 401, message: 'Wrong passcode. Try again.', showForm: true, next })
  }

  if (await verifyToken(secret, readCookie(request, COOKIE_NAME))) return null

  return gatePage({ status: 401, showForm: true, next: url.pathname + url.search })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

function gatePage(opts: { status: number; message?: string; showForm: boolean; next?: string }): Response {
  const form = opts.showForm
    ? `<form method="post" action="${UNLOCK_PATH}">
        <input type="hidden" name="next" id="next" value="${escapeHtml(opts.next ?? '/')}">
        <input type="password" name="passcode" placeholder="Passcode" autocomplete="current-password" autofocus required>
        <button type="submit">Enter</button>
      </form>
      <script>
        // Keep the part of the address after "#" so you land where you meant to.
        var n = document.getElementById('next');
        if (location.hash && n.value.indexOf('#') < 0) n.value += location.hash;
      </script>`
    : ''
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Woodpecker – locked</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: Canvas; color: CanvasText; }
  main { width: min(320px, calc(100vw - 32px)); text-align: center; }
  h1 { font-size: 1.25rem; margin: 0 0 1rem; }
  form { display: flex; flex-direction: column; gap: 0.5rem; }
  input, button { font: inherit; padding: 0.6rem 0.75rem; border-radius: 8px; border: 1px solid #8886; }
  button { cursor: pointer; background: #3b6; color: #fff; border-color: #3b6; }
  p { margin: 0.75rem 0 0; }
</style>
</head>
<body>
<main>
  <h1>🔒 Enter passcode</h1>
  ${form}
  ${opts.message ? `<p role="alert">${escapeHtml(opts.message)}</p>` : ''}
</main>
</body>
</html>`
  return new Response(html, {
    status: opts.status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}
