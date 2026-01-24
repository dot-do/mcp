/**
 * Database Template
 *
 * Pre-built configuration for database agents.
 * Provides SQL query search, record fetch, and CRUD operations.
 */

import type { MCPServerConfig, SearchResult, FetchResult, DoScope } from '@dotdo/mcp'

/**
 * Database client interface that templates expect
 */
export interface DatabaseClient {
  /** Execute a query and return results */
  query: (sql: string) => Promise<Record<string, unknown>[]>
  /** Get a single record by table and id */
  get: (table: string, id: string) => Promise<Record<string, unknown> | null>
  /** Create a new record */
  create: (table: string, data: Record<string, unknown>) => Promise<Record<string, unknown>>
  /** Update an existing record */
  update: (table: string, id: string, data: Record<string, unknown>) => Promise<Record<string, unknown>>
  /** Delete a record */
  delete: (table: string, id: string) => Promise<{ deleted: boolean }>
}

/**
 * Schema definition for type generation
 */
export type SchemaDefinition = Record<string, Record<string, string>>

/**
 * Options for configuring the database template
 */
export interface DatabaseTemplateOptions {
  /** Database client with CRUD operations */
  client: DatabaseClient
  /** Optional schema definition for type generation */
  schema?: SchemaDefinition
  /** If true, only allow read operations */
  readonly?: boolean
}

/**
 * Type definitions for database template bindings
 */
export const DATABASE_TYPES = `
/**
 * Search result from database query
 */
interface SearchResult {
  id: string;
  title: string;
  snippet?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Result from fetching a database record
 */
interface FetchResult {
  content: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Database record
 */
type Record = { [key: string]: unknown };

/**
 * Execute a SQL query to search for records
 * @param sql - The SQL query to execute
 * @returns Promise resolving to array of search results
 */
declare function search(sql: string): Promise<SearchResult[]>;

/**
 * Fetch a specific record by table and id
 * @param resource - Resource identifier in format "table:id"
 * @returns Promise resolving to the record content
 */
declare function fetch(resource: string): Promise<FetchResult>;

/**
 * Database operations
 */
declare const db: {
  /**
   * Execute a raw SQL query
   * @param sql - The SQL query
   * @returns Promise resolving to query results
   */
  query(sql: string): Promise<Record[]>;

  /**
   * Get a single record by table and id
   * @param table - Table name
   * @param id - Record id
   * @returns Promise resolving to the record or null
   */
  get(table: string, id: string): Promise<Record | null>;

  /**
   * Create a new record
   * @param table - Table name
   * @param data - Record data
   * @returns Promise resolving to the created record
   */
  create(table: string, data: Record): Promise<Record>;

  /**
   * Update an existing record
   * @param table - Table name
   * @param id - Record id
   * @param data - Updated data
   * @returns Promise resolving to the updated record
   */
  update(table: string, id: string, data: Record): Promise<Record>;

  /**
   * Delete a record
   * @param table - Table name
   * @param id - Record id
   * @returns Promise resolving to deletion result
   */
  delete(table: string, id: string): Promise<{ deleted: boolean }>;
};
`

/**
 * Generate types from schema definition
 */
function generateTypesFromSchema(schema: SchemaDefinition): string {
  const tableTypes = Object.entries(schema).map(([table, columns]) => {
    const props = Object.entries(columns)
      .map(([name, type]) => `  ${name}: ${type};`)
      .join('\n')
    return `interface ${capitalize(table)}Record {\n${props}\n}`
  })

  return tableTypes.join('\n\n')
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Create a database search function
 */
export function createDatabaseSearch(
  options: DatabaseTemplateOptions
): (query: string) => Promise<SearchResult[]> {
  const { client } = options

  return async (query: string): Promise<SearchResult[]> => {
    const results = await client.query(query)

    return results.map((record, index) => ({
      id: String(record.id ?? `row-${index}`),
      title: String(record.name ?? record.title ?? `Record ${index + 1}`),
      snippet: JSON.stringify(record).slice(0, 200),
      metadata: record
    }))
  }
}

/**
 * Create a database fetch function
 */
export function createDatabaseFetch(
  options: DatabaseTemplateOptions
): (resource: string) => Promise<FetchResult> {
  const { client } = options

  return async (resource: string): Promise<FetchResult> => {
    // Parse resource identifier (format: "table:id")
    const [table, id] = resource.split(':')

    if (!table || !id) {
      throw new Error(`Invalid resource format: "${resource}". Expected "table:id"`)
    }

    const record = await client.get(table, id)

    if (!record) {
      return {
        content: 'null',
        contentType: 'application/json',
        metadata: { found: false, table, id }
      }
    }

    return {
      content: JSON.stringify(record, null, 2),
      contentType: 'application/json',
      metadata: { found: true, table, id }
    }
  }
}

/**
 * Create database operations object
 */
function createDatabaseOperations(
  client: DatabaseClient,
  readonly: boolean
): Record<string, unknown> {
  const readOps = {
    query: client.query.bind(client),
    get: client.get.bind(client)
  }

  if (readonly) {
    return readOps
  }

  return {
    ...readOps,
    create: client.create.bind(client),
    update: client.update.bind(client),
    delete: client.delete.bind(client)
  }
}

/**
 * Create a database template configuration
 *
 * @param options - Configuration options
 * @returns MCPServerConfig for database operations
 *
 * @example
 * ```typescript
 * const config = database({
 *   client: pgClient,
 *   schema: {
 *     users: { id: 'string', name: 'string', email: 'string' }
 *   }
 * })
 * ```
 */
export function database(options: DatabaseTemplateOptions): MCPServerConfig {
  const { client, schema, readonly = false } = options

  const search = createDatabaseSearch(options)
  const fetch = createDatabaseFetch(options)
  const db = createDatabaseOperations(client, readonly)

  // Generate types from schema if provided
  let types = DATABASE_TYPES
  if (schema) {
    types = `${types}\n\n${generateTypesFromSchema(schema)}`
  }

  const doScope: DoScope = {
    bindings: {
      search,
      fetch,
      db
    },
    types
  }

  return {
    search,
    fetch,
    do: doScope
  }
}

export default database
