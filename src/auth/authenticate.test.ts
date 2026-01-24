import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { authenticateRequest } from './authenticate'
import type { AuthConfig, AuthResult } from './types'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('authenticateRequest', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('anon mode', () => {
    const config: AuthConfig = { mode: 'anon' }

    it('should return anonymous context when no auth header', async () => {
      const request = new Request('https://example.com/api')
      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.context.type).toBe('anon')
        expect(result.context.readonly).toBe(true)
      }
    })

    it('should return anonymous context even with auth header (ignored in anon mode)', async () => {
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
    const config: AuthConfig = {
      mode: 'anon+auth',
      oauth: { introspectionUrl: 'https://auth.example.com/introspect' },
      apiKey: { verifyUrl: 'https://api.example.com/verify-key' },
    }

    it('should return anonymous context when no auth header', async () => {
      const request = new Request('https://example.com/api')
      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.context.type).toBe('anon')
        expect(result.context.readonly).toBe(true)
      }
    })

    it('should authenticate JWT token via OAuth introspection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          active: true,
          sub: 'user-123',
          scope: 'read write',
        }),
      })

      // Use a JWT-like token (three base64 parts)
      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.signature'
      const request = new Request('https://example.com/api', {
        headers: { Authorization: `Bearer ${jwt}` },
      })

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.context.type).toBe('oauth')
        expect(result.context.id).toBe('user-123')
      }
    })

    it('should authenticate sk_ prefixed API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          valid: true,
          keyId: 'key-abc',
          name: 'Test Key',
          permissions: ['read', 'write'],
        }),
      })

      const request = new Request('https://example.com/api', {
        headers: { Authorization: 'Bearer sk_live_abc123' },
      })

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.context.type).toBe('apikey')
        expect(result.context.id).toBe('key-abc')
      }
    })

    it('should authenticate do_ prefixed API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          valid: true,
          keyId: 'do-key-xyz',
          permissions: ['read'],
        }),
      })

      const request = new Request('https://example.com/api', {
        headers: { Authorization: 'Bearer do_test_xyz789' },
      })

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.context.type).toBe('apikey')
        expect(result.context.id).toBe('do-key-xyz')
      }
    })
  })

  describe('auth-required mode', () => {
    const config: AuthConfig = {
      mode: 'auth-required',
      oauth: { introspectionUrl: 'https://auth.example.com/introspect' },
      apiKey: { verifyUrl: 'https://api.example.com/verify-key' },
    }

    it('should return error when no auth header', async () => {
      const request = new Request('https://example.com/api')
      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED')
      }
    })

    it('should authenticate valid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          active: true,
          sub: 'user-456',
          scope: 'read write',
        }),
      })

      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTQ1NiJ9.signature'
      const request = new Request('https://example.com/api', {
        headers: { Authorization: `Bearer ${jwt}` },
      })

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.context.type).toBe('oauth')
      }
    })

    it('should return error for invalid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ active: false }),
      })

      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.invalid'
      const request = new Request('https://example.com/api', {
        headers: { Authorization: `Bearer ${jwt}` },
      })

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(false)
    })
  })

  describe('token type detection', () => {
    const config: AuthConfig = {
      mode: 'auth-required',
      oauth: { introspectionUrl: 'https://auth.example.com/introspect' },
      apiKey: { verifyUrl: 'https://api.example.com/verify-key' },
    }

    it('should detect JWT token (three parts)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ active: true, sub: 'user' }),
      })

      const jwt = 'header.payload.signature'
      const request = new Request('https://example.com/api', {
        headers: { Authorization: `Bearer ${jwt}` },
      })

      await authenticateRequest(request, config)

      // Should call OAuth introspection endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        'https://auth.example.com/introspect',
        expect.anything()
      )
    })

    it('should detect sk_ API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true, keyId: 'key-1' }),
      })

      const request = new Request('https://example.com/api', {
        headers: { Authorization: 'Bearer sk_test_123' },
      })

      await authenticateRequest(request, config)

      // Should call API key verification endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/verify-key',
        expect.anything()
      )
    })

    it('should detect do_ API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true, keyId: 'key-2' }),
      })

      const request = new Request('https://example.com/api', {
        headers: { Authorization: 'Bearer do_live_abc' },
      })

      await authenticateRequest(request, config)

      // Should call API key verification endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/verify-key',
        expect.anything()
      )
    })
  })

  describe('error handling', () => {
    const config: AuthConfig = {
      mode: 'auth-required',
      oauth: { introspectionUrl: 'https://auth.example.com/introspect' },
    }

    it('should return error for malformed auth header', async () => {
      const request = new Request('https://example.com/api', {
        headers: { Authorization: 'InvalidFormat' },
      })

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_AUTH_HEADER')
      }
    })

    it('should return error for unsupported auth scheme', async () => {
      const request = new Request('https://example.com/api', {
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      })

      const result = await authenticateRequest(request, config)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('UNSUPPORTED_AUTH_SCHEME')
      }
    })

    it('should return error when no config for token type', async () => {
      const configNoApiKey: AuthConfig = {
        mode: 'auth-required',
        oauth: { introspectionUrl: 'https://auth.example.com/introspect' },
        // No apiKey config
      }

      const request = new Request('https://example.com/api', {
        headers: { Authorization: 'Bearer sk_test_key' },
      })

      const result = await authenticateRequest(request, configNoApiKey)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NO_API_KEY_CONFIG')
      }
    })
  })
})
