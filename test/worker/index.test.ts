/**
 * Worker Entry Point Tests
 *
 * Tests for the Cloudflare Worker entry point with Hono.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the dependencies
vi.mock('../../src/auth/middleware.js', () => ({
  auth: vi.fn(() => async (c: any, next: any) => {
    c.set('authContext', { authenticated: false, readonly: true })
    await next()
  }),
  requireAuth: vi.fn(() => async (c: any, next: any) => {
    const authContext = c.get('authContext')
    if (!authContext?.authenticated) {
      return c.json({ error: 'Authentication required' }, 401)
    }
    await next()
  }),
}))

vi.mock('../../src/transports/http.js', () => ({
  createHttpHandler: vi.fn(() => async () => {
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 'ok' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }),
}))

describe('Worker Entry Point', () => {
  let app: any

  beforeEach(async () => {
    vi.resetModules()
    // Dynamically import and create the app using createMCPServer
    const module = await import('../../src/worker/index.js')
    app = module.createMCPServer({
      MODE: 'test',
      ISSUER: 'https://test.mcp.do',
      DEBUG: 'false'
    })
  })

  describe('Health Check Endpoint', () => {
    it('should respond to GET /health with ok status', async () => {
      const response = await app.request('/health')

      expect(response.status).toBe(200)

      const body = await response.json()
      // Support both { ok: true, timestamp } and { status: 'ok' } formats
      expect(body.ok === true || body.status === 'ok').toBe(true)
    })

    it('should return valid JSON response', async () => {
      const response = await app.request('/health')

      expect(response.headers.get('content-type')).toContain('application/json')
      const body = await response.json()
      expect(body).toBeDefined()
    })
  })

  describe('MCP Endpoints', () => {
    it('should handle GET /mcp/sse requests', async () => {
      const response = await app.request('/mcp/sse')

      // Should return 200, 400, or 501 (not implemented)
      expect([200, 400, 501]).toContain(response.status)
    })

    it('should handle POST /mcp/messages requests', async () => {
      const response = await app.request('/mcp/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
      })

      // Should return 200, 400, or 501 (not implemented)
      expect([200, 400, 501]).toContain(response.status)
    })

    it('should have MCP messages endpoint defined', async () => {
      const response = await app.request('/mcp/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      // 404 would mean endpoint not found, anything else means it exists
      expect(response.status).not.toBe(404)
    })
  })

  describe('404 Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await app.request('/unknown')

      expect(response.status).toBe(404)
    })
  })

  describe('CORS Headers', () => {
    it('should handle OPTIONS requests for CORS preflight', async () => {
      const response = await app.request('/mcp/messages', {
        method: 'OPTIONS',
      })

      // Should return 204 or be handled by app
      expect([200, 204]).toContain(response.status)
    })
  })
})

describe('Worker Export', () => {
  it('should export a valid Hono app', async () => {
    const module = await import('../../src/worker/index.js')

    expect(module.default).toBeDefined()
    expect(typeof module.default.fetch).toBe('function')
  })

  it('should export the app as default', async () => {
    const module = await import('../../src/worker/index.js')

    expect(module.default).toBeDefined()
  })
})
