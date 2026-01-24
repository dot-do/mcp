/**
 * MCP Server Factory
 *
 * Creates MCP server instances that handle search, fetch, and do operations.
 */

import type {
  MCPServer,
  MCPServerConfig,
  SearchResult,
  FetchResult,
} from './types.js'
import type { AuthContext } from '../auth/types.js'

/**
 * Internal request structure
 */
interface MCPRequest {
  method: string
  params?: unknown
  authContext: AuthContext
}

/**
 * Create an MCP server from configuration
 */
export function createMCPServer(config: MCPServerConfig): MCPServer {
  const { search, fetch, do: doScope } = config

  /**
   * Handle search requests
   */
  async function handleSearch(query: string): Promise<SearchResult[]> {
    return search(query)
  }

  /**
   * Handle fetch requests
   */
  async function handleFetch(resource: string): Promise<FetchResult> {
    return fetch(resource)
  }

  /**
   * Handle do requests (code execution in sandbox)
   */
  async function handleDo(
    code: string,
    _authContext: AuthContext
  ): Promise<unknown> {
    // Import ai-evaluate dynamically for sandbox execution
    const { evaluate } = await import('ai-evaluate')

    const result = await evaluate(code, {
      bindings: doScope.bindings,
      timeout: doScope.timeout,
    })

    return result
  }

  /**
   * Handle incoming requests
   */
  async function handleRequest(request: MCPRequest): Promise<unknown> {
    const { method, params, authContext } = request

    switch (method) {
      case 'initialize':
        return {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
          },
          serverInfo: {
            name: 'mcp-server',
            version: '0.0.1',
          },
        }

      case 'tools/list':
        return {
          tools: [
            {
              name: 'search',
              description: 'Search for information',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'Search query' },
                },
                required: ['query'],
              },
            },
            {
              name: 'fetch',
              description: 'Fetch a resource by identifier',
              inputSchema: {
                type: 'object',
                properties: {
                  resource: {
                    type: 'string',
                    description: 'Resource identifier',
                  },
                },
                required: ['resource'],
              },
            },
            {
              name: 'do',
              description: 'Execute code in a sandboxed environment',
              inputSchema: {
                type: 'object',
                properties: {
                  code: {
                    type: 'string',
                    description: 'TypeScript code to execute',
                  },
                },
                required: ['code'],
              },
            },
          ],
        }

      case 'tools/call': {
        const { name, arguments: args } = params as {
          name: string
          arguments: Record<string, unknown>
        }

        switch (name) {
          case 'search':
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    await handleSearch(args.query as string),
                    null,
                    2
                  ),
                },
              ],
            }

          case 'fetch':
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    await handleFetch(args.resource as string),
                    null,
                    2
                  ),
                },
              ],
            }

          case 'do':
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    await handleDo(args.code as string, authContext),
                    null,
                    2
                  ),
                },
              ],
            }

          default:
            throw new Error(`Unknown tool: ${name}`)
        }
      }

      case 'ping':
        return { pong: true }

      default:
        throw new Error(`Unknown method: ${method}`)
    }
  }

  return {
    async listen(): Promise<void> {
      // Worker mode doesn't need to listen - requests come via fetch handler
    },

    async close(): Promise<void> {
      // Nothing to clean up
    },

    handleRequest,
  }
}
