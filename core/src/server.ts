/**
 * MCP Server Factory
 *
 * Creates MCP server instances using the official @modelcontextprotocol/sdk.
 * Provides a high-level API for creating servers with search, fetch, and do tools.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod'
import { evaluate } from './sandbox.js'
import type { SandboxEnv } from './sandbox.js'
import type { MCPServerConfig, AuthConfig } from './types.js'

/**
 * Options for creating an MCP server
 */
export interface CreateMCPServerOptions {
  /** Server name (default: 'mcp-server') */
  name?: string
  /** Server version (default: '1.0.0') */
  version?: string
  /** Worker environment with LOADER binding for sandboxed code execution */
  env?: SandboxEnv
}

/**
 * Wrapper interface for MCP server with additional helper methods
 */
export interface MCPServerWrapper {
  /** The underlying McpServer instance */
  server: McpServer
  /** Get the HTTP handler function */
  getHttpHandler(): (request: Request) => Promise<Response>
  /** Check if the server is connected */
  isConnected(): boolean
  /** Get list of registered tool names */
  getRegisteredTools(): string[]
  /** Call a tool directly (for testing) */
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>
  /** Get the authentication configuration */
  getAuthConfig(): AuthConfig | undefined
  /**
   * Set request-scoped bindings for the do tool.
   * Call this before handling each request to provide per-request service bindings.
   * These bindings are passed to the sandbox via Workers RPC and merged with static bindings.
   */
  setRequestBindings(bindings: Record<string, unknown>): void
  /** Clear request-scoped bindings after handling a request */
  clearRequestBindings(): void
}

/**
 * Create an MCP server from configuration
 *
 * @param config - Server configuration with search, fetch, and do functions
 * @param options - Optional server options
 * @returns An MCP server wrapper with helper methods
 */
export function createMCPServer(
  config: MCPServerConfig,
  options: CreateMCPServerOptions = {}
): MCPServerWrapper {
  const { name = 'mcp-server', version = '0.1.0', env: sandboxEnv } = options
  const { search, fetch, do: doScope, auth: authConfig } = config

  // Request-scoped bindings storage (set per-request, cleared after)
  let requestBindings: Record<string, unknown> = {}

  // Track registered tools
  const registeredTools: string[] = []

  // Store direct handlers for testing
  const toolHandlers: Map<string, (args: Record<string, unknown>) => Promise<unknown>> = new Map()

  // Create the McpServer instance
  const mcpServer = new McpServer(
    { name, version },
    {
      capabilities: {
        tools: {},
      },
    }
  )

  // Register the search tool
  mcpServer.tool(
    'search',
    'Search for information in the knowledge base',
    {
      query: z.string().describe('The search query'),
      limit: z.number().optional().describe('Maximum number of results'),
      offset: z.number().optional().describe('Number of results to skip'),
    },
    async (args) => {
      const results = await search(args.query, {
        limit: args.limit,
        offset: args.offset,
      })

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(results, null, 2),
          },
        ],
      }
    }
  )
  registeredTools.push('search')
  toolHandlers.set('search', async (args) => {
    return search(args.query as string, {
      limit: args.limit as number | undefined,
      offset: args.offset as number | undefined,
    })
  })

  // Register the fetch tool
  mcpServer.tool(
    'fetch',
    'Fetch a resource by its identifier',
    {
      id: z.string().describe('The resource identifier'),
      includeMetadata: z.boolean().optional().describe('Include metadata in response'),
      format: z.string().optional().describe('Desired format of the content'),
    },
    async (args) => {
      const result = await fetch(args.id, {
        includeMetadata: args.includeMetadata,
        format: args.format,
      })

      return {
        content: [
          {
            type: 'text' as const,
            text: result ? JSON.stringify(result, null, 2) : 'null',
          },
        ],
      }
    }
  )
  registeredTools.push('fetch')
  toolHandlers.set('fetch', async (args) => {
    return fetch(args.id as string, {
      includeMetadata: args.includeMetadata as boolean | undefined,
      format: args.format as string | undefined,
    })
  })

  // Register the do tool
  mcpServer.tool(
    'do',
    `Execute TypeScript code in a sandboxed environment.

Available bindings:
${doScope.types}`,
    {
      code: z.string().describe('TypeScript code to execute'),
    },
    async (args) => {
      const startTime = Date.now()

      try {
        // Build bindings - start with static, add request-scoped bindings (takes precedence)
        const bindings = { ...doScope.bindings, ...requestBindings }

        const result = await evaluate({
          script: args.code,
          module: doScope.module,
          timeout: doScope.timeout,
          fetch: doScope.permissions?.allowNetwork ? undefined : null,
          bindings,
        }, sandboxEnv)

        const duration = Date.now() - startTime

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: result.success,
                value: result.value,
                logs: result.logs,
                duration,
              }, null, 2),
            },
          ],
          isError: !result.success,
        }
      } catch (error) {
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: errorMessage, duration }, null, 2),
            },
          ],
          isError: true,
        }
      }
    }
  )
  registeredTools.push('do')
  toolHandlers.set('do', async (args) => {
    const startTime = Date.now()
    const result = await evaluate({
      script: args.code as string,
      module: doScope.module,
      timeout: doScope.timeout,
      fetch: doScope.permissions?.allowNetwork ? undefined : null,
      bindings: doScope.bindings,
    }, sandboxEnv)
    const duration = Date.now() - startTime
    return {
      success: result.success,
      value: result.value,
      logs: result.logs,
      duration,
    }
  })

  // Create the transport - stateless for Cloudflare Workers
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode
    enableJsonResponse: true,
  })

  // Connect the server to the transport
  mcpServer.connect(transport)

  return {
    server: mcpServer,

    getHttpHandler(): (request: Request) => Promise<Response> {
      return (request: Request) => transport.handleRequest(request)
    },

    isConnected(): boolean {
      return mcpServer.isConnected()
    },

    getRegisteredTools(): string[] {
      return [...registeredTools]
    },

    async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
      const handler = toolHandlers.get(name)
      if (!handler) {
        throw new Error(`Unknown tool: ${name}`)
      }
      return handler(args)
    },

    getAuthConfig(): AuthConfig | undefined {
      return authConfig
    },

    setRequestBindings(bindings: Record<string, unknown>): void {
      requestBindings = bindings
    },

    clearRequestBindings(): void {
      requestBindings = {}
    },
  }
}

// Re-export types for convenience
export type { MCPServerConfig, SearchResult, FetchResult } from './types.js'
export type { DoScope } from './scope/types.js'
