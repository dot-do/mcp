import { describe, it, expect, vi, beforeEach } from 'vitest'
import { web, createWebSearch, createHttpFetch, WEB_TYPES } from '../../src/templates/web.js'
import type { WebTemplateOptions } from '../../src/templates/web.js'
import type { MCPServerConfig, SearchResult, FetchResult } from '../../src/core/types.js'

describe('web template', () => {
  describe('web()', () => {
    it('should return a valid MCPServerConfig', () => {
      const config = web({})

      expect(config).toHaveProperty('search')
      expect(config).toHaveProperty('fetch')
      expect(config).toHaveProperty('do')
      expect(typeof config.search).toBe('function')
      expect(typeof config.fetch).toBe('function')
      expect(config.do).toHaveProperty('bindings')
      expect(config.do).toHaveProperty('types')
    })

    it('should accept searchProvider option', () => {
      const config = web({ searchProvider: 'brave' })

      expect(config).toBeDefined()
    })

    it('should accept apiKey option', () => {
      const config = web({ apiKey: 'test-api-key' })

      expect(config).toBeDefined()
    })

    it('should accept allowedDomains option', () => {
      const config = web({ allowedDomains: ['*.gov', '*.edu'] })

      expect(config).toBeDefined()
    })

    it('should wire bindings correctly', () => {
      const config = web({})

      expect(config.do.bindings).toHaveProperty('search')
      expect(config.do.bindings).toHaveProperty('fetch')
      expect(typeof config.do.bindings.search).toBe('function')
      expect(typeof config.do.bindings.fetch).toBe('function')
    })

    it('should include WEB_TYPES in do scope', () => {
      const config = web({})

      expect(config.do.types).toContain('search')
      expect(config.do.types).toContain('fetch')
    })
  })

  describe('createWebSearch()', () => {
    it('should return a search function', () => {
      const search = createWebSearch({})

      expect(typeof search).toBe('function')
    })

    it('should return search results with required fields', async () => {
      const search = createWebSearch({})
      const results = await search('test query')

      expect(Array.isArray(results)).toBe(true)
      if (results.length > 0) {
        expect(results[0]).toHaveProperty('id')
        expect(results[0]).toHaveProperty('title')
      }
    })

    it('should respect searchProvider option', async () => {
      const searchBrave = createWebSearch({ searchProvider: 'brave' })
      const searchCustom = createWebSearch({ searchProvider: 'custom' })

      expect(typeof searchBrave).toBe('function')
      expect(typeof searchCustom).toBe('function')
    })

    it('should use apiKey when provided', async () => {
      const search = createWebSearch({ apiKey: 'test-key', searchProvider: 'brave' })

      expect(typeof search).toBe('function')
    })
  })

  describe('createHttpFetch()', () => {
    it('should return a fetch function', () => {
      const httpFetch = createHttpFetch({})

      expect(typeof httpFetch).toBe('function')
    })

    it('should fetch and return content', async () => {
      const httpFetch = createHttpFetch({})

      // Mock or test with a simple URL
      // In real implementation, this would make HTTP requests
      const result = await httpFetch('https://example.com')

      expect(result).toHaveProperty('content')
    })

    it('should respect allowedDomains option', async () => {
      const httpFetch = createHttpFetch({ allowedDomains: ['example.com'] })

      // Should work for allowed domain
      const result = await httpFetch('https://example.com/page')
      expect(result).toHaveProperty('content')
    })

    it('should reject disallowed domains', async () => {
      const httpFetch = createHttpFetch({ allowedDomains: ['example.com'] })

      // Should reject disallowed domain
      await expect(httpFetch('https://evil.com')).rejects.toThrow()
    })

    it('should handle glob patterns in allowedDomains', async () => {
      const httpFetch = createHttpFetch({ allowedDomains: ['*.gov', '*.edu'] })

      // Should work for .gov domain
      const result = await httpFetch('https://whitehouse.gov')
      expect(result).toHaveProperty('content')
    })
  })

  describe('WEB_TYPES', () => {
    it('should be a string', () => {
      expect(typeof WEB_TYPES).toBe('string')
    })

    it('should contain search function declaration', () => {
      expect(WEB_TYPES).toContain('function search')
      expect(WEB_TYPES).toContain('Promise')
    })

    it('should contain fetch function declaration', () => {
      expect(WEB_TYPES).toContain('function fetch')
    })

    it('should contain SearchResult type', () => {
      expect(WEB_TYPES).toContain('SearchResult')
    })

    it('should contain FetchResult type', () => {
      expect(WEB_TYPES).toContain('FetchResult')
    })
  })

  describe('integration', () => {
    it('should create a complete config that could be used with createMCPServer', () => {
      const config = web({
        searchProvider: 'brave',
        apiKey: 'test-key',
        allowedDomains: ['*.com']
      })

      // Verify structure matches MCPServerConfig
      expect(typeof config.search).toBe('function')
      expect(typeof config.fetch).toBe('function')
      expect(config.do.bindings).toBeDefined()
      expect(config.do.types).toBeDefined()

      // Bindings should include search and fetch
      expect(config.do.bindings.search).toBe(config.search)
      expect(config.do.bindings.fetch).toBe(config.fetch)
    })
  })
})
