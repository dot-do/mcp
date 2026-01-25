/**
 * Token Cache Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createTokenCache, CachedAuthenticator } from './cache.js'
import type { AuthResult } from './types.js'

describe('Token Cache', () => {
  describe('createTokenCache', () => {
    it('should create an empty cache', () => {
      const cache = createTokenCache<string>()
      const stats = cache.stats()

      expect(stats.size).toBe(0)
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
    })

    it('should store and retrieve values', () => {
      const cache = createTokenCache<string>()

      cache.set('key1', 'value1')
      const result = cache.get('key1')

      expect(result).toBe('value1')
    })

    it('should return undefined for missing keys', () => {
      const cache = createTokenCache<string>()

      const result = cache.get('nonexistent')

      expect(result).toBeUndefined()
    })

    it('should track hits and misses', () => {
      const cache = createTokenCache<string>()

      cache.set('key1', 'value1')
      cache.get('key1') // hit
      cache.get('key1') // hit
      cache.get('missing') // miss

      const stats = cache.stats()
      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(1)
    })

    it('should expire entries after TTL', async () => {
      const cache = createTokenCache<string>({ ttlMs: 50 })

      cache.set('key1', 'value1')
      expect(cache.get('key1')).toBe('value1')

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(cache.get('key1')).toBeUndefined()
    })

    it('should allow custom TTL per entry', async () => {
      const cache = createTokenCache<string>({ ttlMs: 1000 })

      cache.set('short', 'value', 50) // 50ms TTL
      cache.set('long', 'value', 5000) // 5s TTL

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(cache.get('short')).toBeUndefined()
      expect(cache.get('long')).toBe('value')
    })

    it('should delete entries', () => {
      const cache = createTokenCache<string>()

      cache.set('key1', 'value1')
      expect(cache.get('key1')).toBe('value1')

      cache.delete('key1')
      expect(cache.get('key1')).toBeUndefined()
    })

    it('should clear all entries', () => {
      const cache = createTokenCache<string>()

      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.get('key1') // hit

      cache.clear()

      // Check stats are reset first
      const stats = cache.stats()
      expect(stats.size).toBe(0)
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)

      // Now verify entries are gone (these will increment misses)
      expect(cache.get('key1')).toBeUndefined()
      expect(cache.get('key2')).toBeUndefined()
    })

    it('should evict oldest entries when maxSize exceeded', () => {
      const cache = createTokenCache<string>({ maxSize: 3 })

      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')
      cache.set('key4', 'value4')

      const stats = cache.stats()
      expect(stats.size).toBe(3)
      expect(cache.get('key1')).toBeUndefined() // Oldest evicted
      expect(cache.get('key4')).toBe('value4') // Newest kept
    })
  })

  describe('CachedAuthenticator', () => {
    it('should call verify function on cache miss', async () => {
      const verifyFn = vi.fn<[string], Promise<AuthResult>>().mockResolvedValue({
        success: true,
        context: { type: 'oauth', id: 'user-123', readonly: false },
      })

      const auth = new CachedAuthenticator(verifyFn)
      const result = await auth.verify('token-123')

      expect(verifyFn).toHaveBeenCalledWith('token-123')
      expect(result.success).toBe(true)
    })

    it('should return cached result on cache hit', async () => {
      const verifyFn = vi.fn<[string], Promise<AuthResult>>().mockResolvedValue({
        success: true,
        context: { type: 'oauth', id: 'user-123', readonly: false },
      })

      const auth = new CachedAuthenticator(verifyFn)

      // First call - cache miss
      await auth.verify('token-123')
      // Second call - cache hit
      await auth.verify('token-123')

      expect(verifyFn).toHaveBeenCalledTimes(1)
    })

    it('should not cache failed results', async () => {
      const verifyFn = vi.fn<[string], Promise<AuthResult>>().mockResolvedValue({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Token expired' },
      })

      const auth = new CachedAuthenticator(verifyFn)

      await auth.verify('bad-token')
      await auth.verify('bad-token')

      expect(verifyFn).toHaveBeenCalledTimes(2) // Not cached
    })

    it('should deduplicate concurrent requests for same token', async () => {
      let resolveVerify: (result: AuthResult) => void
      const verifyPromise = new Promise<AuthResult>((resolve) => {
        resolveVerify = resolve
      })

      const verifyFn = vi.fn<[string], Promise<AuthResult>>().mockReturnValue(verifyPromise)

      const auth = new CachedAuthenticator(verifyFn)

      // Start two concurrent requests
      const promise1 = auth.verify('token-123')
      const promise2 = auth.verify('token-123')

      // Only one verify call should be made
      expect(verifyFn).toHaveBeenCalledTimes(1)

      // Resolve the verify
      resolveVerify!({
        success: true,
        context: { type: 'oauth', id: 'user-123', readonly: false },
      })

      // Both should resolve with same result
      const [result1, result2] = await Promise.all([promise1, promise2])
      expect(result1).toEqual(result2)
    })

    it('should expose cache stats', async () => {
      const verifyFn = vi.fn<[string], Promise<AuthResult>>().mockResolvedValue({
        success: true,
        context: { type: 'oauth', id: 'user-123', readonly: false },
      })

      const auth = new CachedAuthenticator(verifyFn)

      await auth.verify('token-1')
      await auth.verify('token-1') // hit
      await auth.verify('token-2')

      const stats = auth.stats()
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(2)
      expect(stats.size).toBe(2)
    })

    it('should allow clearing the cache', async () => {
      const verifyFn = vi.fn<[string], Promise<AuthResult>>().mockResolvedValue({
        success: true,
        context: { type: 'oauth', id: 'user-123', readonly: false },
      })

      const auth = new CachedAuthenticator(verifyFn)

      await auth.verify('token-123')
      auth.clearCache()
      await auth.verify('token-123')

      expect(verifyFn).toHaveBeenCalledTimes(2) // Cache was cleared
    })

    it('should support custom cache options', async () => {
      const verifyFn = vi.fn<[string], Promise<AuthResult>>().mockResolvedValue({
        success: true,
        context: { type: 'oauth', id: 'user-123', readonly: false },
      })

      const auth = new CachedAuthenticator(verifyFn, { ttlMs: 50 })

      await auth.verify('token-123')
      expect(verifyFn).toHaveBeenCalledTimes(1)

      await new Promise((resolve) => setTimeout(resolve, 100))

      await auth.verify('token-123')
      expect(verifyFn).toHaveBeenCalledTimes(2) // TTL expired
    })

    it('should work with destructured methods', async () => {
      const verifyFn = vi.fn<[string], Promise<AuthResult>>().mockResolvedValue({
        success: true,
        context: { type: 'oauth', id: 'user-123', readonly: false },
      })

      const auth = new CachedAuthenticator(verifyFn)
      const { verify, clearCache, stats } = auth

      const result = await verify('token-123')
      expect(result.success).toBe(true)

      expect(stats().size).toBe(1)

      clearCache()
      expect(stats().size).toBe(0)
    })
  })
})
