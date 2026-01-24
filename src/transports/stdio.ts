/**
 * Stdio Transport for MCP Server
 *
 * Handles JSON-RPC communication over stdin/stdout.
 * Supports authentication via oauth.do/node for CLI usage.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { MCPServerWrapper, AuthContext } from '@dotdo/mcp'
import type { JsonRpcRequest, JsonRpcResponse } from './http.js'

/**
 * Legacy MCPServer interface for backwards compatibility
 */
interface MCPServer {
  listen(): Promise<void>
  close(): Promise<void>
  handleRequest(request: unknown): Promise<unknown>
}

/**
 * Authenticate via oauth.do device flow
 * Uses ensureLoggedIn from oauth.do/node to get a valid token
 *
 * @param options - Authentication options
 * @returns AuthContext with OAuth token
 */
export async function authenticateStdio(options: {
  /** Skip browser auto-open */
  noBrowser?: boolean
  /** Force new login even if token exists */
  forceLogin?: boolean
  /** Print function for output (default: console.error to avoid stdout) */
  print?: (message: string) => void
} = {}): Promise<AuthContext> {
  // Dynamic import to avoid bundling oauth.do in non-Node environments
  const { ensureLoggedIn, forceLogin } = await import('oauth.do/node')

  const print = options.print ?? ((msg: string) => console.error(msg))

  const loginFn = options.forceLogin ? forceLogin : ensureLoggedIn
  const result = await loginFn({
    openBrowser: !options.noBrowser,
    print,
  })

  return {
    type: 'oauth',
    id: 'oauth-user', // Will be populated by token introspection if needed
    token: result.token,
    readonly: false,
  }
}

/**
 * Try to get existing auth without prompting for login
 * Returns null if no valid token exists
 *
 * @returns AuthContext if logged in, null otherwise
 */
export async function tryGetAuth(): Promise<AuthContext | null> {
  try {
    const { getToken, isAuthenticated } = await import('oauth.do/node')

    // Check if we have a valid token without prompting
    if (await isAuthenticated()) {
      const token = await getToken()
      if (token) {
        return {
          type: 'oauth',
          id: 'oauth-user',
          token,
          readonly: false,
        }
      }
    }
    return null
  } catch {
    // oauth.do not available or no token
    return null
  }
}

/**
 * Get auth context based on server auth mode
 *
 * - 'auth-required': Force login, throw if can't authenticate
 * - 'anon+auth': Use token if available, otherwise anonymous
 * - 'anon': Always anonymous
 *
 * @param authMode - Server's authentication mode
 * @param options - Authentication options
 * @returns AuthContext appropriate for the mode
 */
export async function getAuthForMode(
  authMode: 'anon' | 'anon+auth' | 'auth-required',
  options: {
    noBrowser?: boolean
    forceLogin?: boolean
    print?: (message: string) => void
  } = {}
): Promise<AuthContext> {
  const print = options.print ?? ((msg: string) => console.error(msg))

  if (authMode === 'anon') {
    // Always anonymous
    return { type: 'anon', id: 'anonymous', readonly: true }
  }

  if (authMode === 'auth-required') {
    // Must authenticate
    print('Authentication required...')
    return authenticateStdio(options)
  }

  // anon+auth: Try to use existing token, fall back to anonymous
  const existingAuth = await tryGetAuth()
  if (existingAuth) {
    print('Using existing authentication')
    return existingAuth
  }

  // No existing auth, use anonymous
  return { type: 'anon', id: 'anonymous', readonly: true }
}

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
  /** Server auth mode - determines automatic auth behavior */
  authMode?: 'anon' | 'anon+auth' | 'auth-required'
  /** Explicitly force OAuth authentication (overrides authMode) */
  auth?: boolean
  /** Skip browser auto-open during auth */
  noBrowser?: boolean
  /** Force new login even if token exists */
  forceLogin?: boolean
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
  let authContext: AuthContext = options.authContext ?? {
    type: 'anon',
    id: 'anonymous',
    readonly: true,
  }

  // Flag to track if auth is being resolved
  let authPromise: Promise<AuthContext> | null = null

  // Determine auth behavior
  if (!options.authContext) {
    if (options.auth) {
      // Explicit --auth flag: force authentication
      authPromise = authenticateStdio({
        noBrowser: options.noBrowser,
        forceLogin: options.forceLogin,
      }).then(ctx => {
        authContext = ctx
        return ctx
      })
    } else if (options.authMode) {
      // Automatic auth based on server mode
      authPromise = getAuthForMode(options.authMode, {
        noBrowser: options.noBrowser,
        forceLogin: options.forceLogin,
      }).then(ctx => {
        authContext = ctx
        return ctx
      })
    }
  }

  let buffer = ''
  let isRunning = false

  const handleLine = async (line: string): Promise<void> => {
    if (!line.trim()) return

    // Wait for auth to complete if in progress
    if (authPromise) {
      await authPromise
    }

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
