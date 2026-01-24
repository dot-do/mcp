/**
 * Memory Template
 *
 * Pre-built scope for in-memory key-value storage.
 */

import type { DoScope } from '../scope/types.js'

/**
 * Memory store interface
 */
export interface MemoryStore {
  /** Get a value by key */
  get: (key: string) => Promise<unknown | undefined>
  /** Set a value */
  set: (key: string, value: unknown) => Promise<void>
  /** Delete a value */
  delete: (key: string) => Promise<boolean>
  /** Check if a key exists */
  has: (key: string) => Promise<boolean>
  /** Get all keys */
  keys: () => Promise<string[]>
  /** Clear all values */
  clear: () => Promise<void>
}

/**
 * Memory template options
 */
export interface MemoryTemplateOptions {
  /** Memory store instance (uses built-in Map if not provided) */
  store?: MemoryStore
  /** Whether to allow write operations */
  allowWrites?: boolean
  /** Timeout for memory operations in ms */
  timeout?: number
}

/**
 * Type definitions for the memory scope
 */
const MEMORY_TYPES = `
/**
 * Get a value from memory storage
 * @param key - The key to look up
 * @returns The stored value or undefined if not found
 */
declare function get(key: string): Promise<unknown | undefined>;

/**
 * Store a value in memory
 * @param key - The key to store under
 * @param value - The value to store (must be JSON-serializable)
 */
declare function set(key: string, value: unknown): Promise<void>;

/**
 * Delete a value from memory
 * @param key - The key to delete
 * @returns True if the key existed and was deleted
 */
declare function del(key: string): Promise<boolean>;

/**
 * Check if a key exists in memory
 * @param key - The key to check
 * @returns True if the key exists
 */
declare function has(key: string): Promise<boolean>;

/**
 * Get all keys in memory storage
 * @returns Array of all keys
 */
declare function keys(): Promise<string[]>;

/**
 * Clear all values from memory storage
 */
declare function clear(): Promise<void>;
`

/**
 * Create a simple in-memory store
 */
export function createMemoryStore(): MemoryStore {
  const data = new Map<string, unknown>()

  return {
    async get(key: string) {
      return data.get(key)
    },
    async set(key: string, value: unknown) {
      data.set(key, value)
    },
    async delete(key: string) {
      return data.delete(key)
    },
    async has(key: string) {
      return data.has(key)
    },
    async keys() {
      return Array.from(data.keys())
    },
    async clear() {
      data.clear()
    },
  }
}

/**
 * Create a memory scope template
 *
 * @param options - Memory template options
 * @returns DoScope configured for memory operations
 */
export function createMemoryTemplate(options: MemoryTemplateOptions = {}): DoScope {
  const store = options.store ?? createMemoryStore()

  const bindings: Record<string, unknown> = {
    get: store.get,
    has: store.has,
    keys: store.keys,
  }

  if (options.allowWrites !== false) {
    bindings.set = store.set
    bindings.del = store.delete
    bindings.clear = store.clear
  }

  return {
    bindings,
    types: MEMORY_TYPES,
    timeout: options.timeout ?? 5000,
    permissions: {
      allowNetwork: false,
    },
  }
}
