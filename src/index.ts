/**
 * MCP Server
 *
 * Main entry point for the MCP (Model Context Protocol) server.
 * Exports the three primitives: search, fetch, and do.
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

// Transports
export * from './transports/index.js'

// Scope
export * from './scope/index.js'

// Templates
export * from './templates/index.js'
