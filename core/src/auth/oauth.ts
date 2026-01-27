/**
 * OAuth 2.0 Token Introspection for MCP Server
 * Implements RFC 7662 - OAuth 2.0 Token Introspection
 */

import type { AuthContext, AuthResult, OAuthConfig, AuthError } from './types.js'

/**
 * OAuth 2.0 Token Introspection Response
 * Based on RFC 7662
 */
export interface IntrospectionResponse {
  /** Whether the token is active */
  active: boolean
  /** Subject - usually the user ID */
  sub?: string
  /** Client ID that requested the token */
  client_id?: string
  /** Space-separated list of scopes */
  scope?: string
  /** Token expiration timestamp (Unix seconds) */
  exp?: number
  /** Token issued at timestamp (Unix seconds) */
  iat?: number
  /** Token not before timestamp (Unix seconds) */
  nbf?: number
  /** Issuer */
  iss?: string
  /** Audience */
  aud?: string | string[]
  /** Token type hint */
  token_type?: string
  /** Additional claims */
  [key: string]: unknown
}

/**
 * OAuth authentication provider interface
 */
export interface OAuthProvider {
  /** Verify an access token and return the auth result */
  verify(token: string): Promise<AuthResult>
}

/**
 * Perform OAuth 2.0 token introspection
 *
 * Uses Workers RPC if service binding is provided, falls back to HTTP.
 *
 * @param token - The token to introspect
 * @param config - OAuth configuration with service binding or introspection URL
 * @returns The introspection response
 * @throws Error if introspection fails
 */
export async function introspectToken(
  token: string,
  config: OAuthConfig
): Promise<IntrospectionResponse> {
  // Prefer Workers RPC via service binding
  if (config.service) {
    try {
      const result = await config.service.introspect(token)
      return result as IntrospectionResponse
    } catch (error) {
      throw new Error(
        `RPC introspection failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // Fallback to HTTP introspection
  if (!config.introspectionUrl) {
    throw new Error('OAuth config requires either service binding or introspectionUrl')
  }

  const body = new URLSearchParams()
  body.set('token', token)

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  }

  // Add client authentication if provided (Basic auth)
  if (config.clientId && config.clientSecret) {
    const credentials = btoa(`${config.clientId}:${config.clientSecret}`)
    headers['Authorization'] = `Basic ${credentials}`
  }

  const response = await fetch(config.introspectionUrl, {
    method: 'POST',
    headers,
    body,
  })

  if (!response.ok) {
    throw new Error(
      `Introspection failed: ${response.status} ${response.statusText}`
    )
  }

  const data = await response.json()
  return data as IntrospectionResponse
}

/**
 * Parse scope string to check for specific scopes
 */
function parseScopes(scope?: string): Set<string> {
  if (!scope) return new Set()
  return new Set(scope.split(' ').filter(Boolean))
}

/**
 * Determine if context should be readonly based on scopes
 * Readonly if only has 'read' scope and no write/admin scopes
 */
function isReadonlyScope(scopes: Set<string>): boolean {
  // If has write, admin, or any *:write scope, not readonly
  if (scopes.has('write') || scopes.has('admin')) {
    return false
  }
  // Check for any scope ending in :write
  for (const scope of scopes) {
    if (scope.endsWith(':write') || scope.endsWith(':admin')) {
      return false
    }
  }
  // Default to readonly if no write permissions found
  return true
}

/**
 * Check if scopes include admin access
 */
function hasAdminScope(scopes: Set<string>): boolean {
  if (scopes.has('admin')) return true
  // Check for any scope ending in :admin
  for (const scope of scopes) {
    if (scope.endsWith(':admin')) {
      return true
    }
  }
  return false
}

/**
 * Create an AuthContext from an OAuth introspection response
 *
 * @param response - The introspection response
 * @returns An AuthContext for the authenticated user
 */
export function createOAuthContext(
  response: IntrospectionResponse
): AuthContext {
  const scopes = parseScopes(response.scope)
  const readonly = isReadonlyScope(scopes)
  const isAdmin = hasAdminScope(scopes) || undefined

  // Use sub, then client_id, then 'unknown' for the ID
  const id = response.sub ?? response.client_id ?? 'unknown'

  // Build metadata from relevant introspection claims
  const metadata: Record<string, unknown> = {}
  if (response.scope) metadata.scope = response.scope
  if (response.exp) metadata.exp = response.exp
  if (response.iat) metadata.iat = response.iat
  if (response.client_id) metadata.client_id = response.client_id
  if (response.iss) metadata.iss = response.iss
  if (response.aud) metadata.aud = response.aud

  return {
    type: 'oauth',
    id,
    readonly,
    ...(isAdmin !== undefined && { isAdmin }),
    ...(Object.keys(metadata).length > 0 && { metadata }),
  }
}

/**
 * Create an OAuth authentication provider
 *
 * @param config - OAuth configuration
 * @returns OAuth provider instance
 */
export function createOAuthProvider(config: OAuthConfig): OAuthProvider {
  return {
    async verify(token: string): Promise<AuthResult> {
      try {
        const response = await introspectToken(token, config)

        if (!response.active) {
          return {
            success: false,
            error: {
              code: 'INVALID_TOKEN',
              message: 'Token is not active',
            },
          }
        }

        const context = createOAuthContext(response)
        return { success: true, context }
      } catch (error) {
        const authError: AuthError = {
          code: 'INTROSPECTION_ERROR',
          message:
            error instanceof Error ? error.message : 'Token introspection failed',
        }
        return { success: false, error: authError }
      }
    },
  }
}
