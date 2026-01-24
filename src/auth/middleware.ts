/**
 * Authentication Middleware for Hono
 */

import type { MiddlewareHandler, Context } from 'hono'
import type { AuthContext, AuthMode, AuthConfig } from './types.js'
import { ANONYMOUS_CONTEXT } from './types.js'

/**
 * Extended Hono variables with auth context
 */
declare module 'hono' {
  interface ContextVariableMap {
    authContext: AuthContext
  }
}

/**
 * Extract bearer token from Authorization header
 */
export function extractBearerToken(header: string | null): string | null {
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}

/**
 * Extract API key from X-API-Key header
 */
export function extractApiKey(header: string | null): string | null {
  return header || null
}

/**
 * Verify OAuth token via introspection endpoint
 */
export async function introspectToken(
  token: string,
  endpoint: string
): Promise<AuthContext | null> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `token=${encodeURIComponent(token)}`,
    })

    if (!response.ok) return null

    const data = await response.json() as Record<string, unknown>

    if (!data.active) return null

    return {
      authenticated: true,
      readonly: false,
      subject: data.sub as string | undefined,
      scopes: typeof data.scope === 'string' ? data.scope.split(' ') : undefined,
      tokenType: 'bearer',
      expiresAt: typeof data.exp === 'number' ? data.exp * 1000 : undefined,
      claims: data,
    }
  } catch {
    return null
  }
}

/**
 * Verify API key via endpoint
 */
export async function verifyApiKey(
  apiKey: string,
  endpoint: string
): Promise<AuthContext | null> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey }),
    })

    if (!response.ok) return null

    const data = await response.json() as Record<string, unknown>

    if (!data.valid) return null

    return {
      authenticated: true,
      readonly: data.readonly === true,
      subject: data.name as string | undefined,
      scopes: Array.isArray(data.scopes) ? data.scopes as string[] : undefined,
      tokenType: 'api-key',
    }
  } catch {
    return null
  }
}

/**
 * Authenticate a request based on configuration
 */
export async function authenticateRequest(
  authHeader: string | null,
  apiKeyHeader: string | null,
  config: AuthConfig
): Promise<AuthContext> {
  // Try bearer token first
  const bearerToken = extractBearerToken(authHeader)
  if (bearerToken && config.introspectionEndpoint) {
    const context = await introspectToken(bearerToken, config.introspectionEndpoint)
    if (context) return context
  }

  // Try API key
  const apiKey = extractApiKey(apiKeyHeader)
  if (apiKey && config.apiKeyEndpoint) {
    const context = await verifyApiKey(apiKey, config.apiKeyEndpoint)
    if (context) return context
  }

  // Fall back to anonymous
  return ANONYMOUS_CONTEXT
}

/**
 * Default auth configuration from environment
 */
export function getAuthConfig(env: Record<string, string | undefined>): AuthConfig {
  return {
    mode: (env.AUTH_MODE as AuthMode) || 'anon+auth',
    introspectionEndpoint: env.OAUTH_INTROSPECTION_ENDPOINT,
    apiKeyEndpoint: env.API_KEY_ENDPOINT,
    jwtPublicKey: env.JWT_PUBLIC_KEY,
    allowedIssuers: env.JWT_ALLOWED_ISSUERS?.split(','),
    allowedAudiences: env.JWT_ALLOWED_AUDIENCES?.split(','),
  }
}

/**
 * Auth middleware factory for Hono
 *
 * @param options - Optional configuration overrides
 * @returns Hono middleware handler
 */
export function auth(options?: Partial<AuthConfig>): MiddlewareHandler {
  return async (c, next) => {
    const env = (c.env || {}) as Record<string, string | undefined>
    const config = { ...getAuthConfig(env), ...options }

    const authHeader = c.req.header('Authorization') || null
    const apiKeyHeader = c.req.header('X-API-Key') || null

    const authContext = await authenticateRequest(authHeader, apiKeyHeader, config)

    // Check if auth is required but not authenticated
    if (config.mode === 'auth-required' && !authContext.authenticated) {
      return c.json(
        { error: 'Authentication required' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
      )
    }

    c.set('authContext', authContext)
    await next()
  }
}

/**
 * Middleware that requires authentication
 * Returns 401 if not authenticated
 */
export function requireAuth(): MiddlewareHandler {
  return async (c, next) => {
    const authContext = c.get('authContext')

    if (!authContext?.authenticated) {
      return c.json(
        { error: 'Authentication required' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
      )
    }

    await next()
  }
}

/**
 * Middleware that requires specific scopes
 */
export function requireScopes(...requiredScopes: string[]): MiddlewareHandler {
  return async (c, next) => {
    const authContext = c.get('authContext')

    if (!authContext?.authenticated) {
      return c.json(
        { error: 'Authentication required' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
      )
    }

    const userScopes = authContext.scopes || []
    const hasAllScopes = requiredScopes.every((scope) => userScopes.includes(scope))

    if (!hasAllScopes) {
      return c.json(
        { error: 'Insufficient permissions', required: requiredScopes },
        { status: 403 }
      )
    }

    await next()
  }
}
