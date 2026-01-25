/**
 * Fetch Tool Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { fetchTool, createFetchHandler, type FetchInput } from './fetch.js'
import type { FetchFunction, FetchResult } from '../types.js'

describe('Fetch Tool', () => {
  describe('fetchTool definition', () => {
    it('should have correct name', () => {
      expect(fetchTool.name).toBe('fetch')
    })

    it('should have description', () => {
      expect(fetchTool.description).toBeDefined()
      expect(typeof fetchTool.description).toBe('string')
    })

    it('should have inputSchema with resource property', () => {
      expect(fetchTool.inputSchema.properties.resource).toBeDefined()
      expect(fetchTool.inputSchema.properties.resource.type).toBe('string')
    })

    it('should require resource in inputSchema', () => {
      expect(fetchTool.inputSchema.required).toContain('resource')
    })
  })

  describe('createFetchHandler', () => {
    it('should return a function', () => {
      const mockFetch: FetchFunction = vi.fn().mockResolvedValue(null)
      const handler = createFetchHandler(mockFetch)

      expect(typeof handler).toBe('function')
    })

    it('should call fetch function with resource', async () => {
      const mockFetch: FetchFunction = vi.fn().mockResolvedValue(null)
      const handler = createFetchHandler(mockFetch)

      await handler({ resource: 'doc-123' })

      expect(mockFetch).toHaveBeenCalledWith('doc-123')
    })

    it('should return content in MCP format', async () => {
      const mockResult: FetchResult = {
        id: 'doc-123',
        content: 'Document content here',
        metadata: { type: 'document' },
      }
      const mockFetch: FetchFunction = vi.fn().mockResolvedValue(mockResult)
      const handler = createFetchHandler(mockFetch)

      const result = await handler({ resource: 'doc-123' })

      expect(result.content).toHaveLength(2) // Content + metadata
      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toBe('Document content here')
    })

    it('should include metadata when present', async () => {
      const mockResult: FetchResult = {
        id: 'doc-123',
        content: 'Content',
        metadata: { author: 'John', created: '2024-01-01' },
      }
      const mockFetch: FetchFunction = vi.fn().mockResolvedValue(mockResult)
      const handler = createFetchHandler(mockFetch)

      const result = await handler({ resource: 'doc-123' })

      expect(result.content).toHaveLength(2)
      const metadataContent = JSON.parse(result.content[1].text)
      expect(metadataContent.metadata).toEqual({
        author: 'John',
        created: '2024-01-01',
      })
    })

    it('should not include metadata block when empty', async () => {
      const mockResult: FetchResult = {
        id: 'doc-123',
        content: 'Content',
        metadata: {},
      }
      const mockFetch: FetchFunction = vi.fn().mockResolvedValue(mockResult)
      const handler = createFetchHandler(mockFetch)

      const result = await handler({ resource: 'doc-123' })

      expect(result.content).toHaveLength(1)
    })

    it('should handle not found (null result)', async () => {
      const mockFetch: FetchFunction = vi.fn().mockResolvedValue(null)
      const handler = createFetchHandler(mockFetch)

      const result = await handler({ resource: 'nonexistent' })

      expect(result.isError).toBe(true)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.error).toBe('Resource not found')
    })

    it('should format JSON content', async () => {
      const mockResult: FetchResult = {
        id: 'api-data',
        content: '{"key":"value","nested":{"a":1}}',
        metadata: {},
        mimeType: 'application/json',
      }
      const mockFetch: FetchFunction = vi.fn().mockResolvedValue(mockResult)
      const handler = createFetchHandler(mockFetch)

      const result = await handler({ resource: 'api-data' })

      // JSON should be pretty-printed
      expect(result.content[0].text).toContain('\n')
      expect(JSON.parse(result.content[0].text)).toEqual({
        key: 'value',
        nested: { a: 1 },
      })
    })

    it('should handle content-type with +json suffix', async () => {
      const mockResult: FetchResult = {
        id: 'api-data',
        content: '{"data":"test"}',
        metadata: {},
        mimeType: 'application/vnd.api+json',
      }
      const mockFetch: FetchFunction = vi.fn().mockResolvedValue(mockResult)
      const handler = createFetchHandler(mockFetch)

      const result = await handler({ resource: 'api-data' })

      // Should still format as JSON
      expect(result.content[0].text).toContain('\n')
    })

    it('should not format non-JSON content', async () => {
      const mockResult: FetchResult = {
        id: 'text-doc',
        content: 'Plain text content',
        metadata: {},
        mimeType: 'text/plain',
      }
      const mockFetch: FetchFunction = vi.fn().mockResolvedValue(mockResult)
      const handler = createFetchHandler(mockFetch)

      const result = await handler({ resource: 'text-doc' })

      expect(result.content[0].text).toBe('Plain text content')
    })

    it('should handle fetch function errors', async () => {
      const mockFetch: FetchFunction = vi
        .fn()
        .mockRejectedValue(new Error('Fetch failed'))
      const handler = createFetchHandler(mockFetch)

      const result = await handler({ resource: 'doc-123' })

      expect(result.isError).toBe(true)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.error).toBe('Fetch failed')
    })

    it('should handle non-Error throws', async () => {
      const mockFetch: FetchFunction = vi.fn().mockRejectedValue('string error')
      const handler = createFetchHandler(mockFetch)

      const result = await handler({ resource: 'doc-123' })

      expect(result.isError).toBe(true)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.error).toBe('Unknown error occurred')
    })

    it('should handle invalid JSON content gracefully', async () => {
      const mockResult: FetchResult = {
        id: 'bad-json',
        content: '{ invalid json }',
        metadata: {},
        mimeType: 'application/json',
      }
      const mockFetch: FetchFunction = vi.fn().mockResolvedValue(mockResult)
      const handler = createFetchHandler(mockFetch)

      const result = await handler({ resource: 'bad-json' })

      // Should return raw content if JSON parsing fails
      expect(result.content[0].text).toBe('{ invalid json }')
    })
  })
})
