/**
 * Core MCP Server Type Definitions
 *
 * This module exports all the types needed to configure and create an MCP server
 * with the three primitives: search, fetch, and do.
 */

import type { DoScope, DoPermissions } from './scope/types.js'
import type { AuthConfig, AuthMode, AuthContext, OAuthConfig, ApiKeyConfig } from './auth/types.js'

// Re-export types from submodules for convenience
export type { DoScope, DoPermissions, AuthConfig, AuthMode, AuthContext, OAuthConfig, ApiKeyConfig }

/**
 * Options for search operations
 */
export interface SearchOptions {
  /** Maximum number of results to return */
  limit?: number
  /** Number of results to skip */
  offset?: number
  /** Optional filter criteria */
  filter?: Record<string, unknown>
}

/**
 * Search result from a search operation
 */
export interface SearchResult {
  /** Unique identifier for the result */
  id: string
  /** Title of the result */
  title: string
  /** Description or snippet */
  description: string
  /** Optional relevance score */
  score?: number
  /** Optional additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Options for fetch operations
 */
export interface FetchOptions {
  /** Whether to include metadata in the response */
  includeMetadata?: boolean
  /** Desired format of the content */
  format?: string
}

/**
 * Fetch result from a fetch operation
 */
export interface FetchResult {
  /** Unique identifier of the fetched resource */
  id: string
  /** Content of the resource */
  content: string
  /** Metadata about the resource */
  metadata: Record<string, unknown>
  /** Optional MIME type of the content */
  mimeType?: string
  /** Optional encoding of the content */
  encoding?: string
}

/**
 * Search function type - queries a corpus and returns results
 */
export type SearchFunction = (
  query: string,
  options?: SearchOptions
) => Promise<SearchResult[]>

/**
 * Fetch function type - retrieves a resource by identifier
 */
export type FetchFunction = (
  id: string,
  options?: FetchOptions
) => Promise<FetchResult | null>

/**
 * Configuration for creating an MCP server
 */
export interface MCPServerConfig {
  /** Search function for finding information */
  search: SearchFunction
  /** Fetch function for retrieving resources */
  fetch: FetchFunction
  /** Do scope configuration for code execution */
  do: DoScope
  /** Optional authentication configuration */
  auth?: AuthConfig
}
