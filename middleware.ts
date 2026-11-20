import { next } from '@vercel/functions'
import { handleGate } from './server/gate.ts'

// Vercel runs this before every request, so nothing in the app (pages,
// JavaScript, files) is sent until the passcode has been entered.
// See server/gate.ts and the "Passcode" section of the README.
export const config = {
  matcher: '/:path*',
}

export default async function middleware(request: Request): Promise<Response> {
  return (await handleGate(request, process.env.APP_PASSCODE)) ?? next()
}
