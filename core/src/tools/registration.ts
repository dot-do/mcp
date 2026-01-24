/**
 * Tool Registration Helper
 *
 * Provides a centralized registry for MCP tools with their definitions
 * and handlers.
 */

import type { SearchFunction, FetchFunction } from '../types.js'
import type { DoScope } from '../scope/types.js'
import { searchTool, createSearchHandler } from './search.js'
import { fetchTool, createFetchHandler } from './fetch.js'
import { doTool, createDoHandler } from './do.js'

/**
 * Tool definition compatible with MCP protocol
 */
export interface Tool {
  name: string
  description: string
  inputSchema: {
    type: string
    properties: Record<string, unknown>
    required: readonly string[] | string[]
  }
}

/**
 * Tool handler function type
 */
export type ToolHandler = (input: unknown) => Promise<{
  content: Array<{ type: string; text: string }>
  isError?: boolean
}>

/**
 * Tool registry containing tools and their handlers
 */
export interface ToolRegistry {
  /** Map of tool name to tool definition */
  tools: Record<string, Tool>
  /** Map of tool name to handler function */
  handlers: Record<string, ToolHandler>
  /** Register a new tool */
  register: (tool: Tool, handler: ToolHandler) => void
  /** Get handler for a tool by name */
  getHandler: (name: string) => ToolHandler | undefined
  /** List all registered tools */
  list: () => Tool[]
}

/**
 * Configuration for registering the three core tools
 */
export interface ToolsConfig {
  search: SearchFunction
  fetch: FetchFunction
  do: DoScope
}

/**
 * Creates a new tool registry
 *
 * @returns A new empty tool registry
 */
export function createToolRegistry(): ToolRegistry {
  const tools: Record<string, Tool> = {}
  const handlers: Record<string, ToolHandler> = {}

  return {
    tools,
    handlers,

    register(tool: Tool, handler: ToolHandler) {
      tools[tool.name] = tool
      handlers[tool.name] = handler
    },

    getHandler(name: string) {
      return handlers[name]
    },

    list() {
      return Object.values(tools)
    }
  }
}

/**
 * Registers the three core MCP tools (search, fetch, do)
 *
 * @param config - Configuration with search, fetch, and do scope
 * @returns A registry with all three tools registered
 */
export function registerTools(config: ToolsConfig): ToolRegistry {
  const registry = createToolRegistry()

  // Register search tool
  const searchHandler = createSearchHandler(config.search)
  registry.register(searchTool as Tool, searchHandler as ToolHandler)

  // Register fetch tool
  const fetchHandler = createFetchHandler(config.fetch)
  registry.register(fetchTool as Tool, fetchHandler as ToolHandler)

  // Register do tool
  const doHandler = createDoHandler(config.do)
  registry.register(doTool as Tool, doHandler as ToolHandler)

  return registry
}

/**
 * Gets MCP-compatible tool definitions from a registry
 *
 * @param registry - The tool registry
 * @returns Array of tool definitions
 */
export function getToolDefinitions(registry: ToolRegistry): Tool[] {
  return registry.list()
}

/**
 * Creates a tool call handler that routes to the correct tool
 *
 * @param registry - The tool registry to use
 * @returns A function that handles tool calls
 */
export function createToolCallHandler(registry: ToolRegistry) {
  return async (toolName: string, input: unknown) => {
    const handler = registry.getHandler(toolName)

    if (!handler) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: `Unknown tool: ${toolName}` })
          }
        ],
        isError: true
      }
    }

    return handler(input)
  }
}
