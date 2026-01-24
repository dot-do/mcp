/**
 * Token Cache for MCP Server Authentication
 *
 * Provides in-memory caching for authentication results to reduce
 * external verification calls.
 */

import type { AuthResult } from './types.js'

/**
 * Cache entry with value and expiration timestamp
 */
interface CacheEntry<T> {
  value: T
  expiresAt: number
  createdAt: number
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number
  misses: number
  size: number
}

/**
 * Cache options
 */
export interface CacheOptions {
  /** Time-to-live in milliseconds (default: 5 minutes) */
  ttlMs?: number
  /** Maximum number of entries (default: 1000) */
  maxSize?: number
}

/**
 * Token cache interface
 */
export interface TokenCache<T> {
  get(key: string): T | undefined
  set(key: string, value: T, ttlMs?: number): void
  delete(key: string): void
  clear(): void
  stats(): CacheStats
}

/**
 * Create a token cache with TTL and LRU eviction
 */
export function createTokenCache<T>(options?: CacheOptions): TokenCache<T> {
  const ttlMs = options?.ttlMs ?? 5 * 60 * 1000 // 5 minutes default
  const maxSize = options?.maxSize ?? 1000

  const cache = new Map<string, CacheEntry<T>>()
  let hits = 0
  let misses = 0

  /**
   * Remove expired entries
   */
  function cleanExpired(): void {
    const now = Date.now()
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= now) {
        cache.delete(key)
      }
    }
  }

  /**
   * Evict oldest entries if over max size
   */
  function evictOldest(): void {
    if (cache.size <= maxSize) return

    // Sort by createdAt and remove oldest
    const entries = Array.from(cache.entries()).sort(
      ([, a], [, b]) => a.createdAt - b.createdAt
    )

    const toRemove = cache.size - maxSize
    for (let i = 0; i < toRemove; i++) {
      cache.delete(entries[i][0])
    }
  }

  return {
    get(key: string): T | undefined {
      cleanExpired()
      const entry = cache.get(key)

      if (!entry) {
        misses++
        return undefined
      }

      const now = Date.now()
      if (entry.expiresAt <= now) {
        cache.delete(key)
        misses++
        return undefined
      }

      hits++
      return entry.value
    },

    set(key: string, value: T, customTtlMs?: number): void {
      const now = Date.now()
      const entryTtl = customTtlMs ?? ttlMs

      cache.set(key, {
        value,
        expiresAt: now + entryTtl,
        createdAt: now,
      })

      evictOldest()
    },

    delete(key: string): void {
      cache.delete(key)
    },

    clear(): void {
      cache.clear()
      hits = 0
      misses = 0
    },

    stats(): CacheStats {
      cleanExpired()
      return {
        hits,
        misses,
        size: cache.size,
      }
    },
  }
}

/**
 * Verify function type
 */
type VerifyFn = (token: string) => Promise<AuthResult>

/**
 * Cached authenticator that wraps a verify function
 *
 * Features:
 * - Caches successful auth results
 * - Does not cache failures
 * - Deduplicates concurrent requests for same token
 */
export class CachedAuthenticator {
  private cache: TokenCache<AuthResult>
  private pending = new Map<string, Promise<AuthResult>>()
  private verifyFn: VerifyFn

  constructor(verifyFn: VerifyFn, options?: CacheOptions) {
    this.verifyFn = verifyFn
    this.cache = createTokenCache<AuthResult>(options)
    // Bind methods for destructuring support
    this.verify = this.verify.bind(this)
    this.clearCache = this.clearCache.bind(this)
    this.stats = this.stats.bind(this)
  }

  /**
   * Verify a token with caching
   */
  async verify(token: string): Promise<AuthResult> {
    // Check cache first
    const cached = this.cache.get(token)
    if (cached) {
      return cached
    }

    // Check for pending request
    const pending = this.pending.get(token)
    if (pending) {
      return pending
    }

    // Start new verification
    const promise = this.doVerify(token)
    this.pending.set(token, promise)

    try {
      const result = await promise
      return result
    } finally {
      this.pending.delete(token)
    }
  }

  /**
   * Perform verification and cache result
   */
  private async doVerify(token: string): Promise<AuthResult> {
    const result = await this.verifyFn(token)

    // Only cache successful results
    if (result.success) {
      this.cache.set(token, result)
    }

    return result
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  stats(): CacheStats {
    return this.cache.stats()
  }
}
