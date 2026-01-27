/**
 * Permissions for the scope's sandbox environment.
 */
export interface DoPermissions {
  /** Whether network access is allowed in the sandbox */
  allowNetwork?: boolean
  /** List of allowed hosts for network requests */
  allowedHosts?: string[]
}

/**
 * The scope configuration for the Do tool.
 * Defines what functions and objects are available in the sandbox,
 * along with their TypeScript type definitions.
 */
export interface DoScope {
  /**
   * Service bindings to pass to the sandbox worker.
   * These are passed via the worker_loaders env and support Workers RPC.
   * Keys become properties on env in the sandbox (e.g., env.COLLECTIONS).
   *
   * @example
   * ```ts
   * bindings: {
   *   COLLECTIONS: env.COLLECTIONS  // Service binding with RPC methods
   * }
   * ```
   */
  bindings: Record<string, unknown>

  /**
   * TypeScript .d.ts content describing the bindings.
   * Used by the LLM to generate correctly typed code.
   */
  types: string

  /**
   * Module code that defines exports available to the script.
   * Exports become globals in the script scope.
   * Example: `exports.collection = (name) => ({ list: () => fetch('...') })`
   */
  module?: string

  /** Optional execution timeout in milliseconds */
  timeout?: number

  /** Optional permissions for the sandbox environment */
  permissions?: DoPermissions
}

/**
 * Configuration options for creating a scope.
 */
export interface ScopeConfig {
  /** Bindings to include in the scope */
  bindings: Record<string, unknown>
  /** Optional custom type definitions (auto-generated if not provided) */
  types?: string
  /** Optional execution timeout */
  timeout?: number
  /** Optional permissions */
  permissions?: DoPermissions
}
