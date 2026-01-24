import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { introspectToken, createOAuthContext } from './oauth'
import type { OAuthConfig } from './types'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('introspectToken', () => {
  const config: OAuthConfig = {
    introspectionUrl: 'https://auth.example.com/oauth/introspect',
  }

  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('successful introspection', () => {
    it('should return active=true with token info for valid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          active: true,
          sub: 'user-123',
          scope: 'read write',
          exp: Math.floor(Date.now() / 1000) + 3600,
          client_id: 'my-client',
        }),
      })

      const result = await introspectToken('valid-token', config)

      expect(result.active).toBe(true)
      expect(result.sub).toBe('user-123')
      expect(result.scope).toBe('read write')
    })

    it('should call introspection endpoint with token in body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ active: false }),
      })

      await introspectToken('test-token', config)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://auth.example.com/oauth/introspect',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(URLSearchParams),
        })
      )

      const body = mockFetch.mock.calls[0][1].body as URLSearchParams
      expect(body.get('token')).toBe('test-token')
    })

    it('should include client credentials when provided', async () => {
      const configWithClient: OAuthConfig = {
        introspectionUrl: 'https://auth.example.com/oauth/introspect',
        clientId: 'my-client-id',
        clientSecret: 'my-secret',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ active: true, sub: 'user' }),
      })

      await introspectToken('test-token', configWithClient)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
          }),
        })
      )
    })
  })

  describe('inactive/expired tokens', () => {
    it('should return active=false for expired token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ active: false }),
      })

      const result = await introspectToken('expired-token', config)

      expect(result.active).toBe(false)
    })

    it('should return active=false for revoked token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ active: false }),
      })

      const result = await introspectToken('revoked-token', config)

      expect(result.active).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should throw on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(introspectToken('token', config)).rejects.toThrow(
        'Network error'
      )
    })

    it('should throw on non-200 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })

      await expect(introspectToken('token', config)).rejects.toThrow(
        'Introspection failed'
      )
    })

    it('should throw on invalid JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new SyntaxError('Invalid JSON')
        },
      })

      await expect(introspectToken('token', config)).rejects.toThrow()
    })
  })
})

describe('createOAuthContext', () => {
  it('should create AuthContext from introspection response', () => {
    const introspectionResponse = {
      active: true,
      sub: 'user-456',
      scope: 'read write admin',
    }

    const ctx = createOAuthContext(introspectionResponse)

    expect(ctx.type).toBe('oauth')
    expect(ctx.id).toBe('user-456')
    expect(ctx.readonly).toBe(false)
  })

  it('should set readonly=true if only read scope', () => {
    const introspectionResponse = {
      active: true,
      sub: 'user-789',
      scope: 'read',
    }

    const ctx = createOAuthContext(introspectionResponse)

    expect(ctx.readonly).toBe(true)
  })

  it('should set isAdmin=true if admin scope present', () => {
    const introspectionResponse = {
      active: true,
      sub: 'admin-user',
      scope: 'read write admin',
    }

    const ctx = createOAuthContext(introspectionResponse)

    expect(ctx.isAdmin).toBe(true)
  })

  it('should not set isAdmin if no admin scope', () => {
    const introspectionResponse = {
      active: true,
      sub: 'regular-user',
      scope: 'read write',
    }

    const ctx = createOAuthContext(introspectionResponse)

    expect(ctx.isAdmin).toBeUndefined()
  })

  it('should include metadata with scope and expiration', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600
    const introspectionResponse = {
      active: true,
      sub: 'user',
      scope: 'read write',
      exp,
      client_id: 'my-client',
    }

    const ctx = createOAuthContext(introspectionResponse)

    expect(ctx.metadata).toBeDefined()
    expect(ctx.metadata?.scope).toBe('read write')
    expect(ctx.metadata?.exp).toBe(exp)
    expect(ctx.metadata?.client_id).toBe('my-client')
  })

  it('should use client_id as fallback if sub is missing', () => {
    const introspectionResponse = {
      active: true,
      client_id: 'service-account',
      scope: 'read write',
    }

    const ctx = createOAuthContext(introspectionResponse)

    expect(ctx.id).toBe('service-account')
  })

  it('should use "unknown" if neither sub nor client_id present', () => {
    const introspectionResponse = {
      active: true,
      scope: 'read',
    }

    const ctx = createOAuthContext(introspectionResponse)

    expect(ctx.id).toBe('unknown')
  })
})
