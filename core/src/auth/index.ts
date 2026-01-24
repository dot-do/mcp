/**
 * Auth module
 *
 * Exports authentication types, providers, and middleware.
 */

// Core types
export type {
  AuthContext,
  AuthMode,
  OAuthConfig,
  ApiKeyConfig,
  AuthConfig,
  AuthError,
  AuthResult,
  TokenType,
} from './types.js'
export { detectTokenType, ANONYMOUS_CONTEXT } from './types.js'

// Anonymous auth
export { createAnonymousContext, isAnonymous } from './anonymous.js'
export type { AnonymousContextOptions } from './anonymous.js'

// OAuth
export { introspectToken, createOAuthContext, createOAuthProvider } from './oauth.js'
export type { IntrospectionResponse, OAuthProvider } from './oauth.js'

// API Key
export { verifyApiKey, createApiKeyContext, createApiKeyProvider, createLocalApiKeyProvider } from './apikey.js'
export type { ApiKeyVerificationResponse, ApiKeyProvider } from './apikey.js'

// Authentication
export { authenticateRequest } from './authenticate.js'

// Middleware
export { authMiddleware, auth, requireAuth, requireAdmin, requireWrite } from './middleware.js'

// Cache
export { createTokenCache, CachedAuthenticator } from './cache.js'
export type { TokenCache, CacheOptions, CacheStats } from './cache.js'
