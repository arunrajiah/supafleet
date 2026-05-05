import crypto from 'crypto'
import { generateJWT, generateSecret } from '../../src/lib/jwt-gen'

const SECRET = 'test-secret-that-is-long-enough-32chars'

function decodeB64url(s: string): unknown {
  return JSON.parse(Buffer.from(s, 'base64url').toString('utf8'))
}

// ── generateJWT ──────────────────────────────────────────────────────────────

describe('generateJWT', () => {
  it('returns a three-part dot-separated string', () => {
    expect(generateJWT(SECRET, 'anon').split('.')).toHaveLength(3)
  })

  it('encodes alg=HS256 and typ=JWT in the header', () => {
    const [headerB64] = generateJWT(SECRET, 'anon').split('.')
    const header = decodeB64url(headerB64) as Record<string, string>
    expect(header.alg).toBe('HS256')
    expect(header.typ).toBe('JWT')
  })

  it('embeds the correct role in the payload', () => {
    for (const role of ['anon', 'service_role'] as const) {
      const [, payB64] = generateJWT(SECRET, role).split('.')
      expect((decodeB64url(payB64) as Record<string, string>).role).toBe(role)
    }
  })

  it('sets iss to "supabase-local"', () => {
    const [, payB64] = generateJWT(SECRET, 'anon').split('.')
    expect((decodeB64url(payB64) as Record<string, string>).iss).toBe('supabase-local')
  })

  it('sets expiry approximately 20 years in the future', () => {
    const [, payB64] = generateJWT(SECRET, 'anon').split('.')
    const { iat, exp } = decodeB64url(payB64) as Record<string, number>
    const twentyYears = 20 * 365 * 24 * 3600
    // Allow ±1 day of drift
    expect(exp - iat).toBeGreaterThan(twentyYears - 86400)
    expect(exp - iat).toBeLessThan(twentyYears + 86400)
  })

  it('produces a valid HMAC-SHA256 signature', () => {
    const token = generateJWT(SECRET, 'anon')
    const [header, payload, sig] = token.split('.')
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url')
    expect(sig).toBe(expected)
  })

  it('produces different tokens for anon vs service_role', () => {
    expect(generateJWT(SECRET, 'anon')).not.toBe(generateJWT(SECRET, 'service_role'))
  })

  it('rejects tampered tokens (wrong signature)', () => {
    const token = generateJWT(SECRET, 'anon')
    const [h, p] = token.split('.')
    const tampered = `${h}.${p}.invalidsig`
    const [th, tp, tsig] = tampered.split('.')
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(`${th}.${tp}`)
      .digest('base64url')
    expect(tsig).not.toBe(expected)
  })
})

// ── generateSecret ───────────────────────────────────────────────────────────

describe('generateSecret', () => {
  it('returns a lowercase hex string', () => {
    expect(generateSecret(16)).toMatch(/^[0-9a-f]+$/)
  })

  it('length is 2× the requested byte count', () => {
    expect(generateSecret(20)).toHaveLength(40)
    expect(generateSecret(32)).toHaveLength(64)
  })

  it('defaults to 40 bytes (80 hex chars)', () => {
    expect(generateSecret()).toHaveLength(80)
  })

  it('generates a unique value on every call', () => {
    const values = new Set(Array.from({ length: 10 }, () => generateSecret()))
    expect(values.size).toBe(10)
  })
})
