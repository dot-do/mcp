import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TokenCache, createTokenCache, CachedAuthenticator } from './cache'
import type { AuthContext, AuthResult } from './types'

describe('TokenCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('basic operations', () => {
    it('should store and retrieve cached values', () => {
      const cache = createTokenCache<AuthContext>()
      const context: AuthContext = {
        type: 'oauth',
        id: 'user-123',
        readonly: false,
      }

      cache.set('token-abc', context)
      const result = cache.get('token-abc')

      expect(result).toEqual(context)
    })

    it('should return undefined for missing keys', () => {
      const cache = createTokenCache<AuthContext>()
      const result = cache.get('nonexistent')

      expect(result).toBeUndefined()
    })

    it('should delete cached values', () => {
      const cache = createTokenCache<AuthContext>()
      const context: AuthContext = {
        type: 'apikey',
        id: 'key-1',
        readonly: true,
      }

      cache.set('key', context)
      cache.delete('key')
      const result = cache.get('key')

      expect(result).toBeUndefined()
    })

    it('should clear all cached values', () => {
      const cache = createTokenCache<AuthContext>()
      cache.set('key1', { type: 'oauth', id: '1', readonly: false })
      cache.set('key2', { type: 'oauth', id: '2', readonly: false })

      cache.clear()

      expect(cache.get('key1')).toBeUndefined()
      expect(cache.get('key2')).toBeUndefined()
    })
  })

  describe('TTL expiration', () => {
    it('should expire entries after TTL', () => {
      const cache = createTokenCache<AuthContext>({ ttlMs: 5000 })
      const context: AuthContext = {
        type: 'oauth',
        id: 'user-123',
        readonly: false,
      }

      cache.set('token', context)

      // Before expiration
      vi.advanceTimersByTime(4999)
      expect(cache.get('token')).toEqual(context)

      // After expiration
      vi.advanceTimersByTime(2)
      expect(cache.get('token')).toBeUndefined()
    })

    it('should use custom TTL per entry', () => {
      const cache = createTokenCache<AuthContext>({ ttlMs: 10000 })
      const context: AuthContext = {
        type: 'oauth',
        id: 'user-123',
        readonly: false,
      }

      cache.set('token', context, 2000) // 2 second TTL

      vi.advanceTimersByTime(1999)
      expect(cache.get('token')).toEqual(context)

      vi.advanceTimersByTime(2)
      expect(cache.get('token')).toBeUndefined()
    })

    it('should refresh TTL on update', () => {
      const cache = createTokenCache<AuthContext>({ ttlMs: 5000 })
      const context: AuthContext = {
        type: 'oauth',
        id: 'user-123',
        readonly: false,
      }

      cache.set('token', context)

      // Advance 3 seconds
      vi.advanceTimersByTime(3000)

      // Update with same key
      const updated = { ...context, id: 'user-456' }
      cache.set('token', updated)

      // Advance another 3 seconds (6 total from start)
      vi.advanceTimersByTime(3000)

      // Should still be valid since we refreshed
      expect(cache.get('token')).toEqual(updated)
    })
  })

  describe('max size limit', () => {
    it('should evict oldest entries when max size exceeded', () => {
      const cache = createTokenCache<AuthContext>({ maxSize: 3 })

      cache.set('key1', { type: 'oauth', id: '1', readonly: false })
      vi.advanceTimersByTime(100)
      cache.set('key2', { type: 'oauth', id: '2', readonly: false })
      vi.advanceTimersByTime(100)
      cache.set('key3', { type: 'oauth', id: '3', readonly: false })
      vi.advanceTimersByTime(100)
      cache.set('key4', { type: 'oauth', id: '4', readonly: false })

      // key1 should be evicted (oldest)
      expect(cache.get('key1')).toBeUndefined()
      expect(cache.get('key2')).toBeDefined()
      expect(cache.get('key3')).toBeDefined()
      expect(cache.get('key4')).toBeDefined()
    })
  })

  describe('stats', () => {
    it('should track hit and miss counts', () => {
      const cache = createTokenCache<AuthContext>()
      const context: AuthContext = {
        type: 'oauth',
        id: 'user-123',
        readonly: false,
      }

      cache.set('exists', context)

      cache.get('exists') // hit
      cache.get('exists') // hit
      cache.get('missing') // miss

      const stats = cache.stats()
      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(1)
    })

    it('should report size', () => {
      const cache = createTokenCache<AuthContext>()

      cache.set('key1', { type: 'oauth', id: '1', readonly: false })
      cache.set('key2', { type: 'oauth', id: '2', readonly: false })

      const stats = cache.stats()
      expect(stats.size).toBe(2)
    })
  })
})

describe('CachedAuthenticator', () => {
  const mockVerify = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    mockVerify.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should cache successful authentication results', async () => {
    const successResult: AuthResult = {
      success: true,
      context: { type: 'oauth', id: 'user-123', readonly: false },
    }
    mockVerify.mockResolvedValue(successResult)

    const { verify } = new CachedAuthenticator(mockVerify)

    await verify('token-abc')
    await verify('token-abc')

    expect(mockVerify).toHaveBeenCalledTimes(1)
  })

  it('should not cache failed authentication results', async () => {
    const failResult: AuthResult = {
      success: false,
      error: { code: 'INVALID', message: 'Invalid token' },
    }
    mockVerify.mockResolvedValue(failResult)

    const { verify } = new CachedAuthenticator(mockVerify)

    await verify('bad-token')
    await verify('bad-token')

    expect(mockVerify).toHaveBeenCalledTimes(2)
  })

  it('should respect cache TTL', async () => {
    const successResult: AuthResult = {
      success: true,
      context: { type: 'oauth', id: 'user-123', readonly: false },
    }
    mockVerify.mockResolvedValue(successResult)

    const { verify } = new CachedAuthenticator(mockVerify, { ttlMs: 5000 })

    await verify('token')

    // Before expiration
    vi.advanceTimersByTime(4000)
    await verify('token')
    expect(mockVerify).toHaveBeenCalledTimes(1)

    // After expiration
    vi.advanceTimersByTime(2000)
    await verify('token')
    expect(mockVerify).toHaveBeenCalledTimes(2)
  })

  it('should clear cache', async () => {
    const successResult: AuthResult = {
      success: true,
      context: { type: 'oauth', id: 'user-123', readonly: false },
    }
    mockVerify.mockResolvedValue(successResult)

    const authenticator = new CachedAuthenticator(mockVerify)

    await authenticator.verify('token')
    authenticator.clearCache()
    await authenticator.verify('token')

    expect(mockVerify).toHaveBeenCalledTimes(2)
  })

  it('should handle concurrent requests for same token', async () => {
    vi.useRealTimers() // Use real timers for this test

    const successResult: AuthResult = {
      success: true,
      context: { type: 'oauth', id: 'user-123', readonly: false },
    }

    let resolveVerify: (value: AuthResult) => void
    mockVerify.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveVerify = resolve
        })
    )

    const { verify } = new CachedAuthenticator(mockVerify)

    // Start multiple concurrent requests
    const promises = [verify('token'), verify('token'), verify('token')]

    // Resolve the verify
    resolveVerify!(successResult)

    const results = await Promise.all(promises)

    // Should only call verify once
    expect(mockVerify).toHaveBeenCalledTimes(1)
    expect(results).toHaveLength(3)
    results.forEach((r) => expect(r).toEqual(successResult))
  })
})
