/**
 * API Key Authentication Provider
 *
 * Handles API key verification via RPC endpoint.
 */

import type { AuthContext, AuthResult, ApiKeyConfig, AuthError } from './types'

/**
 * API key verification response from RPC endpoint
 */
export interface ApiKeyVerificationResponse {
  /** Whether the key is valid */
  valid: boolean
  /** Key identifier */
  keyId?: string
  /** Human-readable key name */
  name?: string
  /** Permissions granted to this key */
  permissions?: string[]
  /** Owner user ID */
  ownerId?: string
  /** Creation timestamp */
  createdAt?: string
  /** Error message if invalid */
  error?: string
}

/**
 * API key provider interface
 */
export interface ApiKeyProvider {
  /** Verify an API key and return the auth result */
  verify(apiKey: string): Promise<AuthResult>
}

/**
 * Verify an API key via RPC endpoint
 *
 * @param apiKey - The API key to verify
 * @param config - API key configuration with verify URL
 * @returns The verification response
 * @throws Error if verification fails
 */
export async function verifyApiKey(
  apiKey: string,
  config: ApiKeyConfig
): Promise<ApiKeyVerificationResponse> {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    method: 'verifyApiKey',
    params: { key: apiKey },
    id: Date.now(),
  })

  const response = await fetch(config.verifyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body,
  })

  if (!response.ok) {
    throw new Error(
      `API key verification failed: ${response.status} ${response.statusText}`
    )
  }

  const data = await response.json()
  return data as ApiKeyVerificationResponse
}

/**
 * Check if permissions include write access
 */
function hasWritePermission(permissions?: string[]): boolean {
  if (!permissions) return false
  return permissions.some(
    (p) => p === 'write' || p === 'admin' || p.endsWith(':write')
  )
}

/**
 * Check if permissions include admin access
 */
function hasAdminPermission(permissions?: string[]): boolean {
  if (!permissions) return false
  return permissions.some((p) => p === 'admin' || p.endsWith(':admin'))
}

/**
 * Create an AuthContext from an API key verification response
 *
 * @param response - The verification response
 * @returns An AuthContext for the API key
 */
export function createApiKeyContext(
  response: ApiKeyVerificationResponse
): AuthContext {
  const readonly = !hasWritePermission(response.permissions)
  const isAdmin = hasAdminPermission(response.permissions) || undefined

  // Build metadata from verification response
  const metadata: Record<string, unknown> = {}
  if (response.name) metadata.name = response.name
  if (response.permissions) metadata.permissions = response.permissions
  if (response.ownerId) metadata.ownerId = response.ownerId
  if (response.createdAt) metadata.createdAt = response.createdAt

  return {
    type: 'apikey',
    id: response.keyId ?? 'unknown',
    readonly,
    ...(isAdmin !== undefined && { isAdmin }),
    ...(Object.keys(metadata).length > 0 && { metadata }),
  }
}

/**
 * Create an API key authentication provider
 *
 * @param config - API key configuration
 * @returns API key provider instance
 */
export function createApiKeyProvider(config: ApiKeyConfig): ApiKeyProvider {
  return {
    async verify(apiKey: string): Promise<AuthResult> {
      try {
        const response = await verifyApiKey(apiKey, config)

        if (!response.valid) {
          return {
            success: false,
            error: {
              code: 'INVALID_API_KEY',
              message: response.error ?? 'API key is not valid',
            },
          }
        }

        const context = createApiKeyContext(response)
        return { success: true, context }
      } catch (error) {
        const authError: AuthError = {
          code: 'VERIFICATION_ERROR',
          message:
            error instanceof Error ? error.message : 'API key verification error',
        }
        return { success: false, error: authError }
      }
    },
  }
}

/**
 * Create a local API key provider that validates against a set of known keys
 * Useful for testing and development
 *
 * @param validKeys - Map of API keys to their configurations
 * @returns API key provider instance
 */
export function createLocalApiKeyProvider(
  validKeys: Map<
    string,
    { keyId: string; name?: string; permissions?: string[]; ownerId?: string }
  >
): ApiKeyProvider {
  return {
    async verify(apiKey: string): Promise<AuthResult> {
      const keyConfig = validKeys.get(apiKey)

      if (!keyConfig) {
        return {
          success: false,
          error: {
            code: 'INVALID_API_KEY',
            message: 'API key not found',
          },
        }
      }

      const response: ApiKeyVerificationResponse = {
        valid: true,
        keyId: keyConfig.keyId,
        name: keyConfig.name,
        permissions: keyConfig.permissions,
        ownerId: keyConfig.ownerId,
      }

      const context = createApiKeyContext(response)
      return { success: true, context }
    },
  }
}
