/**
 * Rate Limiting for MCP Worker
 *
 * Implements sliding window rate limiting per session.
 */

import type { MiddlewareHandler } from 'hono'
import type { AuthContext } from '../auth/types.js'

/**
 * Rate limit configuration options
 */
export interface RateLimitOptions {
  /** Maximum number of requests allowed in the window */
  maxRequests: number
  /** Window duration in milliseconds */
  windowMs: number
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Number of remaining requests in the current window */
  remaining: number
  /** Maximum requests allowed */
  limit: number
  /** Seconds until the rate limit resets (only set when rate limited) */
  retryAfter?: number
}

/**
 * Sliding window entry for a session
 */
interface WindowEntry {
  /** Timestamp of the window start */
  windowStart: number
  /** Count of requests in the current window */
  currentCount: number
  /** Count of requests in the previous window (for sliding calculation) */
  previousCount: number
}

/**
 * Sliding Window Counter for rate limiting
 *
 * Uses the sliding window algorithm to smooth out rate limiting
 * and prevent burst traffic at window boundaries.
 */
export class SlidingWindowCounter {
  private readonly maxRequests: number
  private readonly windowMs: number
  private readonly sessions: Map<string, WindowEntry>

  constructor(options: RateLimitOptions) {
    this.maxRequests = options.maxRequests
    this.windowMs = options.windowMs
    this.sessions = new Map()
  }

  /**
   * Get or create a window entry for a session
   */
  private getEntry(sessionId: string): WindowEntry {
    const now = Date.now()
    let entry = this.sessions.get(sessionId)

    if (!entry) {
      entry = {
        windowStart: now,
        currentCount: 0,
        previousCount: 0,
      }
      this.sessions.set(sessionId, entry)
      return entry
    }

    const windowAge = now - entry.windowStart

    // If we've moved to a new window
    if (windowAge >= this.windowMs) {
      // Calculate how many windows have passed
      const windowsPassed = Math.floor(windowAge / this.windowMs)

      if (windowsPassed === 1) {
        // Move to next window
        entry.previousCount = entry.currentCount
        entry.currentCount = 0
        entry.windowStart += this.windowMs
      } else {
        // More than one window passed - reset everything
        entry.previousCount = 0
        entry.currentCount = 0
        entry.windowStart = now
      }
    }

    return entry
  }

  /**
   * Calculate the effective count using sliding window
   */
  private calculateEffectiveCount(entry: WindowEntry): number {
    const now = Date.now()
    const windowAge = now - entry.windowStart
    const windowProgress = Math.min(windowAge / this.windowMs, 1)

    // Sliding window calculation:
    // weight from previous window decreases as we progress through current window
    const previousWeight = 1 - windowProgress
    const effectiveCount =
      entry.currentCount + entry.previousCount * previousWeight

    return effectiveCount
  }

  /**
   * Check if a request is allowed for the given session
   */
  isAllowed(sessionId: string): boolean {
    const entry = this.getEntry(sessionId)
    const effectiveCount = this.calculateEffectiveCount(entry)
    return effectiveCount < this.maxRequests
  }

  /**
   * Increment the request count for a session
   */
  increment(sessionId: string): void {
    const entry = this.getEntry(sessionId)
    entry.currentCount++
  }

  /**
   * Get the remaining requests for a session
   */
  getRemaining(sessionId: string): number {
    const entry = this.getEntry(sessionId)
    const effectiveCount = this.calculateEffectiveCount(entry)
    return Math.max(0, Math.floor(this.maxRequests - effectiveCount))
  }

  /**
   * Get the retry-after time in seconds
   */
  getRetryAfter(sessionId: string): number {
    const entry = this.getEntry(sessionId)
    const now = Date.now()
    const windowAge = now - entry.windowStart
    const remainingMs = this.windowMs - windowAge

    // Return seconds until the window resets
    return Math.ceil(remainingMs / 1000)
  }

  /**
   * Clean up expired sessions (for memory management)
   */
  cleanup(): void {
    const now = Date.now()
    const maxAge = this.windowMs * 2 // Keep for 2 windows

    for (const [sessionId, entry] of this.sessions.entries()) {
      if (now - entry.windowStart > maxAge) {
        this.sessions.delete(sessionId)
      }
    }
  }
}

/**
 * Rate Limiter class for easy usage
 */
export class RateLimiter {
  private readonly counter: SlidingWindowCounter
  private readonly maxRequests: number

  constructor(options: RateLimitOptions = { maxRequests: 100, windowMs: 60000 }) {
    this.counter = new SlidingWindowCounter(options)
    this.maxRequests = options.maxRequests
  }

  /**
   * Check if a request is allowed and get rate limit info
   */
  check(sessionId: string): RateLimitResult {
    const allowed = this.counter.isAllowed(sessionId)
    const remaining = this.counter.getRemaining(sessionId)

    const result: RateLimitResult = {
      allowed,
      remaining,
      limit: this.maxRequests,
    }

    if (!allowed) {
      result.retryAfter = this.counter.getRetryAfter(sessionId)
    }

    return result
  }

  /**
   * Increment the request count
   */
  increment(sessionId: string): void {
    this.counter.increment(sessionId)
  }

  /**
   * Clean up expired sessions
   */
  cleanup(): void {
    this.counter.cleanup()
  }
}

// Default rate limiter instance (shared across requests in the worker)
let defaultLimiter: RateLimiter | null = null

/**
 * Get or create the default rate limiter
 */
function getDefaultLimiter(options?: RateLimitOptions): RateLimiter {
  if (!defaultLimiter || options) {
    defaultLimiter = new RateLimiter(options)
  }
  return defaultLimiter
}

/**
 * Extract session ID from the request context
 */
function extractSessionId(c: {
  get: (key: string) => AuthContext | undefined
  req: { header: (name: string) => string | null }
}): string {
  // Try to get session ID from auth context
  const authContext = c.get('authContext')
  if (authContext && authContext.id && authContext.type !== 'anon') {
    return `auth:${authContext.id}`
  }

  // Try to get session ID from header
  const sessionHeader = c.req.header('X-Session-ID')
  if (sessionHeader) {
    return `session:${sessionHeader}`
  }

  // Fall back to anonymous (will be more strictly rate limited)
  return `anon:${authContext?.id || 'unknown'}`
}

/**
 * Create rate limit middleware for Hono
 */
export function createRateLimitMiddleware(
  options?: RateLimitOptions
): MiddlewareHandler {
  const limiter = getDefaultLimiter(options)

  return async (c, next) => {
    const sessionId = extractSessionId(c)
    const result = limiter.check(sessionId)

    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(result.limit))
    c.header('X-RateLimit-Remaining', String(result.remaining))

    if (!result.allowed) {
      c.header('Retry-After', String(result.retryAfter))
      return c.json(
        {
          error: 'Too many requests - rate limit exceeded',
          retryAfter: result.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(result.retryAfter),
          },
        }
      )
    }

    // Increment counter for this request
    limiter.increment(sessionId)

    await next()
  }
}

/**
 * Rate limiting middleware with default options
 */
export const rateLimit = createRateLimitMiddleware
