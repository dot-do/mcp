/**
 * MCP Server - Cloudflare Worker Entry Point
 *
 * Routes OAuth requests to oauth.do and provides MCP protocol endpoints.
 * Uses oauth.do as the centralized OAuth 2.1 authorization server.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authMiddleware } from '@dotdo/mcp/auth'
import { createMCPServer } from '@dotdo/mcp'
import type { AuthConfig } from '@dotdo/mcp/auth'

/**
 * Worker environment bindings
 */
export interface Env {
  /** Server mode: 'test' | 'dev' | 'production' */
  MODE: 'test' | 'dev' | 'production'
  /** OAuth issuer URL (oauth.do) */
  ISSUER: string
  /** OAuth introspection URL */
  OAUTH_INTROSPECTION_URL: string
  /** Service binding to oauth.do */
  OAUTH: Fetcher
  /** Service binding to collections.do */
  COLLECTIONS: Fetcher
  /** Worker loader for sandboxed execution */
  LOADER?: unknown
  /** Enable debug logging */
  DEBUG?: string
}

/**
 * Create the worker app
 */
export function createWorkerApp(env: Env) {
  const app = new Hono<{ Bindings: Env }>()
  const debug = env.DEBUG === 'true'

  // Auth configuration - use oauth.do for introspection
  const authConfig: AuthConfig = {
    mode: env.MODE === 'test' ? 'anon+auth' : 'auth-required',
    oauth: {
      introspectionUrl: env.OAUTH_INTROSPECTION_URL,
    },
  }

  // Create MCP server with tools
  const mcpServer = createMCPServer({
    // Search: Full-text search over collections
    search: async (query, options) => {
      // TODO: Implement FTS search over collections
      // This would query a search index or scan collections
      return { results: [], total: 0 }
    },

    // Fetch: Get resource by URL
    fetch: async (id, options) => {
      // id is a URL like https://myapp.collections.do/users/123
      try {
        const res = await env.COLLECTIONS.fetch(id)
        if (!res.ok) return null
        return res.json()
      } catch {
        return null
      }
    },

    // Do: Execute TypeScript in a sandboxed environment
    // Note: Collection bindings require capnweb integration (TODO)
    do: {
      types: `
// Execute TypeScript/JavaScript code in a sandboxed environment
// Standard JavaScript globals are available (Math, JSON, Date, etc.)
// Network access is disabled by default

// Example:
// const result = [1, 2, 3].map(x => x * 2)
// return result.reduce((a, b) => a + b, 0)
`,
      bindings: {},
      timeout: 5000,
    },
    auth: authConfig,
  }, {
    name: 'collections.do',
    version: '0.1.0',
    env: env.LOADER ? { LOADER: env.LOADER } as any : undefined,
  })

  // Get the MCP HTTP handler
  const mcpHandler = mcpServer.getHttpHandler()

  // Enable CORS for all routes
  app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization', 'mcp-session-id'],
    exposeHeaders: ['WWW-Authenticate', 'mcp-session-id'],
  }))

  // ═══════════════════════════════════════════════════════════════════════════
  // OAuth Routes - Proxy to oauth.do
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/.well-known/oauth-authorization-server', async (c) => {
    return c.env.OAUTH.fetch(c.req.raw)
  })

  app.get('/.well-known/oauth-protected-resource', async (c) => {
    return c.env.OAUTH.fetch(c.req.raw)
  })

  app.get('/.well-known/jwks.json', async (c) => {
    return c.env.OAUTH.fetch(c.req.raw)
  })

  app.get('/authorize', async (c) => {
    return c.env.OAUTH.fetch(c.req.raw)
  })

  app.get('/login', async (c) => {
    return c.env.OAUTH.fetch(c.req.raw)
  })

  app.post('/login', async (c) => {
    return c.env.OAUTH.fetch(c.req.raw)
  })

  app.get('/callback', async (c) => {
    return c.env.OAUTH.fetch(c.req.raw)
  })

  app.post('/token', async (c) => {
    return c.env.OAUTH.fetch(c.req.raw)
  })

  app.post('/introspect', async (c) => {
    return c.env.OAUTH.fetch(c.req.raw)
  })

  app.post('/revoke', async (c) => {
    return c.env.OAUTH.fetch(c.req.raw)
  })

  app.post('/register', async (c) => {
    return c.env.OAUTH.fetch(c.req.raw)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Public Endpoints
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      mode: env.MODE,
      issuer: env.ISSUER,
      timestamp: new Date().toISOString(),
    })
  })

  app.get('/', (c) => {
    return c.json({
      name: 'MCP Server',
      version: '0.1.0',
      mode: env.MODE,
      issuer: env.ISSUER,
      description: env.MODE === 'test'
        ? 'Test server - anonymous access allowed'
        : env.MODE === 'dev'
        ? 'Development server'
        : 'Production server',
      endpoints: {
        oauth: {
          metadata: '/.well-known/oauth-authorization-server',
          authorize: '/authorize',
          token: '/token',
          register: '/register',
          revoke: '/revoke',
          introspect: '/introspect',
        },
        mcp: '/mcp',
        health: '/health',
      },
      tools: mcpServer.getRegisteredTools(),
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // MCP Endpoint - Protected by auth, handled by mcp-lite
  // ═══════════════════════════════════════════════════════════════════════════

  app.use('/mcp', authMiddleware(authConfig))

  app.all('/mcp', async (c) => {
    const authContext = c.get('authContext')
    if (debug) {
      console.log('[MCP] Request from:', authContext?.id || 'anonymous', 'method:', c.req.method)
    }

    return mcpHandler(c.req.raw)
  })

  return app
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const app = createWorkerApp(env)
    return app.fetch(request, env)
  },
}
