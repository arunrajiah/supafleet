import { NextRequest, NextResponse } from 'next/server'
import { hashPassword, createSessionToken, sessionCookieOptions } from '@/lib/auth'
import { writeState, isSetupComplete } from '@/lib/state'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  if (isSetupComplete()) {
    return NextResponse.json({ error: 'Already set up.' }, { status: 409 })
  }

  const { password } = await req.json()
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const adminPasswordHash = await hashPassword(password)
  const sessionSecret     = crypto.randomBytes(32).toString('hex')
  writeState({ setupComplete: true, adminPasswordHash, sessionSecret })

  const token = createSessionToken()
  const res   = NextResponse.json({ ok: true })
  res.cookies.set(sessionCookieOptions(token))
  return res
}
