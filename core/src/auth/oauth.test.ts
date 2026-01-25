/**
 * OAuth Auth Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  introspectToken,
  createOAuthContext,
  createOAuthProvider,
  type IntrospectionResponse,
} from './oauth.js'
import type { OAuthConfig } from './types.js'

describe('OAuth Auth', () => {
  describe('createOAuthContext', () => {
    it('should create context from minimal response', () => {
      const response: IntrospectionResponse = {
        active: true,
        sub: 'user-123',
      }
      const context = createOAuthContext(response)

      expect(context.type).toBe('oauth')
      expect(context.id).toBe('user-123')
      expect(context.readonly).toBe(true) // No write scopes
    })

    it('should use client_id if sub is not present', () => {
      const response: IntrospectionResponse = {
        active: true,
        client_id: 'client-456',
      }
      const context = createOAuthContext(response)

      expect(context.id).toBe('client-456')
    })

    it('should use unknown if neither sub nor client_id present', () => {
      const response: IntrospectionResponse = {
        active: true,
      }
      const context = createOAuthContext(response)

      expect(context.id).toBe('unknown')
    })

    it('should set readonly false when write scope present', () => {
      const response: IntrospectionResponse = {
        active: true,
        sub: 'user-123',
        scope: 'read write',
      }
      const context = createOAuthContext(response)

      expect(context.readonly).toBe(false)
    })

    it('should set readonly false when admin scope present', () => {
      const response: IntrospectionResponse = {
        active: true,
        sub: 'user-123',
        scope: 'read admin',
      }
      const context = createOAuthContext(response)

      expect(context.readonly).toBe(false)
    })

    it('should set readonly false when scoped write present', () => {
      const response: IntrospectionResponse = {
        active: true,
        sub: 'user-123',
        scope: 'read users:write',
      }
      const context = createOAuthContext(response)

      expect(context.readonly).toBe(false)
    })

    it('should set isAdmin true when admin scope present', () => {
      const response: IntrospectionResponse = {
        active: true,
        sub: 'user-123',
        scope: 'admin',
      }
      const context = createOAuthContext(response)

      expect(context.isAdmin).toBe(true)
    })

    it('should set isAdmin true when scoped admin present', () => {
      const response: IntrospectionResponse = {
        active: true,
        sub: 'user-123',
        scope: 'system:admin',
      }
      const context = createOAuthContext(response)

      expect(context.isAdmin).toBe(true)
    })

    it('should include metadata from introspection response', () => {
      const response: IntrospectionResponse = {
        active: true,
        sub: 'user-123',
        scope: 'read',
        exp: 1699999999,
        iat: 1699990000,
        client_id: 'my-client',
        iss: 'https://auth.example.com',
        aud: 'https://api.example.com',
      }
      const context = createOAuthContext(response)

      expect(context.metadata).toEqual({
        scope: 'read',
        exp: 1699999999,
        iat: 1699990000,
        client_id: 'my-client',
        iss: 'https://auth.example.com',
        aud: 'https://api.example.com',
      })
    })

    it('should not include metadata if no relevant fields', () => {
      const response: IntrospectionResponse = {
        active: true,
        sub: 'user-123',
      }
      const context = createOAuthContext(response)

      expect(context.metadata).toBeUndefined()
    })
  })

  describe('introspectToken', () => {
    const originalFetch = globalThis.fetch

    beforeEach(() => {
      globalThis.fetch = vi.fn()
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('should send token to introspection endpoint', async () => {
      const mockResponse: IntrospectionResponse = {
        active: true,
        sub: 'user-123',
      }

      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const config: OAuthConfig = {
        introspectionUrl: 'https://auth.example.com/introspect',
      }

      const result = await introspectToken('test-token', config)

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://auth.example.com/introspect',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should include Basic auth when clientId and clientSecret provided', async () => {
      const mockResponse: IntrospectionResponse = { active: true }

      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const config: OAuthConfig = {
        introspectionUrl: 'https://auth.example.com/introspect',
        clientId: 'my-client',
        clientSecret: 'my-secret',
      }

      await introspectToken('test-token', config)

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
          }),
        })
      )
    })

    it('should throw on non-ok response', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })

      const config: OAuthConfig = {
        introspectionUrl: 'https://auth.example.com/introspect',
      }

      await expect(introspectToken('test-token', config)).rejects.toThrow(
        'Introspection failed: 401 Unauthorized'
      )
    })
  })

  describe('createOAuthProvider', () => {
    const originalFetch = globalThis.fetch

    beforeEach(() => {
      globalThis.fetch = vi.fn()
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('should return success result for active token', async () => {
      const mockResponse: IntrospectionResponse = {
        active: true,
        sub: 'user-123',
        scope: 'read write',
      }

      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const config: OAuthConfig = {
        introspectionUrl: 'https://auth.example.com/introspect',
      }

      const provider = createOAuthProvider(config)
      const result = await provider.verify('test-token')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.context.type).toBe('oauth')
        expect(result.context.id).toBe('user-123')
      }
    })

    it('should return failure result for inactive token', async () => {
      const mockResponse: IntrospectionResponse = {
        active: false,
      }

      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const config: OAuthConfig = {
        introspectionUrl: 'https://auth.example.com/introspect',
      }

      const provider = createOAuthProvider(config)
      const result = await provider.verify('test-token')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_TOKEN')
      }
    })

    it('should return failure result on introspection error', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      )

      const config: OAuthConfig = {
        introspectionUrl: 'https://auth.example.com/introspect',
      }

      const provider = createOAuthProvider(config)
      const result = await provider.verify('test-token')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('INTROSPECTION_ERROR')
        expect(result.error.message).toBe('Network error')
      }
    })
  })
})
