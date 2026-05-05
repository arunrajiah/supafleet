import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, createSessionToken, sessionCookieOptions } from '@/lib/auth'
import { readState } from '@/lib/state'
import { recordFailedAttempt, clearAttempts, isLimited } from '@/lib/rate-limit'

/** Extract a best-effort client IP from the incoming request. */
function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  const state = readState()
  if (!state?.setupComplete) {
    return NextResponse.json({ error: 'Not set up yet.' }, { status: 400 })
  }

  const ip = getClientIp(req)

  // Pre-flight check — reject immediately if already over the limit (avoids
  // running bcrypt on every blocked request, which is expensive by design).
  const preCheck = isLimited(ip)
  if (preCheck.limited) {
    return NextResponse.json(
      { error: 'Too many failed login attempts. Try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(preCheck.retryAfter) },
      },
    )
  }

  const { password } = await req.json()
  const ok = await verifyPassword(password ?? '', state.adminPasswordHash)

  if (!ok) {
    const result = recordFailedAttempt(ip)
    const res = NextResponse.json({ error: 'Invalid password.' }, { status: 401 })
    if (result.limited) {
      // Just tipped over — switch to 429 for this response too.
      return NextResponse.json(
        { error: 'Too many failed login attempts. Try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(result.retryAfter) },
        },
      )
    }
    return res
  }

  // Success — clear any accumulated failures so the user isn't penalised for
  // having previously mistyped their password.
  clearAttempts(ip)

  const token = createSessionToken()
  const res   = NextResponse.json({ ok: true })
  res.cookies.set(sessionCookieOptions(token))
  return res
}
