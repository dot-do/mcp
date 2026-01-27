/**
 * MCP Server - Cloudflare Worker Entry Point
 *
 * Routes OAuth requests to oauth.do and provides MCP protocol endpoints.
 * Uses oauth.do as the centralized OAuth 2.1 authorization server.
 * Extends WorkerEntrypoint for RPC support.
 */

import { WorkerEntrypoint } from 'cloudflare:workers'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authMiddleware } from '@dotdo/mcp/auth'
import { createMCPServer } from '@dotdo/mcp'
import type { AuthConfig } from '@dotdo/mcp/auth'

/**
 * Service binding interface for collections.do with RPC methods
 */
interface CollectionsService {
  fetch(request: Request): Promise<Response>
  // RPC methods exposed by collections.do
  get(collection: string, id: string): Promise<Record<string, unknown> | null>
  put(collection: string, id: string, doc: Record<string, unknown>): Promise<Record<string, unknown>>
  delete(collection: string, id: string): Promise<boolean>
  list(collection: string, options?: { limit?: number; offset?: number }): Promise<Record<string, unknown>[]>
  find(collection: string, filter?: Record<string, unknown>, options?: { limit?: number; offset?: number }): Promise<Record<string, unknown>[]>
  count(collection: string, filter?: Record<string, unknown>): Promise<number>
}

/**
 * OAuth service binding with RPC methods
 */
interface OAuthService {
  fetch(request: Request): Promise<Response>
  /** Introspect a token via Workers RPC */
  introspect(token: string): Promise<{
    active: boolean
    sub?: string
    client_id?: string
    scope?: string
    exp?: number
    iat?: number
    iss?: string
    aud?: string | string[]
    [key: string]: unknown
  }>
}

/**
 * Worker environment bindings
 */
export interface Env {
  /** Server mode: 'test' | 'dev' | 'production' */
  MODE: 'test' | 'dev' | 'production'
  /** Service binding to oauth.do with RPC support */
  OAUTH: OAuthService
  /** Service binding to collections.do with RPC support */
  COLLECTIONS: CollectionsService
  /** Worker loader for sandboxed execution */
  LOADER?: unknown
  /** Enable debug logging */
  DEBUG?: string
}

/**
 * Get issuer URL from request host
 */
function getIssuer(request: Request): string {
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

/**
 * MCP Worker with RPC support
 */
export default class MCPWorker extends WorkerEntrypoint<Env> {
  private app: Hono<{ Bindings: Env }>
  private mcpServer: ReturnType<typeof createMCPServer>
  private mcpHandler: ReturnType<ReturnType<typeof createMCPServer>['getHttpHandler']>

  constructor(ctx: ExecutionContext, env: Env) {
    super(ctx, env)
    const debug = env.DEBUG === 'true'

    // Auth configuration - use oauth.do service binding for introspection via RPC
    const authConfig: AuthConfig = {
      mode: env.MODE === 'test' ? 'anon+auth' : 'auth-required',
      oauth: {
        service: env.OAUTH,
      },
    }

    // Create MCP server with tools
    this.mcpServer = createMCPServer({
      // Search: Full-text search over collections
      search: async (query, options) => {
        // TODO: Implement FTS search over collections
        return { results: [], total: 0 }
      },

      // Fetch: Get resource by URL
      fetch: async (id, options) => {
        // id is a URL like https://myapp.collections.do/users/123
        try {
          const res = await env.COLLECTIONS.fetch(new Request(id))
          if (!res.ok) return null
          return res.json()
        } catch {
          return null
        }
      },

      // Do: Execute TypeScript with collection access via Workers RPC
      do: {
        types: `
// Collections are available via the collection() function
// Example: const products = collection('products'); const items = await products.list()

interface Collection<T = any> {
  get(id: string): Promise<T | null>
  put(id: string, doc: T): Promise<T>
  delete(id: string): Promise<boolean>
  find(filter?: object, options?: { limit?: number; offset?: number }): Promise<T[]>
  list(options?: { limit?: number; offset?: number }): Promise<T[]>
  count(filter?: object): Promise<number>
}

declare function collection<T = any>(name: string): Collection<T>
`,
        // Module code that defines collection() function
        // Uses Workers RPC via env.COLLECTIONS binding
        module: `
// collection() function calls the COLLECTIONS service via Workers RPC
globalThis.collection = function collection(name) {
  return {
    get: (id) => env.COLLECTIONS.get(name, id),
    put: (id, doc) => env.COLLECTIONS.put(name, id, doc),
    delete: (id) => env.COLLECTIONS.delete(name, id),
    list: (options) => env.COLLECTIONS.list(name, options),
    find: (filter, options) => env.COLLECTIONS.find(name, filter, options),
    count: (filter) => env.COLLECTIONS.count(name, filter),
  };
};
`,
        // Pass COLLECTIONS service binding for Workers RPC
        bindings: {
          COLLECTIONS: env.COLLECTIONS,
        },
        timeout: 5000,
      },
      auth: authConfig,
    }, {
      name: 'collections.do',
      version: '0.1.0',
      env: env.LOADER ? { LOADER: env.LOADER } as any : undefined,
    })

    this.mcpHandler = this.mcpServer.getHttpHandler()
    this.app = this.createApp(env, debug, authConfig)
  }

  private createApp(env: Env, debug: boolean, authConfig: AuthConfig): Hono<{ Bindings: Env }> {
    const app = new Hono<{ Bindings: Env }>()

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
        issuer: getIssuer(c.req.raw),
        timestamp: new Date().toISOString(),
      })
    })

    app.get('/', (c) => {
      return c.json({
        name: 'MCP Server',
        version: '0.1.0',
        mode: env.MODE,
        issuer: getIssuer(c.req.raw),
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
        tools: this.mcpServer.getRegisteredTools(),
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

      return this.mcpHandler(c.req.raw)
    })

    return app
  }

  /**
   * HTTP fetch handler
   */
  override async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request, this.env)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RPC Methods - Callable by other workers via service binding
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get a document from a collection
   */
  async getDocument(collection: string, id: string): Promise<Record<string, unknown> | null> {
    return this.env.COLLECTIONS.get(collection, id)
  }

  /**
   * Put a document in a collection
   */
  async putDocument(collection: string, id: string, doc: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.env.COLLECTIONS.put(collection, id, doc)
  }

  /**
   * Delete a document from a collection
   */
  async deleteDocument(collection: string, id: string): Promise<boolean> {
    return this.env.COLLECTIONS.delete(collection, id)
  }

  /**
   * List documents in a collection
   */
  async listDocuments(collection: string, options?: { limit?: number; offset?: number }): Promise<Record<string, unknown>[]> {
    return this.env.COLLECTIONS.list(collection, options)
  }

  /**
   * Find documents in a collection
   */
  async findDocuments(collection: string, filter?: Record<string, unknown>, options?: { limit?: number; offset?: number }): Promise<Record<string, unknown>[]> {
    return this.env.COLLECTIONS.find(collection, filter, options)
  }

  /**
   * Count documents in a collection
   */
  async countDocuments(collection: string, filter?: Record<string, unknown>): Promise<number> {
    return this.env.COLLECTIONS.count(collection, filter)
  }
}
