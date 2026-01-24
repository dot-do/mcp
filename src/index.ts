/**
 * MCP Server
 *
 * Main entry point for the MCP (Model Context Protocol) server.
 * Exports the three primitives: search, fetch, and do.
 */

// Core types
export * from './core/types.js'

// Server
export * from './server.js'

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
