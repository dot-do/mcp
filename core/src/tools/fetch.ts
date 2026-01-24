/**
 * Fetch Tool
 *
 * MCP tool for retrieving resources using a configured fetch function.
 */

import type { FetchFunction, FetchResult } from '../types.js'

/**
 * Tool definition for the fetch tool
 */
export const fetchTool = {
  name: 'fetch',
  description: 'Retrieve a resource by identifier using the configured fetch function',
  inputSchema: {
    type: 'object',
    properties: {
      resource: { type: 'string', description: 'Resource identifier (URL, path, or ID)' }
    },
    required: ['resource']
  }
} as const

/**
 * Input parameters for the fetch handler
 */
export interface FetchInput {
  resource: string
}

/**
 * MCP tool response format
 */
export interface ToolResponse {
  content: Array<{ type: string; text: string }>
  isError?: boolean
}

/**
 * Check if content type is JSON
 */
function isJsonContentType(contentType?: string): boolean {
  if (!contentType) return false
  return contentType.includes('application/json') || contentType.includes('+json')
}

/**
 * Format JSON content with pretty printing
 */
function formatJsonContent(content: string): string {
  try {
    const parsed = JSON.parse(content)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return content
  }
}

/**
 * Creates a fetch handler function that uses the configured fetch function
 *
 * @param fetchFn - The fetch function to use
 * @returns Handler function for the fetch tool
 */
export function createFetchHandler(
  fetchFn: FetchFunction
): (input: FetchInput) => Promise<ToolResponse> {
  return async (input: FetchInput): Promise<ToolResponse> => {
    try {
      const result: FetchResult | null = await fetchFn(input.resource)

      if (!result) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: 'Resource not found' })
            }
          ],
          isError: true
        }
      }

      const content: Array<{ type: string; text: string }> = []

      // Format content based on content type
      const textContent = isJsonContentType(result.mimeType)
        ? formatJsonContent(result.content)
        : result.content

      content.push({
        type: 'text',
        text: textContent
      })

      // Include metadata if present
      if (result.metadata && Object.keys(result.metadata).length > 0) {
        content.push({
          type: 'text',
          text: JSON.stringify({ metadata: result.metadata }, null, 2)
        })
      }

      return { content }
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
