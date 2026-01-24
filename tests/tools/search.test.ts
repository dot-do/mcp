import { describe, it, expect, vi } from 'vitest'
import { searchTool, createSearchHandler } from '../../src/tools/search.js'
import type { SearchFunction, SearchResult } from '../../src/core/types.js'

describe('searchTool', () => {
  describe('tool definition', () => {
    it('has correct name', () => {
      expect(searchTool.name).toBe('search')
    })

    it('has description', () => {
      expect(searchTool.description).toBe('Search for information using the configured search function')
    })

    it('has correct input schema', () => {
      expect(searchTool.inputSchema).toEqual({
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Max results' }
        },
        required: ['query']
      })
    })
  })

  describe('createSearchHandler', () => {
    it('calls the configured search function with query', async () => {
      const mockSearch = vi.fn<SearchFunction>().mockResolvedValue([
        { id: '1', title: 'Result 1', snippet: 'Snippet 1' }
      ])

      const handler = createSearchHandler(mockSearch)
      await handler({ query: 'test query' })

      expect(mockSearch).toHaveBeenCalledWith('test query')
    })

    it('returns search results', async () => {
      const mockResults: SearchResult[] = [
        { id: '1', title: 'Result 1', snippet: 'Snippet 1' },
        { id: '2', title: 'Result 2', snippet: 'Snippet 2' }
      ]
      const mockSearch = vi.fn<SearchFunction>().mockResolvedValue(mockResults)

      const handler = createSearchHandler(mockSearch)
      const result = await handler({ query: 'test' })

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockResults, null, 2)
          }
        ]
      })
    })

    it('respects limit parameter', async () => {
      const mockResults: SearchResult[] = [
        { id: '1', title: 'Result 1' },
        { id: '2', title: 'Result 2' },
        { id: '3', title: 'Result 3' }
      ]
      const mockSearch = vi.fn<SearchFunction>().mockResolvedValue(mockResults)

      const handler = createSearchHandler(mockSearch)
      const result = await handler({ query: 'test', limit: 2 })

      const parsedContent = JSON.parse(
        (result.content[0] as { type: string; text: string }).text
      )
      expect(parsedContent).toHaveLength(2)
    })

    it('handles empty results', async () => {
      const mockSearch = vi.fn<SearchFunction>().mockResolvedValue([])

      const handler = createSearchHandler(mockSearch)
      const result = await handler({ query: 'no results' })

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: '[]'
          }
        ]
      })
    })

    it('handles search errors gracefully', async () => {
      const mockSearch = vi.fn<SearchFunction>().mockRejectedValue(new Error('Search failed'))

      const handler = createSearchHandler(mockSearch)
      const result = await handler({ query: 'error' })

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'Search failed' })
          }
        ],
        isError: true
      })
    })

    it('handles non-Error exceptions', async () => {
      const mockSearch = vi.fn<SearchFunction>().mockRejectedValue('string error')

      const handler = createSearchHandler(mockSearch)
      const result = await handler({ query: 'error' })

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
  })
})
