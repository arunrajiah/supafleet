import {
  recordFailedAttempt,
  clearAttempts,
  isLimited,
  _resetStore,
} from '@/lib/rate-limit'

beforeEach(() => _resetStore())

// ── recordFailedAttempt ──────────────────────────────────────────────────────

describe('recordFailedAttempt', () => {
  it('returns limited:false for the first attempt', () => {
    const result = recordFailedAttempt('ip1', { maxAttempts: 3, windowMs: 60_000 })
    expect(result.limited).toBe(false)
  })

  it('returns limited:false while under the threshold', () => {
    recordFailedAttempt('ip1', { maxAttempts: 3, windowMs: 60_000 })
    recordFailedAttempt('ip1', { maxAttempts: 3, windowMs: 60_000 })
    const result = recordFailedAttempt('ip1', { maxAttempts: 3, windowMs: 60_000 })
    expect(result.limited).toBe(false)
  })

  it('returns limited:true after exceeding maxAttempts', () => {
    for (let i = 0; i < 3; i++) {
      recordFailedAttempt('ip1', { maxAttempts: 3, windowMs: 60_000 })
    }
    const result = recordFailedAttempt('ip1', { maxAttempts: 3, windowMs: 60_000 })
    expect(result.limited).toBe(true)
  })

  it('includes a positive retryAfter when limited', () => {
    for (let i = 0; i < 4; i++) {
      recordFailedAttempt('ip1', { maxAttempts: 3, windowMs: 60_000 })
    }
    const result = recordFailedAttempt('ip1', { maxAttempts: 3, windowMs: 60_000 })
    if (!result.limited) throw new Error('expected limited')
    expect(result.retryAfter).toBeGreaterThan(0)
    expect(result.retryAfter).toBeLessThanOrEqual(60)
  })

  it('tracks different IPs independently', () => {
    for (let i = 0; i < 4; i++) {
      recordFailedAttempt('ip-a', { maxAttempts: 3, windowMs: 60_000 })
    }
    const resultB = recordFailedAttempt('ip-b', { maxAttempts: 3, windowMs: 60_000 })
    expect(resultB.limited).toBe(false)
  })

  it('prunes attempts older than the window', () => {
    const past = Date.now() - 90_000          // 90 s ago — outside a 60 s window
    const { _resetStore: _, ...mod } = jest.requireActual('@/lib/rate-limit') as typeof import('@/lib/rate-limit')

    // Manually inject a stale attempt by manipulating time via fake timers.
    jest.useFakeTimers()
    jest.setSystemTime(past)
    recordFailedAttempt('ip1', { maxAttempts: 3, windowMs: 60_000 })
    recordFailedAttempt('ip1', { maxAttempts: 3, windowMs: 60_000 })
    recordFailedAttempt('ip1', { maxAttempts: 3, windowMs: 60_000 })

    // Advance to "now" — the three stale attempts should be pruned.
    jest.setSystemTime(Date.now() + 90_000)
    const result = recordFailedAttempt('ip1', { maxAttempts: 3, windowMs: 60_000 })
    jest.useRealTimers()

    expect(result.limited).toBe(false)
  })
})

// ── clearAttempts ────────────────────────────────────────────────────────────

describe('clearAttempts', () => {
  it('removes all recorded attempts for the given key', () => {
    for (let i = 0; i < 4; i++) {
      recordFailedAttempt('ip1', { maxAttempts: 3, windowMs: 60_000 })
    }
    clearAttempts('ip1')
    const result = isLimited('ip1', { maxAttempts: 3, windowMs: 60_000 })
    expect(result.limited).toBe(false)
  })

  it('does not affect other keys', () => {
    for (let i = 0; i < 4; i++) {
      recordFailedAttempt('ip-a', { maxAttempts: 3, windowMs: 60_000 })
      recordFailedAttempt('ip-b', { maxAttempts: 3, windowMs: 60_000 })
    }
    clearAttempts('ip-a')
    const resultB = isLimited('ip-b', { maxAttempts: 3, windowMs: 60_000 })
    expect(resultB.limited).toBe(true)
  })

  it('is safe to call for a key with no history', () => {
    expect(() => clearAttempts('never-seen')).not.toThrow()
  })
})

// ── isLimited ────────────────────────────────────────────────────────────────

describe('isLimited', () => {
  it('returns false for an unknown key', () => {
    expect(isLimited('unknown').limited).toBe(false)
  })

  it('returns false below the threshold', () => {
    for (let i = 0; i < 3; i++) {
      recordFailedAttempt('ip1', { maxAttempts: 5, windowMs: 60_000 })
    }
    expect(isLimited('ip1', { maxAttempts: 5, windowMs: 60_000 }).limited).toBe(false)
  })

  it('returns true at or above the threshold', () => {
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt('ip1', { maxAttempts: 5, windowMs: 60_000 })
    }
    const result = isLimited('ip1', { maxAttempts: 5, windowMs: 60_000 })
    expect(result.limited).toBe(true)
  })

  it('does NOT record a new attempt', () => {
    // Fill to exactly the limit (not over).
    for (let i = 0; i < 4; i++) {
      recordFailedAttempt('ip1', { maxAttempts: 5, windowMs: 60_000 })
    }
    // Calling isLimited should not push us over.
    isLimited('ip1', { maxAttempts: 5, windowMs: 60_000 })
    isLimited('ip1', { maxAttempts: 5, windowMs: 60_000 })
    expect(isLimited('ip1', { maxAttempts: 5, windowMs: 60_000 }).limited).toBe(false)
  })
})
