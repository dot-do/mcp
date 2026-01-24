/**
 * Cloudflare Worker Entry Point
 *
 * Exports the Hono app for Cloudflare Workers deployment.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
// AuthContext will be used when implementing the full MCP server
// import type { AuthContext } from '../auth/types.js'

/**
 * Worker environment bindings
 */
export interface Env {
  /** Optional API key for authentication */
  API_KEY?: string
  /** Optional OAuth introspection URL */
  OAUTH_INTROSPECTION_URL?: string
}

/**
 * Create the Hono app for Cloudflare Workers
 */
export function createApp() {
  const app = new Hono<{ Bindings: Env }>()

  // Enable CORS
  app.use('*', cors())

  // Health check endpoint
  app.get('/health', (c) => {
    return c.json({ status: 'ok' })
  })

  // MCP endpoint placeholder
  app.post('/mcp', async (c) => {
    // This will be implemented with the full MCP server
    return c.json({ error: 'Not implemented' }, 501)
  })

  // SSE endpoint placeholder
  app.get('/mcp/sse', async (c) => {
    // This will be implemented with SSE streaming
    return c.json({ error: 'Not implemented' }, 501)
  })

  return app
}

// Export the app for Cloudflare Workers
export default createApp()
