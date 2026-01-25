/**
 * Auth Middleware Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import {
  authMiddleware,
  auth,
  requireAuth,
  requireAdmin,
  requireWrite,
} from './middleware.js'
import type { AuthConfig, AuthContext } from './types.js'

describe('Auth Middleware', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('authMiddleware', () => {
    it('should set authContext on context in anon mode', async () => {
      const app = new Hono()
      const config: AuthConfig = { mode: 'anon' }

      let capturedContext: AuthContext | undefined

      app.use('*', authMiddleware(config))
      app.get('/test', (c) => {
        capturedContext = c.get('authContext')
        return c.json({ ok: true })
      })

      const response = await app.request('/test')

      expect(response.status).toBe(200)
      expect(capturedContext).toBeDefined()
      expect(capturedContext?.type).toBe('anon')
    })

    it('should return 401 for missing auth in auth-required mode', async () => {
      const app = new Hono()
      const config: AuthConfig = { mode: 'auth-required' }

      app.use('*', authMiddleware(config))
      app.get('/test', (c) => c.json({ ok: true }))

      const response = await app.request('/test')

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('should include WWW-Authenticate header on 401', async () => {
      const app = new Hono()
      const config: AuthConfig = { mode: 'auth-required' }

      app.use('*', authMiddleware(config))
      app.get('/test', (c) => c.json({ ok: true }))

      const response = await app.request('/test')

      expect(response.headers.get('WWW-Authenticate')).toBe('Bearer')
    })

    it('should authenticate valid OAuth token', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            active: true,
            sub: 'user-123',
            scope: 'read write',
          }),
      })

      const app = new Hono()
      const config: AuthConfig = {
        mode: 'auth-required',
        oauth: { introspectionUrl: 'https://auth.example.com/introspect' },
      }

      let capturedContext: AuthContext | undefined

      app.use('*', authMiddleware(config))
      app.get('/test', (c) => {
        capturedContext = c.get('authContext')
        return c.json({ ok: true })
      })

      const response = await app.request('/test', {
        headers: { Authorization: 'Bearer eyJ.test.jwt' },
      })

      expect(response.status).toBe(200)
      expect(capturedContext?.type).toBe('oauth')
      expect(capturedContext?.id).toBe('user-123')
    })

    it('should export auth as alias for authMiddleware', () => {
      expect(auth).toBe(authMiddleware)
    })
  })

  describe('requireAuth', () => {
    it('should allow authenticated requests', async () => {
      const app = new Hono()
      const config: AuthConfig = {
        mode: 'anon+auth',
        oauth: { introspectionUrl: 'https://auth.example.com/introspect' },
      }

      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ active: true, sub: 'user-123' }),
      })

      app.use('*', authMiddleware(config))
      app.get('/protected', requireAuth(), (c) => c.json({ ok: true }))

      const response = await app.request('/protected', {
        headers: { Authorization: 'Bearer eyJ.test.jwt' },
      })

      expect(response.status).toBe(200)
    })

    it('should reject anonymous requests', async () => {
      const app = new Hono()
      const config: AuthConfig = { mode: 'anon+auth' }

      app.use('*', authMiddleware(config))
      app.get('/protected', requireAuth(), (c) => c.json({ ok: true }))

      const response = await app.request('/protected')

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('should reject if no authContext set', async () => {
      const app = new Hono()

      // No authMiddleware - context not set
      app.get('/protected', requireAuth(), (c) => c.json({ ok: true }))

      const response = await app.request('/protected')

      expect(response.status).toBe(401)
    })
  })

  describe('requireAdmin', () => {
    it('should allow admin users', async () => {
      const app = new Hono()
      const config: AuthConfig = {
        mode: 'auth-required',
        oauth: { introspectionUrl: 'https://auth.example.com/introspect' },
      }

      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ active: true, sub: 'admin-user', scope: 'admin' }),
      })

      app.use('*', authMiddleware(config))
      app.get('/admin', requireAdmin(), (c) => c.json({ ok: true }))

      const response = await app.request('/admin', {
        headers: { Authorization: 'Bearer eyJ.admin.jwt' },
      })

      expect(response.status).toBe(200)
    })

    it('should reject non-admin authenticated users', async () => {
      const app = new Hono()
      const config: AuthConfig = {
        mode: 'auth-required',
        oauth: { introspectionUrl: 'https://auth.example.com/introspect' },
      }

      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ active: true, sub: 'regular-user', scope: 'read' }),
      })

      app.use('*', authMiddleware(config))
      app.get('/admin', requireAdmin(), (c) => c.json({ ok: true }))

      const response = await app.request('/admin', {
        headers: { Authorization: 'Bearer eyJ.user.jwt' },
      })

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error.code).toBe('FORBIDDEN')
      expect(body.error.message).toBe('Admin privileges required')
    })

    it('should reject anonymous users', async () => {
      const app = new Hono()
      const config: AuthConfig = { mode: 'anon+auth' }

      app.use('*', authMiddleware(config))
      app.get('/admin', requireAdmin(), (c) => c.json({ ok: true }))

      const response = await app.request('/admin')

      expect(response.status).toBe(401)
    })
  })

  describe('requireWrite', () => {
    it('should allow users with write access', async () => {
      const app = new Hono()
      const config: AuthConfig = {
        mode: 'auth-required',
        oauth: { introspectionUrl: 'https://auth.example.com/introspect' },
      }

      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            active: true,
            sub: 'writer-user',
            scope: 'read write',
          }),
      })

      app.use('*', authMiddleware(config))
      app.post('/data', requireWrite(), (c) => c.json({ created: true }))

      const response = await app.request('/data', {
        method: 'POST',
        headers: { Authorization: 'Bearer eyJ.writer.jwt' },
      })

      expect(response.status).toBe(200)
    })

    it('should reject readonly users', async () => {
      const app = new Hono()
      const config: AuthConfig = {
        mode: 'auth-required',
        oauth: { introspectionUrl: 'https://auth.example.com/introspect' },
      }

      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            active: true,
            sub: 'reader-user',
            scope: 'read',
          }),
      })

      app.use('*', authMiddleware(config))
      app.post('/data', requireWrite(), (c) => c.json({ created: true }))

      const response = await app.request('/data', {
        method: 'POST',
        headers: { Authorization: 'Bearer eyJ.reader.jwt' },
      })

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error.code).toBe('FORBIDDEN')
      expect(body.error.message).toBe('Write access required')
    })

    it('should reject anonymous users (who are always readonly)', async () => {
      const app = new Hono()
      const config: AuthConfig = { mode: 'anon+auth' }

      app.use('*', authMiddleware(config))
      app.post('/data', requireWrite(), (c) => c.json({ created: true }))

      const response = await app.request('/data', { method: 'POST' })

      expect(response.status).toBe(403)
    })

    it('should reject if no authContext', async () => {
      const app = new Hono()

      app.post('/data', requireWrite(), (c) => c.json({ created: true }))

      const response = await app.request('/data', { method: 'POST' })

      expect(response.status).toBe(403)
    })
  })

  describe('middleware chaining', () => {
    it('should work with multiple middleware', async () => {
      const app = new Hono()
      const config: AuthConfig = {
        mode: 'auth-required',
        oauth: { introspectionUrl: 'https://auth.example.com/introspect' },
      }

      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            active: true,
            sub: 'admin-writer',
            scope: 'admin write',
          }),
      })

      app.use('*', authMiddleware(config))
      app.delete(
        '/admin/resource',
        requireAuth(),
        requireAdmin(),
        requireWrite(),
        (c) => c.json({ deleted: true })
      )

      const response = await app.request('/admin/resource', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer eyJ.admin-writer.jwt' },
      })

      expect(response.status).toBe(200)
    })
  })
})
