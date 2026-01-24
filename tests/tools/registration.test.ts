import { describe, it, expect, vi } from 'vitest'
import {
  createToolRegistry,
  registerTools,
  getToolDefinitions,
  type Tool,
  type ToolRegistry
} from '../../src/tools/registration.js'
import { searchTool, createSearchHandler } from '../../src/tools/search.js'
import { fetchTool, createFetchHandler } from '../../src/tools/fetch.js'
import { doTool, createDoHandler } from '../../src/tools/do.js'

describe('tool registration', () => {
  describe('createToolRegistry', () => {
    it('creates an empty registry', () => {
      const registry = createToolRegistry()

      expect(registry.tools).toBeDefined()
      expect(registry.handlers).toBeDefined()
      expect(Object.keys(registry.tools)).toHaveLength(0)
    })

    it('has register method', () => {
      const registry = createToolRegistry()

      expect(typeof registry.register).toBe('function')
    })

    it('has getHandler method', () => {
      const registry = createToolRegistry()

      expect(typeof registry.getHandler).toBe('function')
    })

    it('has list method', () => {
      const registry = createToolRegistry()

      expect(typeof registry.list).toBe('function')
    })
  })

  describe('registry.register', () => {
    it('registers a tool with definition and handler', () => {
      const registry = createToolRegistry()
      const handler = vi.fn()

      registry.register({
        name: 'test',
        description: 'Test tool',
        inputSchema: { type: 'object', properties: {}, required: [] }
      }, handler)

      expect(registry.tools['test']).toBeDefined()
      expect(registry.handlers['test']).toBe(handler)
    })

    it('allows multiple tools to be registered', () => {
      const registry = createToolRegistry()

      registry.register({
        name: 'tool1',
        description: 'First tool',
        inputSchema: { type: 'object', properties: {}, required: [] }
      }, vi.fn())

      registry.register({
        name: 'tool2',
        description: 'Second tool',
        inputSchema: { type: 'object', properties: {}, required: [] }
      }, vi.fn())

      expect(Object.keys(registry.tools)).toHaveLength(2)
    })

    it('overwrites existing tool with same name', () => {
      const registry = createToolRegistry()
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      registry.register({
        name: 'test',
        description: 'First version',
        inputSchema: { type: 'object', properties: {}, required: [] }
      }, handler1)

      registry.register({
        name: 'test',
        description: 'Second version',
        inputSchema: { type: 'object', properties: {}, required: [] }
      }, handler2)

      expect(registry.tools['test'].description).toBe('Second version')
      expect(registry.handlers['test']).toBe(handler2)
    })
  })

  describe('registry.getHandler', () => {
    it('returns handler for registered tool', () => {
      const registry = createToolRegistry()
      const handler = vi.fn()

      registry.register({
        name: 'test',
        description: 'Test tool',
        inputSchema: { type: 'object', properties: {}, required: [] }
      }, handler)

      expect(registry.getHandler('test')).toBe(handler)
    })

    it('returns undefined for unregistered tool', () => {
      const registry = createToolRegistry()

      expect(registry.getHandler('nonexistent')).toBeUndefined()
    })
  })

  describe('registry.list', () => {
    it('returns array of tool definitions', () => {
      const registry = createToolRegistry()

      registry.register({
        name: 'search',
        description: 'Search tool',
        inputSchema: { type: 'object', properties: {}, required: [] }
      }, vi.fn())

      registry.register({
        name: 'fetch',
        description: 'Fetch tool',
        inputSchema: { type: 'object', properties: {}, required: [] }
      }, vi.fn())

      const tools = registry.list()

      expect(tools).toHaveLength(2)
      expect(tools.find(t => t.name === 'search')).toBeDefined()
      expect(tools.find(t => t.name === 'fetch')).toBeDefined()
    })

    it('returns empty array for empty registry', () => {
      const registry = createToolRegistry()

      expect(registry.list()).toEqual([])
    })
  })

  describe('registerTools helper', () => {
    it('registers search, fetch, and do tools', () => {
      const mockSearch = vi.fn().mockResolvedValue([])
      const mockFetch = vi.fn().mockResolvedValue({ content: '' })
      const mockScope = { bindings: {}, types: '' }

      const registry = registerTools({
        search: mockSearch,
        fetch: mockFetch,
        do: mockScope
      })

      expect(registry.tools['search']).toBeDefined()
      expect(registry.tools['fetch']).toBeDefined()
      expect(registry.tools['do']).toBeDefined()
    })

    it('uses correct tool definitions', () => {
      const mockSearch = vi.fn().mockResolvedValue([])
      const mockFetch = vi.fn().mockResolvedValue({ content: '' })
      const mockScope = { bindings: {}, types: '' }

      const registry = registerTools({
        search: mockSearch,
        fetch: mockFetch,
        do: mockScope
      })

      expect(registry.tools['search'].name).toBe('search')
      expect(registry.tools['fetch'].name).toBe('fetch')
      expect(registry.tools['do'].name).toBe('do')
    })

    it('creates working handlers', async () => {
      const mockSearch = vi.fn().mockResolvedValue([{ id: '1', title: 'Result' }])
      const mockFetch = vi.fn().mockResolvedValue({ content: 'Hello' })
      const mockScope = { bindings: {}, types: '' }

      const registry = registerTools({
        search: mockSearch,
        fetch: mockFetch,
        do: mockScope
      })

      const searchHandler = registry.getHandler('search')!
      const result = await searchHandler({ query: 'test' })

      expect(mockSearch).toHaveBeenCalledWith('test')
      expect(result.content[0].type).toBe('text')
    })
  })

  describe('getToolDefinitions', () => {
    it('returns MCP-compatible tool list', () => {
      const registry = createToolRegistry()

      registry.register({
        name: 'test',
        description: 'Test tool',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          },
          required: ['input']
        }
      }, vi.fn())

      const definitions = getToolDefinitions(registry)

      expect(definitions).toHaveLength(1)
      expect(definitions[0]).toEqual({
        name: 'test',
        description: 'Test tool',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          },
          required: ['input']
        }
      })
    })
  })
})
