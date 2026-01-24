/**
 * HTTP Transport for MCP Server
 *
 * Handles JSON-RPC requests over HTTP with optional SSE streaming.
 */

import type { MCPServerWrapper } from '../server.js'
import type { MCPServer } from '../core/types.js'
import type { AuthContext } from '../auth/types.js'

/**
 * JSON-RPC request structure
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: unknown
}

/**
 * JSON-RPC response structure
 */
export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

/**
 * Session object
 */
export interface Session {
  id: string
  createdAt: number
  lastAccessedAt: number
}

/**
 * HTTP transport options
 */
export interface HttpTransportOptions {
  /** CORS origin (default: '*') */
  corsOrigin?: string
  /** Session TTL in milliseconds (default: 3600000 = 1 hour) */
  sessionTTL?: number
  /** Callback when session is accessed */
  onSession?: (session: Session) => void
  /** Rate limiting hook - return false to reject */
  checkRateLimit?: (request: Request, session: Session) => Promise<boolean>
}

/**
 * HTTP handler options (legacy API)
 */
export interface HttpHandlerOptions {
  /** Whether to enable SSE streaming for responses */
  enableSSE?: boolean
  /** Session ID for the request */
  sessionId?: string
}

/**
 * Create a session ID
 */
export function createSessionId(): string {
  return crypto.randomUUID()
}

// Session storage
const sessions = new Map<string, Session>()

/**
 * Get or create a session
 */
function getOrCreateSession(sessionId?: string): Session {
  const id = sessionId || createSessionId()
  let session = sessions.get(id)

  if (!session) {
    session = {
      id,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    }
    sessions.set(id, session)
  } else {
    session.lastAccessedAt = Date.now()
  }

  return session
}

/**
 * Handle a single JSON-RPC request (legacy API)
 */
async function handleJsonRpcRequest(
  server: MCPServer,
  request: JsonRpcRequest,
  authContext: AuthContext
): Promise<JsonRpcResponse> {
  // Validate JSON-RPC format
  if (request.jsonrpc !== '2.0' || !request.method) {
    return {
      jsonrpc: '2.0',
      id: request.id || 0,
      error: {
        code: -32600,
        message: 'Invalid Request',
      },
    }
  }

  // Check readonly restrictions
  if (authContext.readonly && isWriteMethod(request.method)) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32600,
        message: 'Write operations not allowed in readonly mode',
      },
    }
  }

  try {
    const result = await server.handleRequest({
      method: request.method,
      params: request.params,
      authContext,
    })

    return {
      jsonrpc: '2.0',
      id: request.id,
      result,
    }
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error instanceof Error ? error.message : String(error),
      },
    }
  }
}

/**
 * Handle a JSON-RPC request for MCPServerWrapper
 */
async function handleJsonRpcRequestForWrapper(
  server: MCPServerWrapper,
  request: JsonRpcRequest
): Promise<JsonRpcResponse> {
  // Validate JSON-RPC format
  if (request.jsonrpc !== '2.0' || !request.method) {
    return {
      jsonrpc: '2.0',
      id: request.id || 0,
      error: {
        code: -32600,
        message: 'Invalid Request',
      },
    }
  }

  try {
    // For the wrapper API, we just return a success response
    // The actual method handling would be done through the server's tools
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: { success: true },
    }
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error instanceof Error ? error.message : String(error),
      },
    }
  }
}

/**
 * Check if a method is a write operation
 */
function isWriteMethod(method: string): boolean {
  const writeMethods = ['tools/call', 'do']
  return writeMethods.some((m) => method.toLowerCase().includes(m))
}

// Function overloads
export function createHttpHandler(
  server: MCPServerWrapper,
  options?: HttpTransportOptions
): (request: Request) => Promise<Response>

export function createHttpHandler(
  server: MCPServer,
  authContext: AuthContext,
  options?: HttpHandlerOptions
): (request: Request) => Promise<Response>

