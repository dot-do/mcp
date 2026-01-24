/**
 * Memory Template
 *
 * Pre-built configuration for knowledge graph / memory agents.
 * Provides entity, relation, and observation management with search capabilities.
 */

import type { MCPServerConfig, SearchResult, FetchResult, DoScope } from '@dotdo/mcp'

/**
 * Entity in the knowledge graph
 */
export interface Entity {
  id: string
  name: string
  type: string
  observations: Observation[]
  metadata?: Record<string, unknown>
}

/**
 * Relation between two entities
 */
export interface Relation {
  id: string
  sourceId: string
  targetId: string
  type: string
  metadata?: Record<string, unknown>
}

/**
 * Observation about an entity
 */
export interface Observation {
  id: string
  entityId: string
  content: string
  timestamp: Date
  metadata?: Record<string, unknown>
}

/**
 * Memory store interface for persistence
 */
export interface MemoryStore {
  /** Get an entity by id */
  getEntity: (id: string) => Promise<Entity | null>
  /** Store an entity */
  setEntity: (entity: Entity) => Promise<void>
  /** Delete an entity */
  deleteEntity: (id: string) => Promise<void>
  /** Get a relation by id */
  getRelation: (id: string) => Promise<Relation | null>
  /** Store a relation */
  setRelation: (relation: Relation) => Promise<void>
  /** Delete a relation */
  deleteRelation: (id: string) => Promise<void>
  /** Search entities by query */
  searchEntities: (query: string) => Promise<Entity[]>
  /** Get all relations for an entity */
  getRelationsForEntity: (entityId: string) => Promise<Relation[]>
  /** Get all entities */
  getAllEntities: () => Promise<Entity[]>
}

/**
 * Options for configuring the memory template
 */
export interface MemoryTemplateOptions {
  /** Storage backend for persistence */
  storage?: MemoryStore
}

/**
 * Type definitions for memory template bindings
 */
export const MEMORY_TYPES = `
/**
 * Entity in the knowledge graph
 */
interface Entity {
  id: string;
  name: string;
  type: string;
  observations: Observation[];
  metadata?: Record<string, unknown>;
}

/**
 * Relation between two entities
 */
interface Relation {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  metadata?: Record<string, unknown>;
}

/**
 * Observation about an entity
 */
interface Observation {
  id: string;
  entityId: string;
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Search result from memory search
 */
interface SearchResult {
  id: string;
  title: string;
  snippet?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Result from fetching an entity
 */
interface FetchResult {
  content: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Search for entities in the knowledge graph
 * @param query - Search query
 * @returns Promise resolving to array of search results
 */
declare function search(query: string): Promise<SearchResult[]>;

/**
 * Fetch an entity by id
 * @param id - Entity id
 * @returns Promise resolving to entity content
 */
declare function fetch(id: string): Promise<FetchResult>;

/**
 * Create a new entity in the knowledge graph
 * @param name - Entity name
 * @param type - Entity type (e.g., "person", "concept", "organization")
 * @returns Promise resolving to the created entity
 */
declare function createEntity(name: string, type: string): Promise<Entity>;

/**
 * Create a relation between two entities
 * @param sourceId - Source entity id
 * @param targetId - Target entity id
 * @param type - Relation type (e.g., "knows", "works_at", "related_to")
 * @returns Promise resolving to the created relation
 */
declare function createRelation(sourceId: string, targetId: string, type: string): Promise<Relation>;

/**
 * Add an observation to an entity
 * @param entityId - Entity id to add observation to
 * @param content - Observation content
 * @returns Promise resolving to the created observation
 */
declare function addObservation(entityId: string, content: string): Promise<Observation>;

/**
 * Search for entities by query
 * @param query - Search query (matches name, type, or observations)
 * @returns Promise resolving to matching entities
 */
declare function searchNodes(query: string): Promise<Entity[]>;

/**
 * Open multiple entities by their ids
 * @param ids - Array of entity ids
 * @returns Promise resolving to entities
 */
declare function openNodes(ids: string[]): Promise<Entity[]>;
`

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Create an in-memory store for testing and simple use cases
 */
