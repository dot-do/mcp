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
 * Configuration for bindings available in the sandbox.
 * Bindings can be functions or objects that will be injected into the sandbox.
 */
export type Binding = ((...args: unknown[]) => unknown) | object

/**
 * The scope configuration for the Do tool.
 * Defines what functions and objects are available in the sandbox,
 * along with their TypeScript type definitions.
 */
export interface DoScope {
  /**
   * Bindings to inject into the sandbox.
   * Keys are the names used in the sandbox, values are the functions/objects.
   */
  bindings: Record<string, unknown>

  /**
   * TypeScript .d.ts content describing the bindings.
   * Used by the LLM to generate correctly typed code.
   */
  types: string

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
