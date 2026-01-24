/**
 * Authentication Types for MCP Server
 */

/**
 * Authentication modes supported by the server
 * - anon: Anonymous access only (readonly)
 * - anon+auth: Both anonymous and authenticated access
 * - auth-required: Authentication required for all access
 */
export type AuthMode = 'anon' | 'anon+auth' | 'auth-required'

/**
 * Token type for authenticated requests
 */
export type TokenType = 'bearer' | 'api-key'

/**
 * Authentication context attached to requests
 */
export interface AuthContext {
  /** Whether the user is authenticated */
  authenticated: boolean
  /** Whether the context allows readonly operations only */
  readonly: boolean
  /** Subject identifier (user ID, API key name, etc.) */
  subject?: string
  /** Scopes/permissions granted */
  scopes?: string[]
  /** Token type used for authentication */
  tokenType?: TokenType
  /** Token expiration timestamp (ms since epoch) */
  expiresAt?: number
  /** Additional claims from the token */
  claims?: Record<string, unknown>
}

/**
 * Anonymous auth context (readonly access)
 */
export const ANONYMOUS_CONTEXT: AuthContext = {
  authenticated: false,
  readonly: true,
}

/**
 * Configuration for authentication
 */
export interface AuthConfig {
  /** Authentication mode */
  mode: AuthMode
  /** OAuth introspection endpoint */
  introspectionEndpoint?: string
  /** API key verification endpoint */
  apiKeyEndpoint?: string
  /** JWT public key or JWKS URL for local validation */
  jwtPublicKey?: string
  /** Allowed issuers for JWT validation */
  allowedIssuers?: string[]
  /** Allowed audiences for JWT validation */
  allowedAudiences?: string[]
}
