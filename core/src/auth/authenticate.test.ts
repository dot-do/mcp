/**
 * Authenticate Request Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { authenticateRequest } from './authenticate.js'
import type { AuthConfig } from './types.js'

describe('authenticateRequest', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('anon mode', () => {
    it('should always return anonymous context', async () => {
      const config: AuthConfig = { mode: 'anon' }
      const request = new Request('https://example.com/api')

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.context.type).toBe('anon')
        expect(result.context.readonly).toBe(true)
      }
    })

    it('should ignore Authorization header in anon mode', async () => {
      const config: AuthConfig = { mode: 'anon' }
      const request = new Request('https://example.com/api', {
        headers: { Authorization: 'Bearer some-token' },
      })

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.context.type).toBe('anon')
      }
    })
  })

  describe('anon+auth mode', () => {
    it('should return anonymous context when no auth header', async () => {
      const config: AuthConfig = { mode: 'anon+auth' }
      const request = new Request('https://example.com/api')

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.context.type).toBe('anon')
      }
    })

    it('should authenticate when valid OAuth token provided', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            active: true,
            sub: 'user-123',
            scope: 'read write',
          }),
      })

      const config: AuthConfig = {
        mode: 'anon+auth',
        oauth: { introspectionUrl: 'https://auth.example.com/introspect' },
      }
      const request = new Request('https://example.com/api', {
        headers: { Authorization: 'Bearer eyJ.test.jwt' },
      })

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.context.type).toBe('oauth')
        expect(result.context.id).toBe('user-123')
      }
    })

    it('should return error for malformed auth header', async () => {
      const config: AuthConfig = { mode: 'anon+auth' }
      const request = new Request('https://example.com/api', {
        headers: { Authorization: 'InvalidFormat' },
      })

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_AUTH_HEADER')
      }
    })
  })

  describe('auth-required mode', () => {
    it('should return error when no auth header', async () => {
      const config: AuthConfig = { mode: 'auth-required' }
      const request = new Request('https://example.com/api')

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED')
        expect(result.error.message).toBe('Authentication required')
      }
    })

    it('should return error for unsupported auth scheme', async () => {
      const config: AuthConfig = { mode: 'auth-required' }
      const request = new Request('https://example.com/api', {
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      })

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('UNSUPPORTED_AUTH_SCHEME')
      }
    })

    it('should authenticate with JWT token via OAuth', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            active: true,
            sub: 'user-456',
          }),
      })

      const config: AuthConfig = {
        mode: 'auth-required',
        oauth: { introspectionUrl: 'https://auth.example.com/introspect' },
      }
      const request = new Request('https://example.com/api', {
        headers: { Authorization: 'Bearer eyJ.payload.signature' },
      })

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.context.type).toBe('oauth')
      }
    })

    it('should authenticate with sk_ API key', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            valid: true,
            keyId: 'key-789',
            permissions: ['read'],
          }),
      })

      const config: AuthConfig = {
        mode: 'auth-required',
        apiKey: { verifyUrl: 'https://api.example.com/verify' },
      }
      const request = new Request('https://example.com/api', {
        headers: { Authorization: 'Bearer sk_live_abc123' },
      })

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.context.type).toBe('apikey')
        expect(result.context.id).toBe('key-789')
      }
    })

    it('should authenticate with do_ API key', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            valid: true,
            keyId: 'do-key-001',
            permissions: ['read', 'write'],
          }),
      })

      const config: AuthConfig = {
        mode: 'auth-required',
        apiKey: { verifyUrl: 'https://api.example.com/verify' },
      }
      const request = new Request('https://example.com/api', {
        headers: { Authorization: 'Bearer do_test_xyz789' },
      })

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.context.type).toBe('apikey')
        expect(result.context.id).toBe('do-key-001')
      }
    })

    it('should return error when OAuth config missing for JWT', async () => {
      const config: AuthConfig = { mode: 'auth-required' }
      const request = new Request('https://example.com/api', {
        headers: { Authorization: 'Bearer eyJ.payload.signature' },
      })

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NO_OAUTH_CONFIG')
      }
    })

    it('should return error when API key config missing for sk_ token', async () => {
      const config: AuthConfig = { mode: 'auth-required' }
      const request = new Request('https://example.com/api', {
        headers: { Authorization: 'Bearer sk_live_123' },
      })

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NO_API_KEY_CONFIG')
      }
    })

    it('should return error for inactive OAuth token', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ active: false }),
      })

      const config: AuthConfig = {
        mode: 'auth-required',
        oauth: { introspectionUrl: 'https://auth.example.com/introspect' },
      }
      const request = new Request('https://example.com/api', {
        headers: { Authorization: 'Bearer eyJ.expired.token' },
      })

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_TOKEN')
      }
    })

    it('should return error for invalid API key', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            valid: false,
            error: 'Key revoked',
          }),
      })

      const config: AuthConfig = {
        mode: 'auth-required',
        apiKey: { verifyUrl: 'https://api.example.com/verify' },
      }
      const request = new Request('https://example.com/api', {
        headers: { Authorization: 'Bearer sk_revoked_key' },
      })

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_API_KEY')
        expect(result.error.message).toBe('Key revoked')
      }
    })

    it('should try OAuth for unknown token type if OAuth config exists', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            active: true,
            sub: 'user-fallback',
          }),
      })

      const config: AuthConfig = {
        mode: 'auth-required',
        oauth: { introspectionUrl: 'https://auth.example.com/introspect' },
      }
      const request = new Request('https://example.com/api', {
        headers: { Authorization: 'Bearer some_unknown_token_format' },
      })

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.context.type).toBe('oauth')
      }
    })

    it('should return error for unknown token type with no OAuth config', async () => {
      const config: AuthConfig = { mode: 'auth-required' }
      const request = new Request('https://example.com/api', {
        headers: { Authorization: 'Bearer unknown_format' },
      })

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_AUTH_HEADER')
      }
    })
  })

  describe('error handling', () => {
    it('should handle OAuth introspection errors', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network timeout')
      )

      const config: AuthConfig = {
        mode: 'auth-required',
        oauth: { introspectionUrl: 'https://auth.example.com/introspect' },
      }
      const request = new Request('https://example.com/api', {
        headers: { Authorization: 'Bearer eyJ.test.jwt' },
      })

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('INTROSPECTION_ERROR')
        expect(result.error.message).toBe('Network timeout')
      }
    })

    it('should handle API key verification errors', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Service unavailable')
      )

      const config: AuthConfig = {
        mode: 'auth-required',
        apiKey: { verifyUrl: 'https://api.example.com/verify' },
      }
      const request = new Request('https://example.com/api', {
        headers: { Authorization: 'Bearer sk_test_key' },
      })

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VERIFICATION_ERROR')
        expect(result.error.message).toBe('Service unavailable')
      }
    })
  })
})
