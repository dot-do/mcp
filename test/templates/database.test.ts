import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  database,
  createDatabaseSearch,
  createDatabaseFetch,
  DATABASE_TYPES,
  type DatabaseTemplateOptions,
  type DatabaseClient
} from '../../src/templates/database.js'
import type { MCPServerConfig } from '../../src/core/types.js'

describe('database template', () => {
  // Mock database client
  const mockClient: DatabaseClient = {
    query: vi.fn().mockResolvedValue([
      { id: '1', name: 'Test Record', created_at: new Date() }
    ]),
    get: vi.fn().mockResolvedValue({ id: '1', name: 'Test Record', created_at: new Date() }),
    create: vi.fn().mockResolvedValue({ id: '2', name: 'New Record' }),
    update: vi.fn().mockResolvedValue({ id: '1', name: 'Updated Record' }),
    delete: vi.fn().mockResolvedValue({ deleted: true })
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('database()', () => {
    it('should return a valid MCPServerConfig', () => {
      const config = database({ client: mockClient })

      expect(config).toHaveProperty('search')
      expect(config).toHaveProperty('fetch')
      expect(config).toHaveProperty('do')
      expect(typeof config.search).toBe('function')
      expect(typeof config.fetch).toBe('function')
      expect(config.do).toHaveProperty('bindings')
      expect(config.do).toHaveProperty('types')
    })

    it('should accept a database client', () => {
      const config = database({ client: mockClient })

      expect(config).toBeDefined()
    })

    it('should accept schema option for type generation', () => {
      const config = database({
        client: mockClient,
        schema: {
          users: { id: 'string', name: 'string', email: 'string' }
        }
      })

      expect(config).toBeDefined()
    })

    it('should accept readonly option', () => {
      const config = database({ client: mockClient, readonly: true })

      expect(config).toBeDefined()
    })

    it('should wire bindings correctly', () => {
      const config = database({ client: mockClient })

      expect(config.do.bindings).toHaveProperty('search')
      expect(config.do.bindings).toHaveProperty('fetch')
      expect(config.do.bindings).toHaveProperty('db')
      expect(typeof config.do.bindings.search).toBe('function')
      expect(typeof config.do.bindings.fetch).toBe('function')
      expect(typeof config.do.bindings.db).toBe('object')
    })

    it('should include db operations in bindings', () => {
      const config = database({ client: mockClient })

      const db = config.do.bindings.db as Record<string, unknown>
      expect(db).toHaveProperty('query')
      expect(db).toHaveProperty('get')
      expect(db).toHaveProperty('create')
      expect(db).toHaveProperty('update')
      expect(db).toHaveProperty('delete')
    })

    it('should not include write operations when readonly', () => {
      const config = database({ client: mockClient, readonly: true })

      const db = config.do.bindings.db as Record<string, unknown>
      expect(db).toHaveProperty('query')
      expect(db).toHaveProperty('get')
      expect(db).not.toHaveProperty('create')
      expect(db).not.toHaveProperty('update')
      expect(db).not.toHaveProperty('delete')
    })
  })

  describe('createDatabaseSearch()', () => {
    it('should return a search function', () => {
      const search = createDatabaseSearch({ client: mockClient })

      expect(typeof search).toBe('function')
    })

    it('should call client.query with the search query', async () => {
      const search = createDatabaseSearch({ client: mockClient })
      await search('SELECT * FROM users')

      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM users')
    })

    it('should transform query results to SearchResult format', async () => {
      const search = createDatabaseSearch({ client: mockClient })
      const results = await search('SELECT * FROM users')

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]).toHaveProperty('id')
      expect(results[0]).toHaveProperty('title')
    })
  })

  describe('createDatabaseFetch()', () => {
    it('should return a fetch function', () => {
      const fetch = createDatabaseFetch({ client: mockClient })

      expect(typeof fetch).toBe('function')
    })

    it('should parse resource identifier and call client.get', async () => {
      const fetch = createDatabaseFetch({ client: mockClient })
      await fetch('users:1')

      expect(mockClient.get).toHaveBeenCalledWith('users', '1')
    })

    it('should return FetchResult with content', async () => {
      const fetch = createDatabaseFetch({ client: mockClient })
      const result = await fetch('users:1')

      expect(result).toHaveProperty('content')
      expect(typeof result.content).toBe('string')
    })

    it('should handle table:id format', async () => {
      const fetch = createDatabaseFetch({ client: mockClient })
      await fetch('orders:ord_123')

      expect(mockClient.get).toHaveBeenCalledWith('orders', 'ord_123')
    })
  })

  describe('DATABASE_TYPES', () => {
    it('should be a string', () => {
      expect(typeof DATABASE_TYPES).toBe('string')
    })

    it('should contain search function declaration', () => {
      expect(DATABASE_TYPES).toContain('search')
    })

    it('should contain fetch function declaration', () => {
      expect(DATABASE_TYPES).toContain('fetch')
    })

    it('should contain db object declaration', () => {
      expect(DATABASE_TYPES).toContain('db')
    })

    it('should contain CRUD operations', () => {
      expect(DATABASE_TYPES).toContain('query')
      expect(DATABASE_TYPES).toContain('get')
      expect(DATABASE_TYPES).toContain('create')
      expect(DATABASE_TYPES).toContain('update')
      expect(DATABASE_TYPES).toContain('delete')
    })
  })

  describe('integration', () => {
    it('should create a complete config usable with createMCPServer', () => {
      const config = database({
        client: mockClient,
        schema: { users: { id: 'string' } }
      })

      expect(typeof config.search).toBe('function')
      expect(typeof config.fetch).toBe('function')
      expect(config.do.bindings).toBeDefined()
      expect(config.do.types).toBeDefined()
    })

    it('should allow executing queries through the config', async () => {
      const config = database({ client: mockClient })

      const results = await config.search('SELECT * FROM users')
      expect(mockClient.query).toHaveBeenCalled()
      expect(Array.isArray(results)).toBe(true)
    })

    it('should allow fetching records through the config', async () => {
      const config = database({ client: mockClient })

      const result = await config.fetch('users:1')
      expect(mockClient.get).toHaveBeenCalled()
      expect(result).toHaveProperty('content')
    })
  })
})
