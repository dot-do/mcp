/**
 * Multi-mode Request Authentication for MCP Server
 *
 * Supports anonymous, OAuth, and API key authentication modes.
 */

import type { AuthConfig, AuthResult, AuthError } from './types.js'
import { detectTokenType } from './types.js'
import { createAnonymousContext } from './anonymous.js'
import { introspectToken, createOAuthContext } from './oauth.js'
import { verifyApiKey, createApiKeyContext } from './apikey.js'

/**
 * Parse result for Authorization header
 */
type ParsedAuthHeader =
  | { status: 'missing' }
  | { status: 'malformed' }
  | { status: 'valid'; scheme: string; token: string }

/**
 * Parse the Authorization header
 *
 * @param header - The Authorization header value
 * @returns Parse result with status
 */
function parseAuthHeader(header: string | null): ParsedAuthHeader {
  if (!header) return { status: 'missing' }

  const parts = header.split(' ')
  if (parts.length !== 2) return { status: 'malformed' }

  return { status: 'valid', scheme: parts[0], token: parts[1] }
}

/**
 * Create an error result
 */
function errorResult(code: string, message: string): AuthResult {
  return {
    success: false,
    error: { code, message },
  }
}

/**
 * Authenticate a request based on the configuration mode
 *
 * @param request - The incoming request
 * @param config - Authentication configuration
 * @returns AuthResult with context or error
 */
export async function authenticateRequest(
  request: Request,
  config: AuthConfig
): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization')
  const parsed = parseAuthHeader(authHeader)

  // Handle anon mode - always return anonymous context
  if (config.mode === 'anon') {
    return {
      success: true,
      context: createAnonymousContext(),
    }
  }

  // Handle malformed header
  if (parsed.status === 'malformed') {
    return errorResult('INVALID_AUTH_HEADER', 'Malformed Authorization header')
  }

  // No auth header provided
  if (parsed.status === 'missing') {
    // anon+auth mode allows anonymous access
    if (config.mode === 'anon+auth') {
      return {
        success: true,
        context: createAnonymousContext(),
      }
    }

    // auth-required mode requires authentication
    return errorResult('UNAUTHORIZED', 'Authentication required')
  }

  // Validate auth scheme
  if (parsed.scheme.toLowerCase() !== 'bearer') {
    return errorResult(
      'UNSUPPORTED_AUTH_SCHEME',
      `Unsupported authentication scheme: ${parsed.scheme}`
    )
  }

  // Detect token type and route to appropriate handler
  const tokenType = detectTokenType(parsed.token)

  switch (tokenType) {
    case 'jwt':
      return authenticateOAuth(parsed.token, config)

    case 'api-key-sk':
    case 'api-key-do':
      return authenticateApiKey(parsed.token, config)

    case 'unknown':
      // Try OAuth as fallback for unknown token types
      if (config.oauth) {
        return authenticateOAuth(parsed.token, config)
      }
      return errorResult(
        'INVALID_AUTH_HEADER',
        'Unable to determine token type'
      )

    default:
      return errorResult('INVALID_AUTH_HEADER', 'Invalid token format')
  }
}

/**
 * Authenticate via OAuth token introspection
 */
async function authenticateOAuth(
  token: string,
  config: AuthConfig
): Promise<AuthResult> {
  if (!config.oauth) {
    return errorResult('NO_OAUTH_CONFIG', 'OAuth configuration not provided')
  }

  try {
    const response = await introspectToken(token, config.oauth)

    if (!response.active) {
      return errorResult('INVALID_TOKEN', 'Token is not active')
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
}

/**
 * Authenticate via API key verification
 */
async function authenticateApiKey(
  apiKey: string,
  config: AuthConfig
): Promise<AuthResult> {
  if (!config.apiKey) {
    return errorResult('NO_API_KEY_CONFIG', 'API key configuration not provided')
  }

  try {
    const response = await verifyApiKey(apiKey, config.apiKey)

    if (!response.valid) {
      return errorResult(
        'INVALID_API_KEY',
        response.error ?? 'API key is not valid'
      )
    }

    const context = createApiKeyContext(response)
    return { success: true, context }
  } catch (error) {
    const authError: AuthError = {
      code: 'VERIFICATION_ERROR',
      message:
        error instanceof Error ? error.message : 'API key verification failed',
    }
    return { success: false, error: authError }
  }
}
