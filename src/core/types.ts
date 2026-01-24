/**
 * Core MCP Server Types
 *
 * These types define the configuration interface for creating MCP servers
 * with the three primitives: search, fetch, and do.
 */

import type { DoScope } from '../scope/types.js'

/**
 * Search function type - queries a corpus and returns results
 */
export type SearchFunction = (query: string) => Promise<SearchResult[]>

/**
 * Fetch function type - retrieves a resource by identifier
 */
export type FetchFunction = (resource: string) => Promise<FetchResult>

/**
 * Search result from a search operation
 */
export interface SearchResult {
  id: string
  title: string
  snippet?: string
  url?: string
  score?: number
  metadata?: Record<string, unknown>
}

/**
 * Fetch result from a fetch operation
 */
export interface FetchResult {
  content: string
  contentType?: string
  metadata?: Record<string, unknown>
}

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
}

/**
 * MCP Server instance
 */
export interface MCPServer {
  /** Start listening for connections */
  listen(): Promise<void>
  /** Stop the server */
  close(): Promise<void>
  /** Handle a request */
  handleRequest(request: unknown): Promise<unknown>
}

/**
 * Factory function to create an MCP server
 */
export type CreateMCPServer = (config: MCPServerConfig) => MCPServer
