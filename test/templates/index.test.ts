import { describe, it, expect } from 'vitest'
import {
  // Template functions
  web,
  database,
  filesystem,
  git,
  memory,

  // Type constants
  WEB_TYPES,
  DATABASE_TYPES,
  FILESYSTEM_TYPES,
  GIT_TYPES,
  MEMORY_TYPES,

  // Helper functions
  createWebSearch,
  createHttpFetch,
  createDatabaseSearch,
  createDatabaseFetch,
  createFilesystemSearch,
  createFilesystemFetch,
  createGitSearch,
  createGitFetch,
  createMemorySearch,
  createMemoryFetch,
  createInMemoryStore,

  // Namespace
  templates
} from '../../src/templates/index.js'

describe('templates index', () => {
  describe('named exports', () => {
    it('should export web template', () => {
      expect(typeof web).toBe('function')
    })

    it('should export database template', () => {
      expect(typeof database).toBe('function')
    })

    it('should export filesystem template', () => {
      expect(typeof filesystem).toBe('function')
    })

    it('should export git template', () => {
      expect(typeof git).toBe('function')
    })

    it('should export memory template', () => {
      expect(typeof memory).toBe('function')
    })
  })

  describe('type constants', () => {
    it('should export WEB_TYPES', () => {
      expect(typeof WEB_TYPES).toBe('string')
    })

    it('should export DATABASE_TYPES', () => {
      expect(typeof DATABASE_TYPES).toBe('string')
    })

    it('should export FILESYSTEM_TYPES', () => {
      expect(typeof FILESYSTEM_TYPES).toBe('string')
    })

    it('should export GIT_TYPES', () => {
      expect(typeof GIT_TYPES).toBe('string')
    })

    it('should export MEMORY_TYPES', () => {
      expect(typeof MEMORY_TYPES).toBe('string')
    })
  })

  describe('helper functions', () => {
    it('should export web helpers', () => {
      expect(typeof createWebSearch).toBe('function')
      expect(typeof createHttpFetch).toBe('function')
    })

    it('should export database helpers', () => {
      expect(typeof createDatabaseSearch).toBe('function')
      expect(typeof createDatabaseFetch).toBe('function')
    })

    it('should export filesystem helpers', () => {
      expect(typeof createFilesystemSearch).toBe('function')
      expect(typeof createFilesystemFetch).toBe('function')
    })

    it('should export git helpers', () => {
      expect(typeof createGitSearch).toBe('function')
      expect(typeof createGitFetch).toBe('function')
    })

    it('should export memory helpers', () => {
      expect(typeof createMemorySearch).toBe('function')
      expect(typeof createMemoryFetch).toBe('function')
      expect(typeof createInMemoryStore).toBe('function')
    })
  })

  describe('templates namespace', () => {
    it('should export templates object', () => {
      expect(templates).toBeDefined()
      expect(typeof templates).toBe('object')
    })

    it('should include all templates in namespace', () => {
      expect(templates.web).toBe(web)
      expect(templates.database).toBe(database)
      expect(templates.filesystem).toBe(filesystem)
      expect(templates.git).toBe(git)
      expect(templates.memory).toBe(memory)
    })

    it('should allow creating configs via namespace', () => {
      const webConfig = templates.web({})
      expect(webConfig).toHaveProperty('search')
      expect(webConfig).toHaveProperty('fetch')
      expect(webConfig).toHaveProperty('do')

      const memoryConfig = templates.memory({})
      expect(memoryConfig).toHaveProperty('search')
      expect(memoryConfig).toHaveProperty('fetch')
      expect(memoryConfig).toHaveProperty('do')
    })
  })

  describe('integration', () => {
    it('should create valid MCPServerConfig from each template', () => {
      const configs = [
        templates.web({}),
        templates.database({
          client: {
            query: async () => [],
            get: async () => null,
            create: async () => ({}),
            update: async () => ({}),
            delete: async () => ({ deleted: true })
          }
        }),
        templates.filesystem({ root: '/data' }),
        templates.git({ repo: '/repo' }),
        templates.memory({})
      ]

      for (const config of configs) {
        expect(typeof config.search).toBe('function')
        expect(typeof config.fetch).toBe('function')
        expect(config.do).toHaveProperty('bindings')
        expect(config.do).toHaveProperty('types')
        expect(typeof config.do.types).toBe('string')
      }
    })
  })
})
