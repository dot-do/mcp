import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createHttpHandler,
  type HttpTransportOptions,
  type Session,
} from '../../src/transports/http.js'
import type { MCPServerWrapper } from '../../src/server.js'

describe('HTTP transport', () => {
  const createMockServer = (): MCPServerWrapper => ({
    server: {
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as MCPServerWrapper['server'],
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createHttpHandler', () => {
    it('should return a Request handler function', () => {
      const server = createMockServer()
      const handler = createHttpHandler(server)

      expect(typeof handler).toBe('function')
    })

    it('should accept options parameter', () => {
      const server = createMockServer()
      const options: HttpTransportOptions = {
        corsOrigin: 'https://example.com',
        sessionTTL: 3600000,
      }
      const handler = createHttpHandler(server, options)

      expect(typeof handler).toBe('function')
    })
  })

  describe('POST requests', () => {
    it('should handle POST requests for JSON-RPC', async () => {
      const server = createMockServer()
      const handler = createHttpHandler(server)

      const request = new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
        }),
      })

      const response = await handler(request)

      expect(response).toBeInstanceOf(Response)
      expect(response.status).toBe(200)
    })

    it('should return JSON-RPC response', async () => {
      const server = createMockServer()
      const handler = createHttpHandler(server)

      const request = new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
        }),
      })

      const response = await handler(request)
      const json = await response.json()

      expect(json).toHaveProperty('jsonrpc', '2.0')
      expect(json).toHaveProperty('id', 1)
    })

    it('should return error for invalid JSON', async () => {
      const server = createMockServer()
      const handler = createHttpHandler(server)

      const request = new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })

      const response = await handler(request)
      const json = await response.json()

      expect(json).toHaveProperty('error')
      expect(json.error).toHaveProperty('code', -32700)
      expect(json.error).toHaveProperty('message', 'Parse error')
    })
  })

  describe('GET requests (SSE)', () => {
    it('should handle GET requests for SSE', async () => {
      const server = createMockServer()
      const handler = createHttpHandler(server)

      const request = new Request('http://localhost/mcp', {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
        },
      })

      const response = await handler(request)

      expect(response).toBeInstanceOf(Response)
      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    })

    it('should set cache control headers for SSE', async () => {
      const server = createMockServer()
      const handler = createHttpHandler(server)

      const request = new Request('http://localhost/mcp', {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
        },
      })

      const response = await handler(request)

      expect(response.headers.get('Cache-Control')).toBe('no-cache')
      expect(response.headers.get('Connection')).toBe('keep-alive')
    })
  })

  describe('CORS headers', () => {
    it('should return CORS headers on OPTIONS request', async () => {
      const server = createMockServer()
      const handler = createHttpHandler(server, { corsOrigin: '*' })

      const request = new Request('http://localhost/mcp', {
        method: 'OPTIONS',
      })

      const response = await handler(request)

      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET')
    })

    it('should return CORS headers with custom origin', async () => {
      const server = createMockServer()
      const handler = createHttpHandler(server, {
        corsOrigin: 'https://example.com',
      })

      const request = new Request('http://localhost/mcp', {
        method: 'OPTIONS',
      })

      const response = await handler(request)

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com')
    })

    it('should include CORS headers in POST response', async () => {
      const server = createMockServer()
      const handler = createHttpHandler(server, { corsOrigin: '*' })

      const request = new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
        }),
      })

      const response = await handler(request)

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })
  })

  describe('session management', () => {
    it('should create a session ID when not provided', async () => {
      const server = createMockServer()
      const handler = createHttpHandler(server)

      const request = new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
        }),
      })

      const response = await handler(request)

      expect(response.headers.get('mcp-session-id')).toBeTruthy()
    })

    it('should reuse session ID when provided', async () => {
      const server = createMockServer()
      const handler = createHttpHandler(server)

      const sessionId = 'test-session-123'
      const request = new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'mcp-session-id': sessionId,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
        }),
      })

      const response = await handler(request)

      expect(response.headers.get('mcp-session-id')).toBe(sessionId)
    })

    it('should expose session in handler context', async () => {
      const server = createMockServer()
      let capturedSession: Session | undefined

      const handler = createHttpHandler(server, {
        onSession: (session) => {
          capturedSession = session
        },
      })

      const request = new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
        }),
      })

      await handler(request)

      expect(capturedSession).toBeDefined()
      expect(capturedSession?.id).toBeTruthy()
    })
  })

  describe('rate limiting hook', () => {
    it('should call rate limit hook if provided', async () => {
      const server = createMockServer()
      const rateLimitHook = vi.fn().mockResolvedValue(true)

      const handler = createHttpHandler(server, {
        checkRateLimit: rateLimitHook,
      })

      const request = new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
        }),
      })

      await handler(request)

      expect(rateLimitHook).toHaveBeenCalled()
    })

    it('should return 429 when rate limit exceeded', async () => {
      const server = createMockServer()
      const rateLimitHook = vi.fn().mockResolvedValue(false)

      const handler = createHttpHandler(server, {
        checkRateLimit: rateLimitHook,
      })

      const request = new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
        }),
      })

      const response = await handler(request)

      expect(response.status).toBe(429)
    })
  })
})
