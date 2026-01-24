/**
 * HTTP Transport for MCP Server
 *
 * Handles JSON-RPC requests over HTTP with optional SSE streaming.
 */

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
 * HTTP handler options
 */
export interface HttpHandlerOptions {
  /** Whether to enable SSE streaming for responses */
  enableSSE?: boolean
  /** Session ID for the request */
  sessionId?: string
}

/**
 * Create a Request handler for the MCP server
 *
 * @param server - The MCP server instance
 * @param authContext - The authentication context for this request
 * @param options - Optional configuration
 * @returns A function that handles Request objects
 */
export function createHttpHandler(
  server: MCPServer,
  authContext: AuthContext,
  options: HttpHandlerOptions = {}
): (request: Request) => Promise<Response> {
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
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // SSE endpoint for GET requests
    if (request.method === 'GET') {
      if (!options.enableSSE) {
        return new Response(
          JSON.stringify({ error: 'SSE not enabled' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
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
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // Handle POST requests (JSON-RPC)
    try {
      const body = await request.json() as JsonRpcRequest | JsonRpcRequest[]

      // Handle batch requests
      if (Array.isArray(body)) {
        const responses = await Promise.all(
          body.map((req) => handleJsonRpcRequest(server, req, authContext))
        )
        return new Response(JSON.stringify(responses), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        })
      }

      // Handle single request
      const response = await handleJsonRpcRequest(server, body, authContext)
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

/**
 * Handle a single JSON-RPC request
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
 * Check if a method is a write operation
 */
function isWriteMethod(method: string): boolean {
  const writeMethods = ['tools/call', 'do']
  return writeMethods.some((m) => method.toLowerCase().includes(m))
}

/**
 * Create a session ID
 */
export function createSessionId(): string {
  return crypto.randomUUID()
}
