import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { authMiddleware, requireAuth, requireAdmin } from './middleware'
import type { AuthConfig, AuthContext } from './types'

// Mock fetch for OAuth/API key verification
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('authMiddleware', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('context variable injection', () => {
    it('should inject authContext into Hono context', async () => {
      const config: AuthConfig = { mode: 'anon' }
      const app = new Hono()
        .use('*', authMiddleware(config))
        .get('/test', (c) => {
          const authContext = c.get('authContext')
          return c.json({ type: authContext.type })
        })

      const res = await app.request('/test')
      const data = (await res.json()) as { type: string }

      expect(data.type).toBe('anon')
    })

    it('should make authContext available with correct type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          active: true,
          sub: 'user-123',
          scope: 'read write',
        }),
      })

      const config: AuthConfig = {
        mode: 'anon+auth',
        oauth: { introspectionUrl: 'https://auth.example.com/introspect' },
      }

      const app = new Hono()
        .use('*', authMiddleware(config))
        .get('/test', (c) => {
          const authContext = c.get('authContext')
          return c.json({
            type: authContext.type,
            id: authContext.id,
            readonly: authContext.readonly,
          })
        })

      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.signature'
      const res = await app.request('/test', {
        headers: { Authorization: `Bearer ${jwt}` },
      })
      const data = (await res.json()) as { type: string; id: string }

      expect(data.type).toBe('oauth')
      expect(data.id).toBe('user-123')
    })
  })

  describe('anon mode', () => {
    const config: AuthConfig = { mode: 'anon' }

    it('should allow requests without auth', async () => {
      const app = new Hono()
        .use('*', authMiddleware(config))
        .get('/test', (c) => c.text('OK'))

      const res = await app.request('/test')
      expect(res.status).toBe(200)
    })

    it('should set readonly anonymous context', async () => {
      const app = new Hono()
        .use('*', authMiddleware(config))
        .get('/test', (c) => {
          const authContext = c.get('authContext')
          return c.json({ readonly: authContext.readonly })
        })

      const res = await app.request('/test')
      const data = (await res.json()) as { readonly: boolean }
      expect(data.readonly).toBe(true)
    })
  })

  describe('auth-required mode', () => {
    const config: AuthConfig = {
      mode: 'auth-required',
      oauth: { introspectionUrl: 'https://auth.example.com/introspect' },
    }

    it('should return 401 without auth header', async () => {
      const app = new Hono()
        .use('*', authMiddleware(config))
        .get('/test', (c) => c.text('OK'))

      const res = await app.request('/test')
      expect(res.status).toBe(401)
    })

    it('should return 401 with invalid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ active: false }),
      })

      const app = new Hono()
        .use('*', authMiddleware(config))
        .get('/test', (c) => c.text('OK'))

      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.invalid'
      const res = await app.request('/test', {
        headers: { Authorization: `Bearer ${jwt}` },
      })
      expect(res.status).toBe(401)
    })

    it('should allow authenticated requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          active: true,
          sub: 'user-456',
          scope: 'read write',
        }),
      })

      const app = new Hono()
        .use('*', authMiddleware(config))
        .get('/test', (c) => c.text('OK'))

      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTQ1NiJ9.signature'
      const res = await app.request('/test', {
        headers: { Authorization: `Bearer ${jwt}` },
      })
      expect(res.status).toBe(200)
    })
  })

  describe('error responses', () => {
    const config: AuthConfig = {
      mode: 'auth-required',
      oauth: { introspectionUrl: 'https://auth.example.com/introspect' },
    }

    it('should return JSON error body', async () => {
      const app = new Hono()
        .use('*', authMiddleware(config))
        .get('/test', (c) => c.text('OK'))

      const res = await app.request('/test')
      const data = (await res.json()) as { error: { code: string; message: string } }

      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('code')
      expect(data.error).toHaveProperty('message')
    })

    it('should include WWW-Authenticate header on 401', async () => {
      const app = new Hono()
        .use('*', authMiddleware(config))
        .get('/test', (c) => c.text('OK'))

      const res = await app.request('/test')
      expect(res.headers.get('WWW-Authenticate')).toBe('Bearer')
    })
  })
})

describe('requireAuth middleware', () => {
  const config: AuthConfig = { mode: 'anon+auth' }

  it('should allow authenticated users', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        active: true,
        sub: 'user-123',
        scope: 'read write',
      }),
    })

    const configWithOAuth: AuthConfig = {
      ...config,
      oauth: { introspectionUrl: 'https://auth.example.com/introspect' },
    }

    const app = new Hono()
      .use('*', authMiddleware(configWithOAuth))
      .use('/protected/*', requireAuth())
      .get('/protected/data', (c) => c.text('Protected'))
      .get('/public', (c) => c.text('Public'))

    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.signature'
    const res = await app.request('/protected/data', {
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(200)
  })

  it('should reject anonymous users', async () => {
    const app = new Hono()
      .use('*', authMiddleware(config))
      .use('/protected/*', requireAuth())
      .get('/protected/data', (c) => c.text('Protected'))

    const res = await app.request('/protected/data')
    expect(res.status).toBe(401)
  })

  it('should allow anonymous users on non-protected routes', async () => {
    const app = new Hono()
      .use('*', authMiddleware(config))
      .use('/protected/*', requireAuth())
      .get('/protected/data', (c) => c.text('Protected'))
      .get('/public', (c) => c.text('Public'))

    const res = await app.request('/public')
    expect(res.status).toBe(200)
  })
})

describe('requireAdmin middleware', () => {
  const baseConfig: AuthConfig = {
    mode: 'anon+auth',
    oauth: { introspectionUrl: 'https://auth.example.com/introspect' },
  }

  it('should allow admin users', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        active: true,
        sub: 'admin-user',
        scope: 'read write admin',
      }),
    })

    const app = new Hono()
      .use('*', authMiddleware(baseConfig))
      .use('/admin/*', requireAdmin())
      .get('/admin/settings', (c) => c.text('Admin'))

    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbi11c2VyIn0.signature'
    const res = await app.request('/admin/settings', {
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(200)
  })

  it('should reject non-admin users', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        active: true,
        sub: 'regular-user',
        scope: 'read write',
      }),
    })

    const app = new Hono()
      .use('*', authMiddleware(baseConfig))
      .use('/admin/*', requireAdmin())
      .get('/admin/settings', (c) => c.text('Admin'))

    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJyZWd1bGFyLXVzZXIifQ.signature'
    const res = await app.request('/admin/settings', {
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(403)
  })

  it('should reject anonymous users', async () => {
    const app = new Hono()
      .use('*', authMiddleware(baseConfig))
      .use('/admin/*', requireAdmin())
      .get('/admin/settings', (c) => c.text('Admin'))

    const res = await app.request('/admin/settings')
    expect(res.status).toBe(401)
  })
})
