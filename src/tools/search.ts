/**
 * Search Tool
 *
 * MCP tool for searching information using a configured search function.
 */

import type { SearchFunction, SearchResult } from '../core/types.js'

/**
 * Tool definition for the search tool
 */
export const searchTool = {
  name: 'search',
  description: 'Search for information using the configured search function',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      limit: { type: 'number', description: 'Max results' }
    },
    required: ['query']
  }
} as const

/**
 * Input parameters for the search handler
 */
export interface SearchInput {
  query: string
  limit?: number
}

/**
 * MCP tool response format
 */
export interface ToolResponse {
  content: Array<{ type: string; text: string }>
  isError?: boolean
}

/**
 * Creates a search handler function that uses the configured search function
 *
 * @param searchFn - The search function to use
 * @returns Handler function for the search tool
 */
export function createSearchHandler(
  searchFn: SearchFunction
): (input: SearchInput) => Promise<ToolResponse> {
  return async (input: SearchInput): Promise<ToolResponse> => {
    try {
      const results = await searchFn(input.query)

      // Apply limit if specified
      const limitedResults: SearchResult[] =
        input.limit !== undefined ? results.slice(0, input.limit) : results

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(limitedResults, null, 2)
          }
        ]
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: errorMessage })
          }
        ],
        isError: true
      }
    }
  }
}
