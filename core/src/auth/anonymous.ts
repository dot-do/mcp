/**
 * Anonymous Authentication for MCP Server
 * Provides readonly access for unauthenticated users
 */

import type { AuthContext } from './types.js'

/**
 * Options for creating an anonymous context
 */
export interface AnonymousContextOptions {
  /** Custom identifier for the anonymous user (default: 'anonymous') */
  id?: string
  /** Additional metadata to attach to the context */
  metadata?: Record<string, unknown>
}

/**
 * Default anonymous context - frozen and immutable
 */
export const ANONYMOUS_CONTEXT: Readonly<AuthContext> = Object.freeze({
  type: 'anon' as const,
  id: 'anonymous',
  readonly: true,
})

/**
 * Create an anonymous authentication context
 * Anonymous contexts are always readonly
 *
 * @param options - Optional configuration for the anonymous context
 * @returns An AuthContext for anonymous access
 */
export function createAnonymousContext(
  options?: AnonymousContextOptions
): AuthContext {
  return {
    type: 'anon',
    id: options?.id ?? 'anonymous',
    readonly: true,
    ...(options?.metadata && { metadata: options.metadata }),
  }
}

/**
 * Check if an AuthContext represents anonymous access
 *
 * @param context - The AuthContext to check
 * @returns true if the context is anonymous
 */
export function isAnonymous(context: AuthContext): boolean {
  return context.type === 'anon'
}
