import type { DoScope } from './types.js'

/**
 * Result of scope validation
 */
export interface ValidationResult {
  /** Whether the scope is valid (no errors) */
  valid: boolean
  /** List of validation errors */
  errors: string[]
  /** List of validation warnings */
  warnings: string[]
}

/**
 * Check if a value is a valid binding (function or object)
 */
function isValidBinding(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false
  }
  return typeof value === 'function' || typeof value === 'object'
}

/**
 * Check for circular references in an object
 */
function hasCircularReference(obj: unknown, seen = new WeakSet<object>()): boolean {
  if (obj === null || typeof obj !== 'object') {
    return false
  }

  if (typeof obj === 'function') {
    return false
  }

  if (seen.has(obj as object)) {
    return true
  }

  seen.add(obj as object)

  for (const value of Object.values(obj as Record<string, unknown>)) {
    if (hasCircularReference(value, seen)) {
      return true
    }
  }

  return false
}

/**
 * Validate a DoScope configuration.
 *
 * Checks:
 * - All bindings are functions or objects
 * - Types string is not empty (warning if empty)
 * - No circular references in object bindings
 *
 * @param scope - The DoScope to validate
 * @returns ValidationResult with errors and warnings
 *
 * @example
 * ```ts
 * const result = validateScope({
 *   bindings: { greet: (name) => `Hello, ${name}!` },
 *   types: 'declare function greet(name: string): string;'
 * })
 * if (!result.valid) {
 *   console.error(result.errors)
 * }
 * ```
 */
export function validateScope(scope: DoScope): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate bindings
  for (const [name, value] of Object.entries(scope.bindings)) {
    if (!isValidBinding(value)) {
      const valueType = value === null ? 'null' : typeof value
      errors.push(
        `Invalid binding "${name}": expected function or object, got ${valueType}`
      )
    }

    // Check for circular references in object bindings
    if (typeof value === 'object' && value !== null) {
      if (hasCircularReference(value)) {
        warnings.push(
          `Binding "${name}" contains circular reference, which may cause issues during serialization`
        )
      }
    }
  }

  // Validate types
  if (!scope.types || scope.types.trim() === '') {
    warnings.push(
      'The types string is empty. Consider providing TypeScript type definitions for better LLM code generation.'
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