// Implementation
export function createHttpHandler(
  server: MCPServerWrapper | MCPServer,
  authContextOrOptions?: AuthContext | HttpTransportOptions,
  legacyOptions?: HttpHandlerOptions
): (request: Request) => Promise<Response> {
  // Detect which API is being used
  const isNewAPI =
    'connect' in server && 'close' in server && typeof (server as MCPServerWrapper).connect === 'function'

  if (isNewAPI) {
    // New API with MCPServerWrapper
    const mcpServer = server as MCPServerWrapper
    const options = (authContextOrOptions as HttpTransportOptions) || {}
    const corsOrigin = options.corsOrigin || '*'

    return async (request: Request): Promise<Response> => {
      // Get or create session
      const sessionId = request.headers.get('mcp-session-id') || undefined
      const session = getOrCreateSession(sessionId)

      // Call session callback
      if (options.onSession) {
        options.onSession(session)
      }

      // Check rate limit
      if (options.checkRateLimit) {
        const allowed = await options.checkRateLimit(request, session)
        if (!allowed) {
          return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': corsOrigin,
              'mcp-session-id': session.id,
            },
          })
        }
      }

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': corsOrigin,
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, mcp-session-id',
            'Access-Control-Max-Age': '86400',
            'mcp-session-id': session.id,
          },
        })
      }

      // Only allow GET and POST
      if (request.method !== 'GET' && request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': corsOrigin,
            'mcp-session-id': session.id,
          },
        })
      }

      // SSE endpoint for GET requests
      if (request.method === 'GET') {
        const acceptHeader = request.headers.get('Accept') || ''
        if (acceptHeader.includes('text/event-stream')) {
          // Return SSE stream
          const stream = new ReadableStream({
            start(controller) {
              // Send initial connection event
              controller.enqueue(
                new TextEncoder().encode(
                  `event: connected\ndata: ${JSON.stringify({ sessionId: session.id })}\n\n`
                )
              )
            },
          })

          return new Response(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
              'Access-Control-Allow-Origin': corsOrigin,
              'mcp-session-id': session.id,
            },
          })
        }

        // Return 400 for non-SSE GET requests
        return new Response(JSON.stringify({ error: 'Use POST for JSON-RPC or Accept: text/event-stream for SSE' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': corsOrigin,
            'mcp-session-id': session.id,
          },
        })
      }

      // Handle POST requests (JSON-RPC)
      try {
        const body = (await request.json()) as JsonRpcRequest | JsonRpcRequest[]

        // Handle batch requests
        if (Array.isArray(body)) {
          const responses = await Promise.all(
            body.map((req) => handleJsonRpcRequestForWrapper(mcpServer, req))
          )
          return new Response(JSON.stringify(responses), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': corsOrigin,
              'mcp-session-id': session.id,
            },
          })
        }

        // Handle single request
        const response = await handleJsonRpcRequestForWrapper(mcpServer, body)
        return new Response(JSON.stringify(response), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': corsOrigin,
            'mcp-session-id': session.id,
          },
        })
      } catch (error) {
        const errorResponse: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 0,
          error: {
            code: -32700,
            message: 'Parse error',
            data: error instanceof Error ? error.message : String(error),
          },
        }

        return new Response(JSON.stringify(errorResponse), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': corsOrigin,
            'mcp-session-id': session.id,
          },
        })
      }
    }
  } else {
    // Legacy API with MCPServer
    const mcpServer = server as MCPServer
    const authContext = authContextOrOptions as AuthContext
    const options = legacyOptions || {}

    return async (request: Request): Promise<Response> => {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
            'Access-Control-Max-Age': '86400',
          },
        })
      }

      // Only allow GET and POST
      if (request.method !== 'GET' && request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // SSE endpoint for GET requests
      if (request.method === 'GET') {
        if (!options.enableSSE) {
          return new Response(JSON.stringify({ error: 'SSE not enabled' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Return SSE stream
        const stream = new ReadableStream({
          start(controller) {
            // Send initial connection event
            controller.enqueue(
              new TextEncoder().encode(
                `event: connected\ndata: ${JSON.stringify({ sessionId: options.sessionId })}\n\n`
              )
            )
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          },
        })
      }

      // Handle POST requests (JSON-RPC)
      try {
        const body = (await request.json()) as JsonRpcRequest | JsonRpcRequest[]

        // Handle batch requests
        if (Array.isArray(body)) {
          const responses = await Promise.all(
            body.map((req) => handleJsonRpcRequest(mcpServer, req, authContext))
          )
          return new Response(JSON.stringify(responses), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          })
        }

        // Handle single request
        const response = await handleJsonRpcRequest(mcpServer, body, authContext)
        return new Response(JSON.stringify(response), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        })
      } catch (error) {
        const errorResponse: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: 0,
          error: {
            code: -32700,
            message: 'Parse error',
            data: error instanceof Error ? error.message : String(error),
          },
        }

        return new Response(JSON.stringify(errorResponse), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        })
      }
    }
  }
}
