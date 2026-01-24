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
import type { SandboxEnv } from 'ai-evaluate'
import type { MCPServerConfig, AuthConfig } from './types.js'
import {
  SearchInputSchema,
  FetchInputSchema,
  DoInputSchema,
  validateInput,
} from './validation.js'

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
 * MCP tool response content
 */
export interface MCPToolContent {
  type: 'text'
  text: string
}

/**
 * MCP tool response
 */
export interface MCPToolResponse {
  [key: string]: unknown
  content: MCPToolContent[]
  isError?: boolean
}

/**
 * Tool registration configuration
 */
export interface ToolRegistrationConfig<TInput = Record<string, unknown>> {
  /** Tool description */
  description: string
  /** Zod input schema */
  inputSchema: Record<string, z.ZodTypeAny>
  /** Handler for MCP protocol responses */
  mcpHandler: (args: TInput) => Promise<MCPToolResponse>
  /** Handler for direct tool calls (returns raw data) */
  directHandler: (args: TInput) => Promise<unknown>
}

/**
 * Tool registrar interface
 */
export interface ToolRegistrar {
  /** Register a tool with both MCP and direct handlers */
  registerTool<TInput = Record<string, unknown>>(
    name: string,
    config: ToolRegistrationConfig<TInput>
  ): void
  /** Get list of registered tool names */
  getRegisteredTools(): string[]
  /** Call a tool directly (for testing) */
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>
}

/**
 * Creates a tool registrar that manages tool registration and handlers
 *
 * @param mcpServer - The MCP server instance to register tools with
 * @returns A tool registrar object
 */
export function createToolRegistrar(mcpServer: McpServer): ToolRegistrar {
  const registeredTools: string[] = []
  const toolHandlers: Map<
    string,
    (args: Record<string, unknown>) => Promise<unknown>
  > = new Map()

  return {
    registerTool<TInput = Record<string, unknown>>(
      name: string,
      config: ToolRegistrationConfig<TInput>
    ): void {
      // Register with MCP server
      mcpServer.registerTool(
        name,
        {
          description: config.description,
          inputSchema: config.inputSchema,
        },
        async (args) => config.mcpHandler(args as TInput)
      )

      // Track registered tools
      registeredTools.push(name)

      // Store direct handler
      toolHandlers.set(name, async (args) => config.directHandler(args as TInput))
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
  /** Get the authentication configuration */
  getAuthConfig(): AuthConfig | undefined
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
  const { name = 'mcp-server', version = '0.1.0', env: sandboxEnv } = options
  const { search, fetch, do: doScope, auth: authConfig } = config

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

  // Create tool registrar for DRY tool registration
  const registrar = createToolRegistrar(mcpServer)

  // Register the search tool
  registrar.registerTool('search', {
    description: 'Search for information in the knowledge base',
    inputSchema: {
      query: z.string().describe('The search query'),
      limit: z.number().optional().describe('Maximum number of results'),
      offset: z.number().optional().describe('Number of results to skip'),
    },
    mcpHandler: async (args) => {
      const validatedArgs = validateInput(SearchInputSchema, args)
      const results = await search(validatedArgs.query, {
        limit: validatedArgs.limit,
        offset: validatedArgs.offset,
      })

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(results, null, 2),
          },
        ],
      }
    },
    directHandler: async (args) => {
      const validatedArgs = validateInput(SearchInputSchema, args)
      return search(validatedArgs.query, {
        limit: validatedArgs.limit,
        offset: validatedArgs.offset,
      })
    },
  })

  // Register the fetch tool
  registrar.registerTool('fetch', {
    description: 'Fetch a resource by its identifier',
    inputSchema: {
      id: z.string().describe('The resource identifier'),
      includeMetadata: z
        .boolean()
        .optional()
        .describe('Include metadata in response'),
      format: z.string().optional().describe('Desired format of the content'),
    },
    mcpHandler: async (args) => {
      const validatedArgs = validateInput(FetchInputSchema, args)
      const result = await fetch(validatedArgs.id, {
        includeMetadata: validatedArgs.includeMetadata,
        format: validatedArgs.format,
      })

      return {
        content: [
          {
            type: 'text' as const,
            text: result ? JSON.stringify(result, null, 2) : 'null',
          },
        ],
      }
    },
    directHandler: async (args) => {
      const validatedArgs = validateInput(FetchInputSchema, args)
      return fetch(validatedArgs.id, {
        includeMetadata: validatedArgs.includeMetadata,
        format: validatedArgs.format,
      })
    },
  })

  // Register the do tool
  registrar.registerTool('do', {
    description: `Execute TypeScript code in a sandboxed environment.

Available bindings:
${doScope.types}`,
    inputSchema: {
      code: z.string().describe('TypeScript code to execute'),
    },
    mcpHandler: async (args) => {
      const validatedArgs = validateInput(DoInputSchema, args)
      const startTime = Date.now()

      try {
        // ai-evaluate uses LOADER if available, falls back to Miniflare in Node.js
        const result = await evaluate({
          script: validatedArgs.code,
          timeout: doScope.timeout,
          fetch: doScope.permissions?.allowNetwork ? undefined : null,
          rpc: doScope.bindings, // Pass domain bindings via RPC
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
    },
    directHandler: async (args) => {
      const validatedArgs = validateInput(DoInputSchema, args)
      const startTime = Date.now()

      // ai-evaluate uses LOADER if available, falls back to Miniflare in Node.js
      const result = await evaluate({
        script: validatedArgs.code,
        timeout: doScope.timeout,
        fetch: doScope.permissions?.allowNetwork ? undefined : null,
        rpc: doScope.bindings,
      }, sandboxEnv)

      const duration = Date.now() - startTime
      return {
        success: result.success,
        value: result.value,
        logs: result.logs,
        duration,
      }
    },
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
      return registrar.getRegisteredTools()
    },

    async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
      return registrar.callTool(name, args)
    },

    getAuthConfig(): AuthConfig | undefined {
      return authConfig
    },
  }
}

// Re-export types for convenience
export type { MCPServerConfig, SearchResult, FetchResult } from './types.js'
export type { DoScope } from './scope/types.js'
