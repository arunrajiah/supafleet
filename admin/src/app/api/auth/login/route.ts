import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, createSessionToken, sessionCookieOptions } from '@/lib/auth'
import { readState } from '@/lib/state'

export async function POST(req: NextRequest) {
  const state = readState()
  if (!state?.setupComplete) {
    return NextResponse.json({ error: 'Not set up yet.' }, { status: 400 })
  }

  const { password } = await req.json()
  const ok = await verifyPassword(password ?? '', state.adminPasswordHash)
  if (!ok) {
    return NextResponse.json({ error: 'Invalid password.' }, { status: 401 })
  }

  const token = createSessionToken()
  const res   = NextResponse.json({ ok: true })
  res.cookies.set(sessionCookieOptions(token))
  return res
}
