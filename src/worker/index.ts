/**
 * MCP Server - Cloudflare Worker Entry Point
 *
 * Serves as an OAuth 2.1 authorization server for MCP clients (Claude, ChatGPT, etc.)
 * and provides MCP protocol endpoints.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createOAuth21Server, MemoryOAuthStorage } from '@dotdo/oauth'
import type { OAuth21Server, DevModeConfig } from '@dotdo/oauth'

/**
 * Worker environment bindings
 */
export interface Env {
  /** Server mode: 'test' | 'dev' | 'production' */
  MODE: 'test' | 'dev' | 'production'
  /** Server issuer URL */
  ISSUER: string
  /** WorkOS API key (for dev/production modes) */
  WORKOS_API_KEY?: string
  /** WorkOS client ID (for dev/production modes) */
  WORKOS_CLIENT_ID?: string
  /** Enable debug logging */
  DEBUG?: string
}

/**
 * Create the MCP server with OAuth 2.1 support
 */
export function createMCPServer(env: Env) {
  const app = new Hono<{ Bindings: Env }>()
  const debug = env.DEBUG === 'true'

  // Determine OAuth configuration based on mode
  const storage = new MemoryOAuthStorage()

  let devMode: DevModeConfig | undefined
  let upstream: { provider: 'workos'; apiKey: string; clientId: string } | undefined

  if (env.MODE === 'test') {
    // Test mode: no upstream, any credentials work
    devMode = {
      enabled: true,
      allowAnyCredentials: true,
      users: [
        { id: 'test-user-1', email: 'test@test.mcp.do', password: 'test123', name: 'Test User' },
        { id: 'test-user-2', email: 'alice@example.com', password: 'alice123', name: 'Alice' },
        { id: 'test-user-3', email: 'bob@example.com', password: 'bob123', name: 'Bob' },
      ],
    }
  } else if (env.MODE === 'dev') {
    // Dev mode: WorkOS sandbox
    if (!env.WORKOS_API_KEY || !env.WORKOS_CLIENT_ID) {
      throw new Error('WORKOS_API_KEY and WORKOS_CLIENT_ID are required for dev mode')
    }
    upstream = {
      provider: 'workos',
      apiKey: env.WORKOS_API_KEY,
      clientId: env.WORKOS_CLIENT_ID,
    }
  } else {
    // Production mode: WorkOS production
    if (!env.WORKOS_API_KEY || !env.WORKOS_CLIENT_ID) {
      throw new Error('WORKOS_API_KEY and WORKOS_CLIENT_ID are required for production mode')
    }
    upstream = {
      provider: 'workos',
      apiKey: env.WORKOS_API_KEY,
      clientId: env.WORKOS_CLIENT_ID,
    }
  }

  // Create OAuth 2.1 server
  const oauthServer = createOAuth21Server({
    issuer: env.ISSUER,
    storage,
    devMode,
    upstream,
    debug,
    enableDynamicRegistration: true,
    scopes: ['openid', 'profile', 'email', 'mcp:read', 'mcp:write', 'mcp:admin'],
  }) as OAuth21Server

  // Enable CORS for all routes
  app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['WWW-Authenticate'],
  }))

  // Mount OAuth routes
  app.route('/', oauthServer)

  // Health check endpoint
  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      mode: env.MODE,
      issuer: env.ISSUER,
      timestamp: new Date().toISOString(),
    })
  })

  // Server info endpoint
  app.get('/', (c) => {
    return c.json({
      name: 'MCP OAuth Server',
      version: '0.1.0',
      mode: env.MODE,
      issuer: env.ISSUER,
      description: env.MODE === 'test'
        ? 'Test server - any credentials accepted'
        : env.MODE === 'dev'
        ? 'Development server - WorkOS sandbox'
        : 'Production server',
      endpoints: {
        oauth: {
          metadata: '/.well-known/oauth-authorization-server',
          authorize: '/authorize',
          token: '/token',
          register: '/register',
          revoke: '/revoke',
        },
        mcp: {
          sse: '/mcp/sse',
          messages: '/mcp/messages',
        },
        health: '/health',
      },
    })
  })

  // MCP SSE endpoint (placeholder)
  app.get('/mcp/sse', async (c) => {
    // TODO: Implement MCP SSE streaming
    return c.json({ error: 'MCP SSE not yet implemented' }, 501)
  })

  // MCP messages endpoint (placeholder)
  app.post('/mcp/messages', async (c) => {
    // TODO: Implement MCP message handling
    return c.json({ error: 'MCP messages not yet implemented' }, 501)
  })

  // Test helpers endpoint (only in test mode)
  if (env.MODE === 'test' && oauthServer.testHelpers) {
    app.post('/test/token', async (c) => {
      const body = await c.req.json<{ userId: string; clientId: string; scope?: string }>()
      const tokens = await oauthServer.testHelpers!.getAccessToken(
        body.userId,
        body.clientId,
        body.scope
      )
      return c.json(tokens)
    })

    app.post('/test/user', async (c) => {
      const body = await c.req.json<{ id: string; email: string; name?: string; password?: string }>()
      const user = await oauthServer.testHelpers!.createUser(body)
      return c.json(user)
    })
  }

  return app
}

// Cache app instances per mode to persist storage across requests
const appCache = new Map<string, Hono<{ Bindings: Env }>>()

// Export default handler for Cloudflare Workers
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Use cached app if available (preserves in-memory storage within same instance)
    let app = appCache.get(env.MODE)
    if (!app) {
      app = createMCPServer(env)
      appCache.set(env.MODE, app)
    }
    return app.fetch(request, env)
  },
}
