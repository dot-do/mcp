/**
 * Rate Limiting Tests
 *
 * Tests for sliding window rate limiting per session.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RateLimiter,
  createRateLimitMiddleware,
  SlidingWindowCounter,
} from '../../src/worker/rate-limit.js'

describe('SlidingWindowCounter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should allow requests within the limit', () => {
    const counter = new SlidingWindowCounter({
      maxRequests: 10,
      windowMs: 60000, // 1 minute
    })

    for (let i = 0; i < 10; i++) {
      expect(counter.isAllowed('session-1')).toBe(true)
      counter.increment('session-1')
    }
  })

  it('should block requests exceeding the limit', () => {
    const counter = new SlidingWindowCounter({
      maxRequests: 5,
      windowMs: 60000,
    })

    // Make 5 requests (should all be allowed)
    for (let i = 0; i < 5; i++) {
      expect(counter.isAllowed('session-1')).toBe(true)
      counter.increment('session-1')
    }

    // 6th request should be blocked
    expect(counter.isAllowed('session-1')).toBe(false)
  })

  it('should track sessions independently', () => {
    const counter = new SlidingWindowCounter({
      maxRequests: 2,
      windowMs: 60000,
    })

    // Session 1 makes 2 requests
    counter.increment('session-1')
    counter.increment('session-1')
    expect(counter.isAllowed('session-1')).toBe(false)

    // Session 2 should still be allowed
    expect(counter.isAllowed('session-2')).toBe(true)
  })

  it('should reset after the window expires', () => {
    const counter = new SlidingWindowCounter({
      maxRequests: 2,
      windowMs: 60000,
    })

    counter.increment('session-1')
    counter.increment('session-1')
    expect(counter.isAllowed('session-1')).toBe(false)

    // Advance time past the window
    vi.advanceTimersByTime(60001)

    // Should be allowed again
    expect(counter.isAllowed('session-1')).toBe(true)
  })

  it('should implement sliding window correctly', () => {
    const counter = new SlidingWindowCounter({
      maxRequests: 10,
      windowMs: 60000,
    })

    // Make 8 requests at time 0 (in current window)
    for (let i = 0; i < 8; i++) {
      counter.increment('session-1')
    }

    // Advance past the first window into the second window (70% through)
    // This moves the 8 requests to the "previous" window
    vi.advanceTimersByTime(70000) // 60000 + 10000 (10 seconds into new window)

    // At 10 seconds into new window (16.7% progress):
    // Previous window weight = 1 - 0.167 = 0.833
    // Effective count from previous = 8 * 0.833 = 6.67
    // So we should be able to make about 3 more requests
    // (6.67 + 3 = 9.67, just under 10)

    expect(counter.isAllowed('session-1')).toBe(true)
    counter.increment('session-1')
    expect(counter.isAllowed('session-1')).toBe(true)
    counter.increment('session-1')

    // After 2 more requests: 6.67 + 2 = 8.67, still under 10
    expect(counter.isAllowed('session-1')).toBe(true)
  })

  it('should return remaining requests count', () => {
    const counter = new SlidingWindowCounter({
      maxRequests: 10,
      windowMs: 60000,
    })

    expect(counter.getRemaining('session-1')).toBe(10)

    counter.increment('session-1')
    counter.increment('session-1')
    counter.increment('session-1')

    expect(counter.getRemaining('session-1')).toBe(7)
  })

  it('should return retry-after time when rate limited', () => {
    const counter = new SlidingWindowCounter({
      maxRequests: 1,
      windowMs: 60000,
    })

    counter.increment('session-1')
    expect(counter.isAllowed('session-1')).toBe(false)

    const retryAfter = counter.getRetryAfter('session-1')
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(60)
  })
})

describe('RateLimiter', () => {
  it('should create a rate limiter with default options', () => {
    const limiter = new RateLimiter()
    expect(limiter).toBeDefined()
  })

  it('should accept custom configuration', () => {
    const limiter = new RateLimiter({
      maxRequests: 100,
      windowMs: 300000, // 5 minutes
    })
    expect(limiter).toBeDefined()
  })

  it('should check if request is allowed', () => {
    const limiter = new RateLimiter({
      maxRequests: 5,
      windowMs: 60000,
    })

    const result = limiter.check('session-123')
    expect(result).toHaveProperty('allowed')
    expect(result).toHaveProperty('remaining')
  })

  it('should return proper rate limit info', () => {
    const limiter = new RateLimiter({
      maxRequests: 10,
      windowMs: 60000,
    })

    const result = limiter.check('session-abc')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(10)
    expect(result.limit).toBe(10)
  })

  it('should include retry-after when rate limited', () => {
    const limiter = new RateLimiter({
      maxRequests: 1,
      windowMs: 60000,
    })

    // First request
    limiter.check('session-xyz')
    limiter.increment('session-xyz')

    // Second request should be rate limited
    const result = limiter.check('session-xyz')
    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBeDefined()
    expect(result.retryAfter).toBeGreaterThan(0)
  })
})

describe('Rate Limit Middleware', () => {
  it('should create middleware with default options', () => {
    const middleware = createRateLimitMiddleware()
    expect(typeof middleware).toBe('function')
  })

  it('should create middleware with custom options', () => {
    const middleware = createRateLimitMiddleware({
      maxRequests: 50,
      windowMs: 120000,
    })
    expect(typeof middleware).toBe('function')
  })

  it('should extract session ID from auth context', async () => {
    const middleware = createRateLimitMiddleware({
      maxRequests: 10,
      windowMs: 60000,
    })

    const mockContext = {
      get: vi.fn().mockReturnValue({ id: 'user-123', type: 'oauth', readonly: false }),
      req: { header: vi.fn().mockReturnValue(null) },
      header: vi.fn(),
      json: vi.fn().mockReturnValue(new Response()),
    }

    const next = vi.fn().mockResolvedValue(undefined)

    await middleware(mockContext as any, next)

    expect(next).toHaveBeenCalled()
  })

  it('should extract session ID from X-Session-ID header', async () => {
    const middleware = createRateLimitMiddleware({
      maxRequests: 10,
      windowMs: 60000,
    })

    const mockContext = {
      get: vi.fn().mockReturnValue({ id: 'anonymous', type: 'anon', readonly: true }),
      req: { header: vi.fn().mockReturnValue('session-header-123') },
      header: vi.fn(),
      json: vi.fn().mockReturnValue(new Response()),
    }

    const next = vi.fn().mockResolvedValue(undefined)

    await middleware(mockContext as any, next)

    expect(next).toHaveBeenCalled()
  })

  it('should return 429 when rate limited', async () => {
    const middleware = createRateLimitMiddleware({
      maxRequests: 1,
      windowMs: 60000,
    })

    const mockJson = vi.fn().mockReturnValue(new Response('', { status: 429 }))
    const mockContext = {
      get: vi.fn().mockReturnValue({ id: 'user-456', type: 'oauth', readonly: false }),
      req: { header: vi.fn().mockReturnValue(null) },
      header: vi.fn(),
      json: mockJson,
    }

    const next = vi.fn().mockResolvedValue(undefined)

    // First request - should pass
    await middleware(mockContext as any, next)
    expect(next).toHaveBeenCalledTimes(1)

    // Second request - should be rate limited
    next.mockClear()
    const response = await middleware(mockContext as any, next)

    expect(next).not.toHaveBeenCalled()
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('rate limit'),
      }),
      expect.objectContaining({
        status: 429,
      })
    )
  })

  it('should set rate limit headers', async () => {
    const middleware = createRateLimitMiddleware({
      maxRequests: 100,
      windowMs: 60000,
    })

    const mockHeader = vi.fn()
    const mockContext = {
      get: vi.fn().mockReturnValue({ id: 'user-789', type: 'oauth', readonly: false }),
      req: { header: vi.fn().mockReturnValue(null) },
      header: mockHeader,
      json: vi.fn(),
    }

    const next = vi.fn().mockResolvedValue(undefined)

    await middleware(mockContext as any, next)

    expect(mockHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '100')
    expect(mockHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String))
  })
})
