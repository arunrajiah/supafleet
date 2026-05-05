import crypto from 'crypto'

function b64url(data: string | object): string {
  const str = typeof data === 'object' ? JSON.stringify(data) : data
  return Buffer.from(str).toString('base64url')
}

export function generateJWT(secret: string, role: 'anon' | 'service_role'): string {
  const header  = { alg: 'HS256', typ: 'JWT' }
  const now     = Math.floor(Date.now() / 1000)
  const payload = {
    role,
    iss: 'supabase-local',
    iat: now,
    exp: now + 20 * 365 * 24 * 3600, // 20 years
  }

  const msg = `${b64url(header)}.${b64url(payload)}`
  const sig = crypto.createHmac('sha256', secret).update(msg).digest('base64url')
  return `${msg}.${sig}`
}

export function generateSecret(bytes = 40): string {
  return crypto.randomBytes(bytes).toString('hex')
}
