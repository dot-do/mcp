import type { DoScope } from './types'
import { generateTypes } from './generate-types'
import { validateScope } from './validate'

/**
 * Error thrown when scope validation fails
 */
export class ScopeValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: string[]
  ) {
    super(message)
    this.name = 'ScopeValidationError'
  }
}

/**
 * Create a DoScope from bindings.
 *
 * This helper:
 * 1. Auto-generates TypeScript types if not provided
 * 2. Validates the scope configuration
 * 3. Returns a valid DoScope
 *
 * @param bindings - Record of binding names to functions or objects
 * @param types - Optional custom TypeScript type definitions
 * @returns A valid DoScope
 * @throws ScopeValidationError if validation fails
 *
 * @example
 * ```ts
 * const scope = createScope({
 *   greet: (name: string) => `Hello, ${name}!`,
 *   math: {
 *     add: (a: number, b: number) => a + b,
 *   },
 * })
 *
 * // Or with custom types
 * const scopeWithTypes = createScope(
 *   { greet: (name: string) => `Hello, ${name}!` },
 *   'declare function greet(name: string): string;'
 * )
 * ```
 */
export function createScope(
  bindings: Record<string, unknown>,
  types?: string
): DoScope {
  // Generate types if not provided
  const generatedTypes = types ?? generateTypes(bindings)

  // Create the scope object
  const scope: DoScope = {
    bindings,
    types: generatedTypes,
  }

  // Validate the scope
  const validationResult = validateScope(scope)

  if (!validationResult.valid) {
    throw new ScopeValidationError(
      `Invalid scope configuration: ${validationResult.errors.join(', ')}`,
      validationResult.errors
    )
  }

  return scope
}
