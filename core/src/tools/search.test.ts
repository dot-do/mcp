/**
 * Search Tool Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { searchTool, createSearchHandler, type SearchInput } from './search.js'
import type { SearchFunction, SearchResult } from '../types.js'

describe('Search Tool', () => {
  describe('searchTool definition', () => {
    it('should have correct name', () => {
      expect(searchTool.name).toBe('search')
    })

    it('should have description', () => {
      expect(searchTool.description).toBeDefined()
      expect(typeof searchTool.description).toBe('string')
    })

    it('should have inputSchema with query property', () => {
      expect(searchTool.inputSchema.properties.query).toBeDefined()
      expect(searchTool.inputSchema.properties.query.type).toBe('string')
    })

    it('should have inputSchema with optional limit property', () => {
      expect(searchTool.inputSchema.properties.limit).toBeDefined()
      expect(searchTool.inputSchema.properties.limit.type).toBe('number')
    })

    it('should require query in inputSchema', () => {
      expect(searchTool.inputSchema.required).toContain('query')
    })
  })

  describe('createSearchHandler', () => {
    it('should return a function', () => {
      const mockSearch: SearchFunction = vi.fn().mockResolvedValue([])
      const handler = createSearchHandler(mockSearch)

      expect(typeof handler).toBe('function')
    })

    it('should call search function with query', async () => {
      const mockSearch: SearchFunction = vi.fn().mockResolvedValue([])
      const handler = createSearchHandler(mockSearch)

      await handler({ query: 'test query' })

      expect(mockSearch).toHaveBeenCalledWith('test query')
    })

    it('should return results in MCP format', async () => {
      const mockResults: SearchResult[] = [
        { id: '1', title: 'Result 1', description: 'Description 1' },
        { id: '2', title: 'Result 2', description: 'Description 2' },
      ]
      const mockSearch: SearchFunction = vi.fn().mockResolvedValue(mockResults)
      const handler = createSearchHandler(mockSearch)

      const result = await handler({ query: 'test' })

      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')
      expect(JSON.parse(result.content[0].text)).toEqual(mockResults)
    })

    it('should apply limit when specified', async () => {
      const mockResults: SearchResult[] = [
        { id: '1', title: 'Result 1', description: 'Desc 1' },
        { id: '2', title: 'Result 2', description: 'Desc 2' },
        { id: '3', title: 'Result 3', description: 'Desc 3' },
      ]
      const mockSearch: SearchFunction = vi.fn().mockResolvedValue(mockResults)
      const handler = createSearchHandler(mockSearch)

      const result = await handler({ query: 'test', limit: 2 })

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toHaveLength(2)
    })

    it('should return all results when limit is undefined', async () => {
      const mockResults: SearchResult[] = [
        { id: '1', title: 'Result 1', description: 'Desc 1' },
        { id: '2', title: 'Result 2', description: 'Desc 2' },
      ]
      const mockSearch: SearchFunction = vi.fn().mockResolvedValue(mockResults)
      const handler = createSearchHandler(mockSearch)

      const result = await handler({ query: 'test' })

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toHaveLength(2)
    })

    it('should handle empty results', async () => {
      const mockSearch: SearchFunction = vi.fn().mockResolvedValue([])
      const handler = createSearchHandler(mockSearch)

      const result = await handler({ query: 'no matches' })

      expect(result.isError).toBeUndefined()
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toEqual([])
    })

    it('should handle search function errors', async () => {
      const mockSearch: SearchFunction = vi
        .fn()
        .mockRejectedValue(new Error('Search failed'))
      const handler = createSearchHandler(mockSearch)

      const result = await handler({ query: 'test' })

      expect(result.isError).toBe(true)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.error).toBe('Search failed')
    })

    it('should handle non-Error throws', async () => {
      const mockSearch: SearchFunction = vi.fn().mockRejectedValue('string error')
      const handler = createSearchHandler(mockSearch)

      const result = await handler({ query: 'test' })

      expect(result.isError).toBe(true)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.error).toBe('Unknown error occurred')
    })
  })
})
