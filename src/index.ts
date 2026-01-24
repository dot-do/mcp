/**
 * mcp.do - MCP Managed Service
 *
 * This is the service package that provides:
 * - Transports (HTTP, stdio, SSE)
 * - Templates (web, database, filesystem, git, memory)
 * - CLI tooling
 * - Worker deployment
 *
 * For the core library functionality (createMCPServer, tools, scope, auth),
 * use @dotdo/mcp directly.
 */

// Re-export everything from core library
export * from '@dotdo/mcp'

// Transports (service-specific)
export * from './transports/index.js'

// Templates (service-specific configurations)
export * from './templates/index.js'