export function createInMemoryStore(): MemoryStore {
  const entities = new Map<string, Entity>()
  const relations = new Map<string, Relation>()

  return {
    getEntity: async (id: string) => entities.get(id) || null,

    setEntity: async (entity: Entity) => {
      entities.set(entity.id, entity)
    },

    deleteEntity: async (id: string) => {
      entities.delete(id)
    },

    getRelation: async (id: string) => relations.get(id) || null,

    setRelation: async (relation: Relation) => {
      relations.set(relation.id, relation)
    },

    deleteRelation: async (id: string) => {
      relations.delete(id)
    },

    searchEntities: async (query: string) => {
      const lowerQuery = query.toLowerCase()
      return Array.from(entities.values()).filter(entity => {
        // Match name
        if (entity.name.toLowerCase().includes(lowerQuery)) return true
        // Match type
        if (entity.type.toLowerCase().includes(lowerQuery)) return true
        // Match observations
        if (entity.observations.some(obs =>
          obs.content.toLowerCase().includes(lowerQuery)
        )) return true
        return false
      })
    },

    getRelationsForEntity: async (entityId: string) => {
      return Array.from(relations.values()).filter(
        rel => rel.sourceId === entityId || rel.targetId === entityId
      )
    },

    getAllEntities: async () => Array.from(entities.values())
  }
}

/**
 * Create a memory search function
 */
export function createMemorySearch(
  options: MemoryTemplateOptions
): (query: string) => Promise<SearchResult[]> {
  const { storage = createInMemoryStore() } = options

  return async (query: string): Promise<SearchResult[]> => {
    const entities = await storage.searchEntities(query)

    return entities.map(entity => ({
      id: entity.id,
      title: entity.name,
      snippet: `${entity.type} - ${entity.observations.length} observations`,
      metadata: {
        type: entity.type,
        observationCount: entity.observations.length
      }
    }))
  }
}

/**
 * Create a memory fetch function
 */
export function createMemoryFetch(
  options: MemoryTemplateOptions
): (id: string) => Promise<FetchResult> {
  const { storage = createInMemoryStore() } = options

  return async (id: string): Promise<FetchResult> => {
    const entity = await storage.getEntity(id)

    if (!entity) {
      return {
        content: JSON.stringify({ error: 'Entity not found', id }),
        contentType: 'application/json',
        metadata: { found: false }
      }
    }

    const relations = await storage.getRelationsForEntity(id)

    const content = JSON.stringify({
      ...entity,
      relations
    }, null, 2)

    return {
      content,
      contentType: 'application/json',
      metadata: {
        found: true,
        type: entity.type,
        relationCount: relations.length
      }
    }
  }
}

/**
 * Create knowledge graph operations
 */
function createKnowledgeGraphOperations(storage: MemoryStore) {
  return {
    createEntity: async (name: string, type: string): Promise<Entity> => {
      const entity: Entity = {
        id: generateId(),
        name,
        type,
        observations: []
      }
      await storage.setEntity(entity)
      return entity
    },

    createRelation: async (
      sourceId: string,
      targetId: string,
      type: string
    ): Promise<Relation> => {
      const relation: Relation = {
        id: generateId(),
        sourceId,
        targetId,
        type
      }
      await storage.setRelation(relation)
      return relation
    },

    addObservation: async (
      entityId: string,
      content: string
    ): Promise<Observation> => {
      const entity = await storage.getEntity(entityId)
      if (!entity) {
        throw new Error(`Entity not found: ${entityId}`)
      }

      const observation: Observation = {
        id: generateId(),
        entityId,
        content,
        timestamp: new Date()
      }

      entity.observations.push(observation)
      await storage.setEntity(entity)

      return observation
    },

    searchNodes: async (query: string): Promise<Entity[]> => {
      return storage.searchEntities(query)
    },

    openNodes: async (ids: string[]): Promise<Entity[]> => {
      const entities: Entity[] = []
      for (const id of ids) {
        const entity = await storage.getEntity(id)
        if (entity) {
          entities.push(entity)
        }
      }
      return entities
    }
  }
}

/**
 * Create a memory template configuration
 *
 * @param options - Configuration options
 * @returns MCPServerConfig for knowledge graph operations
 *
 * @example
 * ```typescript
 * const config = memory({
 *   storage: createInMemoryStore()
 * })
 *
 * // Or use default in-memory storage
 * const config = memory({})
 * ```
 */
export function memory(options: MemoryTemplateOptions = {}): MCPServerConfig {
  const { storage = createInMemoryStore() } = options

  const search = createMemorySearch({ storage })
  const fetch = createMemoryFetch({ storage })
  const graphOps = createKnowledgeGraphOperations(storage)

  const doScope: DoScope = {
    bindings: {
      search,
      fetch,
      createEntity: graphOps.createEntity,
      createRelation: graphOps.createRelation,
      addObservation: graphOps.addObservation,
      searchNodes: graphOps.searchNodes,
      openNodes: graphOps.openNodes
    },
    types: MEMORY_TYPES
  }

  return {
    search,
    fetch,
    do: doScope
  }
}

export default memory
