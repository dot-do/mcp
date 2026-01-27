/**
 * MCP Server Factory
 *
 * Creates MCP server instances using mcp-lite.
 * Provides a high-level API for creating servers with search, fetch, and do tools.
 */

import { McpServer, StreamableHttpTransport } from 'mcp-lite'
import type { Ctx as MCPServerContext } from 'mcp-lite'
import * as v from 'valibot'
import { toJsonSchema } from '@valibot/to-json-schema'
import { evaluate } from './sandbox.js'
import type { SandboxEnv } from './sandbox.js'
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
  /** Valibot input schema */
  inputSchema: v.GenericSchema<unknown, TInput>
  /** Handler for MCP protocol responses */
  mcpHandler: (args: TInput, ctx: MCPServerContext) => Promise<MCPToolResponse>
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
      // Register with MCP server using mcp-lite's tool() method
      mcpServer.tool(name, {
        description: config.description,
        inputSchema: config.inputSchema,
        handler: async (args, ctx) => config.mcpHandler(args as TInput, ctx),
      })

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
  /** Get the HTTP handler from the transport */
  getHttpHandler(): ReturnType<StreamableHttpTransport['bind']>
  /** Check if the server is connected (always true for mcp-lite) */
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

  // Create the McpServer instance with Valibot schema adapter
  const mcpServer = new McpServer({
    name,
    version,
    schemaAdapter: (schema) => toJsonSchema(schema as v.GenericSchema),
  })

  // Create tool registrar for DRY tool registration
  const registrar = createToolRegistrar(mcpServer)

  // Register the search tool
  registrar.registerTool('search', {
    description: 'Search for information in the knowledge base',
    inputSchema: v.object({
      query: v.pipe(v.string(), v.description('The search query')),
      limit: v.optional(v.pipe(v.number(), v.description('Maximum number of results'))),
      offset: v.optional(v.pipe(v.number(), v.description('Number of results to skip'))),
    }),
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
    inputSchema: v.object({
      id: v.pipe(v.string(), v.description('The resource identifier')),
      includeMetadata: v.optional(v.pipe(v.boolean(), v.description('Include metadata in response'))),
      format: v.optional(v.pipe(v.string(), v.description('Desired format of the content'))),
    }),
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
    inputSchema: v.object({
      code: v.pipe(v.string(), v.description('TypeScript code to execute')),
    }),
    mcpHandler: async (args) => {
      const validatedArgs = validateInput(DoInputSchema, args)
      const startTime = Date.now()

      try {
        // Build bindings - start with static, add request-scoped bindings (takes precedence)
        const bindings = { ...doScope.bindings, ...requestBindings }

        const result = await evaluate({
          script: validatedArgs.code,
          module: doScope.module, // Module exports become globals in script
          timeout: doScope.timeout,
          fetch: doScope.permissions?.allowNetwork ? undefined : null,
          bindings, // Pass service bindings directly (Workers RPC)
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

      const result = await evaluate({
        script: validatedArgs.code,
        module: doScope.module,
        timeout: doScope.timeout,
        fetch: doScope.permissions?.allowNetwork ? undefined : null,
        bindings: doScope.bindings, // Direct handler uses static bindings only
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

  // Create HTTP transport
  const transport = new StreamableHttpTransport()

  return {
    server: mcpServer,

    getHttpHandler(): ReturnType<StreamableHttpTransport['bind']> {
      return transport.bind(mcpServer)
    },

    isConnected(): boolean {
      // mcp-lite doesn't have a persistent connection model like the SDK
      // It handles each HTTP request independently
      return true
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
