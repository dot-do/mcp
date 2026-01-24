/**
 * Stdio Transport for MCP Server
 *
 * Handles JSON-RPC communication over stdin/stdout.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { MCPServerWrapper } from '../server.js'
import type { MCPServer } from '../core/types.js'
import type { AuthContext } from '../auth/types.js'
import type { JsonRpcRequest, JsonRpcResponse } from './http.js'

/**
 * Connect an MCP server to stdio transport using the MCP SDK
 *
 * This sets up the server to communicate via stdin/stdout,
 * which is useful for CLI-based MCP usage.
 *
 * @param server - The MCP server wrapper to connect
 * @returns Promise that resolves when connection is established
 */
export async function connectStdio(server: MCPServerWrapper): Promise<void> {
  const transport = new StdioServerTransport()

  // Register signal handlers for graceful shutdown
  const handleShutdown = async () => {
    await server.close()
    process.exit(0)
  }

  process.on('SIGINT', handleShutdown)
  process.on('SIGTERM', handleShutdown)

  // Connect the server to the transport
  await server.connect(transport)
}

/**
 * Options for the stdio transport
 */
export interface StdioTransportOptions {
  /** Authentication context for all requests */
  authContext?: AuthContext
  /** Custom input stream (default: process.stdin) */
  input?: NodeJS.ReadableStream
  /** Custom output stream (default: process.stdout) */
  output?: NodeJS.WritableStream
}

/**
 * Stdio transport instance
 */
export interface StdioTransport {
  /** Start listening on stdin */
  start(): void
  /** Stop listening */
  stop(): void
}

/**
 * Create a stdio transport for the MCP server
 *
 * @param server - The MCP server instance
 * @param options - Transport options
 * @returns Stdio transport instance
 */
export function createStdioTransport(
  server: MCPServer,
  options: StdioTransportOptions = {}
): StdioTransport {
  const authContext: AuthContext = options.authContext ?? {
    type: 'anon',
    id: 'anonymous',
    readonly: true,
  }

  let buffer = ''
  let isRunning = false

  const handleLine = async (line: string): Promise<void> => {
    if (!line.trim()) return

    try {
      const request = JSON.parse(line) as JsonRpcRequest
      const response = await handleRequest(server, request, authContext)
      const output = options.output ?? process.stdout
      output.write(JSON.stringify(response) + '\n')
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
      const output = options.output ?? process.stdout
      output.write(JSON.stringify(errorResponse) + '\n')
    }
  }

  const onData = (chunk: Buffer | string): void => {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      handleLine(line)
    }
  }

  return {
    start(): void {
      if (isRunning) return
      isRunning = true

      const input = options.input ?? process.stdin
      input.on('data', onData)
      input.resume()
    },

    stop(): void {
      if (!isRunning) return
      isRunning = false

      const input = options.input ?? process.stdin
      input.off('data', onData)
    },
  }
}

/**
 * Handle a JSON-RPC request
 */
async function handleRequest(
  server: MCPServer,
  request: JsonRpcRequest,
  authContext: AuthContext
): Promise<JsonRpcResponse> {
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
