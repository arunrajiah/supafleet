import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { getSessionSecret, readState } from './state'

const COOKIE = 'smdb_session'
const EXPIRY = '12h'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function createSessionToken(): string {
  return jwt.sign({ admin: true }, getSessionSecret(), { expiresIn: EXPIRY })
}

export function verifySessionToken(token: string): boolean {
  try {
    jwt.verify(token, getSessionSecret())
    return true
  } catch {
    return false
  }
}

export async function getSession(): Promise<boolean> {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  if (!token) return false
  return verifySessionToken(token)
}

export function sessionCookieOptions(token: string) {
  return {
    name: COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 12,
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const state = readState()
  if (!state?.setupComplete) return false
  return getSession()
}
