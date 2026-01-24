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
} from './types'
export { detectTokenType, ANONYMOUS_CONTEXT } from './types'

// Anonymous auth
export { createAnonymousContext, isAnonymous } from './anonymous'
export type { AnonymousContextOptions } from './anonymous'

// OAuth
export { introspectToken, createOAuthContext, createOAuthProvider } from './oauth'
export type { IntrospectionResponse, OAuthProvider } from './oauth'

// API Key
export { verifyApiKey, createApiKeyContext, createApiKeyProvider, createLocalApiKeyProvider } from './apikey'
export type { ApiKeyVerificationResponse, ApiKeyProvider } from './apikey'

// Authentication
export { authenticateRequest } from './authenticate'

// Middleware
export { authMiddleware, auth, requireAuth, requireAdmin, requireWrite } from './middleware'

// Cache
export { createTokenCache, CachedAuthenticator } from './cache'
export type { TokenCache, CacheOptions, CacheStats } from './cache'
