/**
 * MCP Server Factory
 *
 * Creates MCP server instances using the @modelcontextprotocol/sdk.
 * Provides a high-level API for creating servers with search, fetch, and do tools.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { z } from 'zod'
import { evaluate } from 'ai-evaluate'
import type { MCPServerConfig } from './types.js'

/**
 * Options for creating an MCP server
 */
export interface CreateMCPServerOptions {
  /** Server name (default: 'mcp-server') */
  name?: string
  /** Server version (default: '1.0.0') */
  version?: string
}

/**
 * Wrapper interface for MCP server with additional helper methods
 */
export interface MCPServerWrapper {
  /** The underlying McpServer instance */
  server: McpServer
  /** Connect to a transport */
  connect(transport: Transport): Promise<void>
  /** Close the server connection */
  close(): Promise<void>
  /** Check if the server is connected */
  isConnected(): boolean
  /** Get list of registered tool names */
  getRegisteredTools(): string[]
  /** Call a tool directly (for testing) */
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>
}

/**
 * Create an MCP server from configuration
 *
 * @param config - Server configuration with search, fetch, and do functions
 * @param options - Optional server options
 * @returns An MCP server wrapper with connect and close methods
 */
export function createMCPServer(
  config: MCPServerConfig,
  options: CreateMCPServerOptions = {}
): MCPServerWrapper {
  const { name = 'mcp-server', version = '0.1.0' } = options
  const { search, fetch, do: doScope } = config
  // auth will be used when implementing authentication middleware
  // const { auth } = config

  // Create the McpServer instance
  const mcpServer = new McpServer(
    {
      name,
      version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  )

  // Track registered tool names
  const registeredTools: string[] = []

  // Track tool handlers for direct calling
  const toolHandlers: Map<
    string,
    (args: Record<string, unknown>) => Promise<unknown>
  > = new Map()

  // Register the search tool
  mcpServer.registerTool(
    'search',
    {
      description: 'Search for information in the knowledge base',
      inputSchema: {
        query: z.string().describe('The search query'),
        limit: z.number().optional().describe('Maximum number of results'),
        offset: z.number().optional().describe('Number of results to skip'),
      },
    },
    async (args) => {
      const results = await search(args.query as string, {
        limit: args.limit as number | undefined,
        offset: args.offset as number | undefined,
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

  // Handler for direct tool calls
  toolHandlers.set('search', async (args) => {
    return search(args.query as string, {
      limit: args.limit as number | undefined,
      offset: args.offset as number | undefined,
    })
  })

  // Register the fetch tool
  mcpServer.registerTool(
    'fetch',
    {
      description: 'Fetch a resource by its identifier',
      inputSchema: {
        id: z.string().describe('The resource identifier'),
        includeMetadata: z
          .boolean()
          .optional()
          .describe('Include metadata in response'),
        format: z.string().optional().describe('Desired format of the content'),
      },
    },
    async (args) => {
      const result = await fetch(args.id as string, {
        includeMetadata: args.includeMetadata as boolean | undefined,
        format: args.format as string | undefined,
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

  // Handler for direct tool calls
  toolHandlers.set('fetch', async (args) => {
    return fetch(args.id as string, {
      includeMetadata: args.includeMetadata as boolean | undefined,
      format: args.format as string | undefined,
    })
  })

  // Register the do tool
  mcpServer.registerTool(
    'do',
    {
      description: `Execute TypeScript code in a sandboxed environment.

Available bindings:
${doScope.types}`,
      inputSchema: {
        code: z.string().describe('TypeScript code to execute'),
      },
    },
    async (args) => {
      const startTime = Date.now()

      try {
        const result = await evaluate({
          script: args.code as string,
          timeout: doScope.timeout,
          // Note: bindings need to be injected via a different mechanism
          // For now, bindings are available through sdk config
          sdk: typeof doScope.bindings === 'object' ? { ...doScope.bindings as Record<string, unknown> } : undefined,
        })

        const duration = Date.now() - startTime

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ result, duration }, null, 2),
            },
          ],
        }
      } catch (error) {
        const duration = Date.now() - startTime
        const errorMessage =
          error instanceof Error ? error.message : String(error)

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

  // Handler for direct tool calls
  toolHandlers.set('do', async (args) => {
    const startTime = Date.now()

    const result = await evaluate({
      script: args.code as string,
      timeout: doScope.timeout,
      sdk: typeof doScope.bindings === 'object' ? { ...doScope.bindings as Record<string, unknown> } : undefined,
    })

    const duration = Date.now() - startTime
    return { result, duration }
  })

  return {
    server: mcpServer,

    async connect(transport: Transport): Promise<void> {
      await mcpServer.connect(transport)
    },

    async close(): Promise<void> {
      await mcpServer.close()
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
  }
}

// Re-export types for convenience
export type { MCPServerConfig, SearchResult, FetchResult } from './types.js'
export type { DoScope } from './scope/types.js'
