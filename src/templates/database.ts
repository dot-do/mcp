/**
 * Database Template
 *
 * Pre-built scope for database operations.
 */

import type { DoScope } from '../scope/types.js'

/**
 * Database connection interface
 */
export interface DatabaseConnection {
  /** Execute a query and return results */
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>
  /** Execute a statement (insert/update/delete) */
  execute: (sql: string, params?: unknown[]) => Promise<{ changes: number }>
}

/**
 * Database template options
 */
export interface DatabaseTemplateOptions {
  /** Database connection instance */
  connection: DatabaseConnection
  /** Whether to allow write operations */
  allowWrites?: boolean
  /** Timeout for database operations in ms */
  timeout?: number
}

/**
 * Type definitions for the database scope
 */
const DATABASE_TYPES = `
/**
 * Execute a read-only SQL query
 * @param sql - The SQL query to execute
 * @param params - Optional query parameters
 * @returns Query results as an array of objects
 */
declare function query(sql: string, params?: unknown[]): Promise<unknown[]>;

/**
 * Execute a write SQL statement (INSERT, UPDATE, DELETE)
 * @param sql - The SQL statement to execute
 * @param params - Optional statement parameters
 * @returns Object containing the number of affected rows
 */
declare function execute(sql: string, params?: unknown[]): Promise<{ changes: number }>;
`

/**
 * Create a database scope template
 *
 * @param options - Database template options
 * @returns DoScope configured for database operations
 */
export function createDatabaseTemplate(options: DatabaseTemplateOptions): DoScope {
  const bindings: Record<string, unknown> = {
    query: options.connection.query,
  }

  if (options.allowWrites !== false) {
    bindings.execute = options.connection.execute
  }

  return {
    bindings,
    types: DATABASE_TYPES,
    timeout: options.timeout ?? 30000,
    permissions: {
      allowNetwork: false,
    },
  }
}
