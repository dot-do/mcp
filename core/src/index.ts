/**
 * @dotdo/mcp - MCP Server Library
 *
 * Core library for building MCP (Model Context Protocol) servers
 * with the three primitives: search, fetch, and do.
 */

// Core types
export * from './types.js'

// Server factory
export { createMCPServer } from './server.js'
export type { MCPServerWrapper, CreateMCPServerOptions } from './server.js'

// Auth
export * from './auth/index.js'

// Tools
export * from './tools/index.js'

// Scope
export * from './scope/index.js'
