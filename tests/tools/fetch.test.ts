import { describe, it, expect, vi } from 'vitest'
import { fetchTool, createFetchHandler } from '../../src/tools/fetch.js'
import type { FetchFunction, FetchResult } from '../../src/core/types.js'

describe('fetchTool', () => {
  describe('tool definition', () => {
    it('has correct name', () => {
      expect(fetchTool.name).toBe('fetch')
    })

    it('has description', () => {
      expect(fetchTool.description).toBe('Retrieve a resource by identifier using the configured fetch function')
    })

    it('has correct input schema', () => {
      expect(fetchTool.inputSchema).toEqual({
        type: 'object',
        properties: {
          resource: { type: 'string', description: 'Resource identifier (URL, path, or ID)' }
        },
        required: ['resource']
      })
    })
  })

  describe('createFetchHandler', () => {
    it('calls the configured fetch function with resource', async () => {
      const mockFetch = vi.fn<FetchFunction>().mockResolvedValue({
        content: 'Test content',
        contentType: 'text/plain'
      })

      const handler = createFetchHandler(mockFetch)
      await handler({ resource: 'doc:123' })

      expect(mockFetch).toHaveBeenCalledWith('doc:123')
    })

    it('returns fetch result as text content', async () => {
      const mockResult: FetchResult = {
        content: 'Hello, world!',
        contentType: 'text/plain'
      }
      const mockFetch = vi.fn<FetchFunction>().mockResolvedValue(mockResult)

      const handler = createFetchHandler(mockFetch)
      const result = await handler({ resource: 'test' })

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Hello, world!'
          }
        ]
      })
    })

    it('returns JSON content as formatted JSON', async () => {
      const jsonContent = { name: 'test', value: 123 }
      const mockResult: FetchResult = {
        content: JSON.stringify(jsonContent),
        contentType: 'application/json'
      }
      const mockFetch = vi.fn<FetchFunction>().mockResolvedValue(mockResult)

      const handler = createFetchHandler(mockFetch)
      const result = await handler({ resource: 'api/test' })

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(jsonContent, null, 2)
          }
        ]
      })
    })

    it('includes metadata in response when present', async () => {
      const mockResult: FetchResult = {
        content: 'Content with metadata',
        contentType: 'text/plain',
        metadata: { lastModified: '2024-01-01', size: 1024 }
      }
      const mockFetch = vi.fn<FetchFunction>().mockResolvedValue(mockResult)

      const handler = createFetchHandler(mockFetch)
      const result = await handler({ resource: 'doc:456' })

      expect(result.content).toHaveLength(2)
      expect(result.content[0]).toEqual({ type: 'text', text: 'Content with metadata' })
      expect(result.content[1]).toEqual({
        type: 'text',
        text: JSON.stringify({ metadata: mockResult.metadata }, null, 2)
      })
    })

    it('handles fetch errors gracefully', async () => {
      const mockFetch = vi.fn<FetchFunction>().mockRejectedValue(new Error('Resource not found'))

      const handler = createFetchHandler(mockFetch)
      const result = await handler({ resource: 'nonexistent' })

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'Resource not found' })
          }
        ],
        isError: true
      })
    })

    it('handles non-Error exceptions', async () => {
      const mockFetch = vi.fn<FetchFunction>().mockRejectedValue('string error')

      const handler = createFetchHandler(mockFetch)
      const result = await handler({ resource: 'error' })

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'Unknown error occurred' })
          }
        ],
        isError: true
      })
    })

    it('handles empty content', async () => {
      const mockResult: FetchResult = {
        content: '',
        contentType: 'text/plain'
      }
      const mockFetch = vi.fn<FetchFunction>().mockResolvedValue(mockResult)

      const handler = createFetchHandler(mockFetch)
      const result = await handler({ resource: 'empty' })

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: ''
          }
        ]
      })
    })
  })
})
