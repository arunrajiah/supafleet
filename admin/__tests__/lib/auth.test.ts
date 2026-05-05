import { hashPassword, verifyPassword, sessionCookieOptions } from '../../src/lib/auth'

// Mock the Next.js server modules and state — not available in the test runner
jest.mock('next/headers')
jest.mock('../../src/lib/state', () => ({
  getSessionSecret: () => 'test-session-secret-32-chars-long!!',
  readState:        jest.fn(),
  isSetupComplete:  jest.fn(() => false),
}))

// ── hashPassword / verifyPassword ────────────────────────────────────────────

describe('hashPassword / verifyPassword', () => {
  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true)
  })

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('right')
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })

  it('rejects an empty password against a real hash', async () => {
    const hash = await hashPassword('secret')
    expect(await verifyPassword('', hash)).toBe(false)
  })

  it('generates a different bcrypt hash on every call (salt)', async () => {
    const [a, b] = await Promise.all([hashPassword('same'), hashPassword('same')])
    expect(a).not.toBe(b)
  })

  it('starts with the bcrypt identifier $2', async () => {
    const hash = await hashPassword('any')
    expect(hash).toMatch(/^\$2[aby]\$/)
  })
})

// ── sessionCookieOptions ─────────────────────────────────────────────────────

describe('sessionCookieOptions', () => {
  const TOKEN = 'eyJtest.token.here'
  const opts  = sessionCookieOptions(TOKEN)

  it('uses the correct cookie name', () => {
    expect(opts.name).toBe('smdb_session')
  })

  it('stores the provided token as the value', () => {
    expect(opts.value).toBe(TOKEN)
  })

  it('sets httpOnly to true', () => {
    expect(opts.httpOnly).toBe(true)
  })

  it('sets sameSite to lax', () => {
    expect(opts.sameSite).toBe('lax')
  })

  it('sets path to /', () => {
    expect(opts.path).toBe('/')
  })

  it('expires in exactly 12 hours', () => {
    expect(opts.maxAge).toBe(60 * 60 * 12)
  })
})
