/**
 * In-memory sliding-window rate limiter.
 *
 * Designed for the admin login endpoint:  tracks **failed** attempts per key
 * (typically the caller's IP address) and blocks further attempts once the
 * threshold is exceeded within the look-back window.
 *
 * Because the admin server is a single Node.js process, an in-process Map is
 * sufficient — no Redis or external store is needed.  The store is reset on
 * process restart (which also clears any lock-out), consistent with the
 * "one server, one admin" deployment model.
 */

export interface RateLimitOptions {
  /** Maximum number of failed attempts allowed within `windowMs`. Default 5. */
  maxAttempts?: number
  /** Look-back window in milliseconds. Default 15 minutes. */
  windowMs?: number
}

interface Attempt {
  timestamp: number
}

// Module-level store — one entry per IP.
const store = new Map<string, Attempt[]>()

/**
 * Record a failed login attempt for `key`.
 * Returns `{ limited: true, retryAfter }` when the caller is over the limit,
 * or `{ limited: false }` when they still have headroom.
 *
 * `retryAfter` is the number of **seconds** until the oldest blocking attempt
 * falls outside the window, i.e. the value suitable for the `Retry-After`
 * response header.
 */
export function recordFailedAttempt(
  key: string,
  opts: RateLimitOptions = {},
): { limited: true; retryAfter: number } | { limited: false } {
  const maxAttempts = opts.maxAttempts ?? 5
  const windowMs    = opts.windowMs    ?? 15 * 60 * 1000

  const now  = Date.now()
  const prev = store.get(key) ?? []

  // Prune attempts that have already left the window.
  const recent = prev.filter(a => now - a.timestamp < windowMs)

  // Append the current failure.
  recent.push({ timestamp: now })
  store.set(key, recent)

  if (recent.length > maxAttempts) {
    // The oldest entry still inside the window determines when the block lifts.
    const oldest     = recent[0].timestamp
    const retryAfter = Math.ceil((oldest + windowMs - now) / 1000)
    return { limited: true, retryAfter: Math.max(retryAfter, 1) }
  }

  return { limited: false }
}

/**
 * Clear the attempt history for `key` (call on successful login so a
 * legitimate user who previously mistyped their password isn't penalised).
 */
export function clearAttempts(key: string): void {
  store.delete(key)
}

/**
 * Check whether `key` is currently rate-limited **without** recording a new
 * attempt.  Useful for pre-flight checks.
 */
export function isLimited(
  key: string,
  opts: RateLimitOptions = {},
): { limited: true; retryAfter: number } | { limited: false } {
  const maxAttempts = opts.maxAttempts ?? 5
  const windowMs    = opts.windowMs    ?? 15 * 60 * 1000

  const now    = Date.now()
  const recent = (store.get(key) ?? []).filter(a => now - a.timestamp < windowMs)

  if (recent.length >= maxAttempts) {
    const oldest     = recent[0].timestamp
    const retryAfter = Math.ceil((oldest + windowMs - now) / 1000)
    return { limited: true, retryAfter: Math.max(retryAfter, 1) }
  }

  return { limited: false }
}

/** Exposed for tests — resets the entire store. */
export function _resetStore(): void {
  store.clear()
}
