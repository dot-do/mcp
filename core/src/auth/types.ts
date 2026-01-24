/**
 * Authentication Types for MCP Server
 */

/**
 * Authentication context attached to requests
 * Represents the identity and permissions of the requester
 */
export interface AuthContext {
  /** Type of authentication used */
  type: 'anon' | 'oauth' | 'apikey'
  /** Unique identifier for the authenticated entity */
  id: string
  /** Whether the context allows readonly operations only */
  readonly: boolean
  /** Whether the user has admin privileges */
  isAdmin?: boolean
  /** The raw access token (for OAuth/API key contexts) */
  token?: string
  /** Additional metadata from the authentication provider */
  metadata?: Record<string, unknown>
}

/**
 * Authentication modes supported by the server
 * - anon: Anonymous access only (readonly)
 * - anon+auth: Both anonymous and authenticated access
 * - auth-required: Authentication required for all access
 */
export type AuthMode = 'anon' | 'anon+auth' | 'auth-required'

/**
 * OAuth configuration for token introspection
 */
export interface OAuthConfig {
  /** URL for OAuth 2.0 token introspection endpoint */
  introspectionUrl: string
  /** Client ID for introspection authentication (optional) */
  clientId?: string
  /** Client secret for introspection authentication (optional) */
  clientSecret?: string
}

/**
 * API key configuration for verification
 */
export interface ApiKeyConfig {
  /** URL for API key verification RPC endpoint */
  verifyUrl: string
}

/**
 * Configuration for authentication
 */
export interface AuthConfig {
  /** Authentication mode */
  mode: AuthMode
  /** OAuth configuration */
  oauth?: OAuthConfig
  /** API key configuration */
  apiKey?: ApiKeyConfig
}

/**
 * Authentication error details
 */
export interface AuthError {
  /** Error code for programmatic handling */
  code: string
  /** Human-readable error message */
  message: string
  /** Additional error details */
  details?: Record<string, unknown>
}

/**
 * Result of authentication attempt - discriminated union
 */
export type AuthResult =
  | { success: true; context: AuthContext }
  | { success: false; error: AuthError }

/**
 * Anonymous auth context (readonly access)
 */
export const ANONYMOUS_CONTEXT: AuthContext = {
  type: 'anon',
  id: 'anonymous',
  readonly: true,
}

/**
 * Token type detected from bearer token format
 */
export type TokenType = 'jwt' | 'api-key-sk' | 'api-key-do' | 'unknown'

/**
 * Detect token type from bearer token string
 */
export function detectTokenType(token: string): TokenType {
  if (token.startsWith('sk_')) {
    return 'api-key-sk'
  }
  if (token.startsWith('do_')) {
    return 'api-key-do'
  }
  // JWT tokens have three base64-encoded parts separated by dots
  if (token.split('.').length === 3) {
    return 'jwt'
  }
  return 'unknown'
}
