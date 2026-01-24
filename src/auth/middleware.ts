/**
 * Authentication Middleware for Hono
 */

import type { MiddlewareHandler, Context, Next } from 'hono'
import type { AuthConfig, AuthContext } from './types'
import { authenticateRequest } from './authenticate'

/**
 * Extend Hono's ContextVariableMap with authContext
 */
declare module 'hono' {
  interface ContextVariableMap {
    authContext: AuthContext
  }
}

/**
 * Create authentication middleware for Hono
 *
 * @param config - Authentication configuration
 * @returns Hono middleware handler
 */
export function authMiddleware(config: AuthConfig): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const result = await authenticateRequest(c.req.raw, config)

    if (!result.success) {
      // Return 401 for authentication failures
      return c.json(
        { error: result.error },
        {
          status: 401,
          headers: { 'WWW-Authenticate': 'Bearer' },
        }
      )
    }

    // Set the auth context on the Hono context
    c.set('authContext', result.context)
    await next()
  }
}

/**
 * Middleware that requires authentication
 * Use after authMiddleware to enforce authentication on specific routes
 *
 * @returns Hono middleware handler
 */
export function requireAuth(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const authContext = c.get('authContext')

    if (!authContext || authContext.type === 'anon') {
      return c.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        {
          status: 401,
          headers: { 'WWW-Authenticate': 'Bearer' },
        }
      )
    }

    await next()
  }
}

/**
 * Middleware that requires admin privileges
 * Use after authMiddleware to enforce admin access on specific routes
 *
 * @returns Hono middleware handler
 */
export function requireAdmin(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const authContext = c.get('authContext')

    // Must be authenticated first
    if (!authContext || authContext.type === 'anon') {
      return c.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        {
          status: 401,
          headers: { 'WWW-Authenticate': 'Bearer' },
        }
      )
    }

    // Must have admin privileges
    if (!authContext.isAdmin) {
      return c.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'Admin privileges required',
          },
        },
        { status: 403 }
      )
    }

    await next()
  }
}

/**
 * Middleware that requires readonly access to be false
 * Use to protect write operations
 *
 * @returns Hono middleware handler
 */
export function requireWrite(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const authContext = c.get('authContext')

    if (!authContext || authContext.readonly) {
      return c.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'Write access required',
          },
        },
        { status: 403 }
      )
    }

    await next()
  }
}

// Re-export auth as alias for backward compatibility
export { authMiddleware as auth }
