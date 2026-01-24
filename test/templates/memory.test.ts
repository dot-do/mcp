import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  memory,
  createMemorySearch,
  createMemoryFetch,
  MEMORY_TYPES,
  createInMemoryStore,
  type MemoryTemplateOptions,
  type MemoryStore,
  type Entity,
  type Relation,
  type Observation
} from '../../src/templates/memory.js'
import type { MCPServerConfig } from '../../src/core/types.js'

describe('memory template', () => {
  let store: MemoryStore

  beforeEach(() => {
    store = createInMemoryStore()
  })

  describe('memory()', () => {
    it('should return a valid MCPServerConfig', () => {
      const config = memory({ storage: store })

      expect(config).toHaveProperty('search')
      expect(config).toHaveProperty('fetch')
      expect(config).toHaveProperty('do')
      expect(typeof config.search).toBe('function')
      expect(typeof config.fetch).toBe('function')
      expect(config.do).toHaveProperty('bindings')
      expect(config.do).toHaveProperty('types')
    })

    it('should accept storage option', () => {
      const config = memory({ storage: store })

      expect(config).toBeDefined()
    })

    it('should use in-memory store by default', () => {
      const config = memory({})

      expect(config).toBeDefined()
    })

    it('should wire bindings correctly', () => {
      const config = memory({ storage: store })

      expect(config.do.bindings).toHaveProperty('search')
      expect(config.do.bindings).toHaveProperty('fetch')
      expect(typeof config.do.bindings.search).toBe('function')
      expect(typeof config.do.bindings.fetch).toBe('function')
    })

    it('should include knowledge graph operations in bindings', () => {
      const config = memory({ storage: store })

      expect(config.do.bindings).toHaveProperty('createEntity')
      expect(config.do.bindings).toHaveProperty('createRelation')
      expect(config.do.bindings).toHaveProperty('addObservation')
      expect(config.do.bindings).toHaveProperty('searchNodes')
      expect(config.do.bindings).toHaveProperty('openNodes')
    })
  })

  describe('createInMemoryStore()', () => {
    it('should create an empty store', () => {
      const store = createInMemoryStore()

      expect(store).toBeDefined()
      expect(typeof store.getEntity).toBe('function')
      expect(typeof store.setEntity).toBe('function')
    })

    it('should store and retrieve entities', async () => {
      const store = createInMemoryStore()
      const entity: Entity = {
        id: 'entity-1',
        name: 'Test Entity',
        type: 'person',
        observations: []
      }

      await store.setEntity(entity)
      const retrieved = await store.getEntity('entity-1')

      expect(retrieved).toEqual(entity)
    })

    it('should store and retrieve relations', async () => {
      const store = createInMemoryStore()
      const relation: Relation = {
        id: 'rel-1',
        sourceId: 'entity-1',
        targetId: 'entity-2',
        type: 'knows'
      }

      await store.setRelation(relation)
      const retrieved = await store.getRelation('rel-1')

      expect(retrieved).toEqual(relation)
    })

    it('should search entities by query', async () => {
      const store = createInMemoryStore()
      await store.setEntity({ id: 'e1', name: 'Alice', type: 'person', observations: [] })
      await store.setEntity({ id: 'e2', name: 'Bob', type: 'person', observations: [] })

      const results = await store.searchEntities('Alice')

      expect(results.length).toBe(1)
      expect(results[0].name).toBe('Alice')
    })
  })

  describe('createMemorySearch()', () => {
    it('should return a search function', () => {
      const search = createMemorySearch({ storage: store })

      expect(typeof search).toBe('function')
    })

    it('should search for entities matching query', async () => {
      await store.setEntity({ id: 'e1', name: 'Alice Smith', type: 'person', observations: [] })
      const search = createMemorySearch({ storage: store })

      const results = await search('Alice')

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
    })

    it('should return SearchResult format', async () => {
      await store.setEntity({ id: 'e1', name: 'Test', type: 'concept', observations: [] })
      const search = createMemorySearch({ storage: store })

      const results = await search('Test')

      expect(results[0]).toHaveProperty('id')
      expect(results[0]).toHaveProperty('title')
    })
  })

  describe('createMemoryFetch()', () => {
    it('should return a fetch function', () => {
      const fetch = createMemoryFetch({ storage: store })

      expect(typeof fetch).toBe('function')
    })

    it('should fetch an entity by id', async () => {
      await store.setEntity({ id: 'e1', name: 'Test', type: 'concept', observations: [] })
      const fetch = createMemoryFetch({ storage: store })

      const result = await fetch('e1')

      expect(result).toHaveProperty('content')
      expect(result.content).toContain('Test')
    })

    it('should return FetchResult format', async () => {
      await store.setEntity({ id: 'e1', name: 'Test', type: 'concept', observations: [] })
      const fetch = createMemoryFetch({ storage: store })

      const result = await fetch('e1')

      expect(result).toHaveProperty('content')
      expect(result).toHaveProperty('contentType')
    })
  })

  describe('knowledge graph operations', () => {
    it('createEntity should create a new entity', async () => {
      const config = memory({ storage: store })
      const createEntity = config.do.bindings.createEntity as (
        name: string,
        type: string
      ) => Promise<Entity>

      const entity = await createEntity('Alice', 'person')

      expect(entity).toHaveProperty('id')
      expect(entity.name).toBe('Alice')
      expect(entity.type).toBe('person')
    })

    it('createRelation should create a relation between entities', async () => {
      const config = memory({ storage: store })
      const createEntity = config.do.bindings.createEntity as (
        name: string,
        type: string
      ) => Promise<Entity>
      const createRelation = config.do.bindings.createRelation as (
        sourceId: string,
        targetId: string,
        type: string
      ) => Promise<Relation>

      const alice = await createEntity('Alice', 'person')
      const bob = await createEntity('Bob', 'person')
      const relation = await createRelation(alice.id, bob.id, 'knows')

      expect(relation).toHaveProperty('id')
      expect(relation.sourceId).toBe(alice.id)
      expect(relation.targetId).toBe(bob.id)
      expect(relation.type).toBe('knows')
    })

    it('addObservation should add an observation to an entity', async () => {
      const config = memory({ storage: store })
      const createEntity = config.do.bindings.createEntity as (
        name: string,
        type: string
      ) => Promise<Entity>
      const addObservation = config.do.bindings.addObservation as (
        entityId: string,
        content: string
      ) => Promise<Observation>

      const entity = await createEntity('Alice', 'person')
      const observation = await addObservation(entity.id, 'Works at Acme Corp')

      expect(observation).toHaveProperty('id')
      expect(observation.content).toBe('Works at Acme Corp')
    })

    it('searchNodes should find entities by query', async () => {
      const config = memory({ storage: store })
      const createEntity = config.do.bindings.createEntity as (
        name: string,
        type: string
      ) => Promise<Entity>
      const searchNodes = config.do.bindings.searchNodes as (
        query: string
      ) => Promise<Entity[]>

      await createEntity('Alice Smith', 'person')
      await createEntity('Bob Jones', 'person')

      const results = await searchNodes('Alice')

      expect(results.length).toBe(1)
      expect(results[0].name).toBe('Alice Smith')
    })

    it('openNodes should retrieve multiple entities by ids', async () => {
      const config = memory({ storage: store })
      const createEntity = config.do.bindings.createEntity as (
        name: string,
        type: string
      ) => Promise<Entity>
      const openNodes = config.do.bindings.openNodes as (
        ids: string[]
      ) => Promise<Entity[]>

      const alice = await createEntity('Alice', 'person')
      const bob = await createEntity('Bob', 'person')

      const results = await openNodes([alice.id, bob.id])

      expect(results.length).toBe(2)
    })
  })

  describe('MEMORY_TYPES', () => {
    it('should be a string', () => {
      expect(typeof MEMORY_TYPES).toBe('string')
    })

    it('should contain Entity type', () => {
      expect(MEMORY_TYPES).toContain('Entity')
    })

    it('should contain Relation type', () => {
      expect(MEMORY_TYPES).toContain('Relation')
    })

    it('should contain Observation type', () => {
      expect(MEMORY_TYPES).toContain('Observation')
    })

    it('should contain knowledge graph operations', () => {
      expect(MEMORY_TYPES).toContain('createEntity')
      expect(MEMORY_TYPES).toContain('createRelation')
      expect(MEMORY_TYPES).toContain('addObservation')
      expect(MEMORY_TYPES).toContain('searchNodes')
      expect(MEMORY_TYPES).toContain('openNodes')
    })
  })

  describe('integration', () => {
    it('should create a complete config usable with createMCPServer', () => {
      const config = memory({ storage: store })

      expect(typeof config.search).toBe('function')
      expect(typeof config.fetch).toBe('function')
      expect(config.do.bindings).toBeDefined()
      expect(config.do.types).toBeDefined()
    })

    it('should allow building a knowledge graph', async () => {
      const config = memory({ storage: store })
      const createEntity = config.do.bindings.createEntity as (
        name: string,
        type: string
      ) => Promise<Entity>
      const createRelation = config.do.bindings.createRelation as (
        sourceId: string,
        targetId: string,
        type: string
      ) => Promise<Relation>
      const addObservation = config.do.bindings.addObservation as (
        entityId: string,
        content: string
      ) => Promise<Observation>
      const searchNodes = config.do.bindings.searchNodes as (
        query: string
      ) => Promise<Entity[]>

      // Build a small knowledge graph
      const alice = await createEntity('Alice', 'person')
      const bob = await createEntity('Bob', 'person')
      const acme = await createEntity('Acme Corp', 'organization')

      await createRelation(alice.id, bob.id, 'knows')
      await createRelation(alice.id, acme.id, 'works_at')
      await createRelation(bob.id, acme.id, 'works_at')

      await addObservation(alice.id, 'Senior Engineer')
      await addObservation(bob.id, 'Product Manager')

      // Search should find entities
      const people = await searchNodes('person')
      expect(people.length).toBeGreaterThanOrEqual(2)

      // Search results should be accessible via fetch
      const result = await config.fetch(alice.id)
      expect(result.content).toContain('Alice')
    })
  })
})
