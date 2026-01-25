/**
 * Scope Validation Tests
 */

import { describe, it, expect } from 'vitest'
import { validateScope, type ValidationResult } from './validate.js'
import type { DoScope } from './types.js'

describe('Scope Validation', () => {
  describe('validateScope', () => {
    it('should validate a valid scope with function bindings', () => {
      const scope: DoScope = {
        bindings: {
          greet: (name: string) => `Hello, ${name}!`,
          add: (a: number, b: number) => a + b,
        },
        types: `declare function greet(name: string): string;
                declare function add(a: number, b: number): number;`,
      }

      const result = validateScope(scope)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate a valid scope with object bindings', () => {
      const scope: DoScope = {
        bindings: {
          math: {
            add: (a: number, b: number) => a + b,
            multiply: (a: number, b: number) => a * b,
          },
        },
        types: 'declare const math: { add: (a: number, b: number) => number };',
      }

      const result = validateScope(scope)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject null binding values', () => {
      const scope: DoScope = {
        bindings: {
          validFn: () => {},
          nullBinding: null as any,
        },
        types: '',
      }

      const result = validateScope(scope)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        'Invalid binding "nullBinding": expected function or object, got null'
      )
    })

    it('should reject undefined binding values', () => {
      const scope: DoScope = {
        bindings: {
          undefinedBinding: undefined as any,
        },
        types: '',
      }

      const result = validateScope(scope)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        'Invalid binding "undefinedBinding": expected function or object, got undefined'
      )
    })

    it('should reject primitive binding values (string)', () => {
      const scope: DoScope = {
        bindings: {
          stringBinding: 'hello' as any,
        },
        types: '',
      }

      const result = validateScope(scope)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        'Invalid binding "stringBinding": expected function or object, got string'
      )
    })

    it('should reject primitive binding values (number)', () => {
      const scope: DoScope = {
        bindings: {
          numberBinding: 42 as any,
        },
        types: '',
      }

      const result = validateScope(scope)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        'Invalid binding "numberBinding": expected function or object, got number'
      )
    })

    it('should reject primitive binding values (boolean)', () => {
      const scope: DoScope = {
        bindings: {
          boolBinding: true as any,
        },
        types: '',
      }

      const result = validateScope(scope)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        'Invalid binding "boolBinding": expected function or object, got boolean'
      )
    })

    it('should warn about empty types string', () => {
      const scope: DoScope = {
        bindings: {
          fn: () => {},
        },
        types: '',
      }

      const result = validateScope(scope)

      expect(result.valid).toBe(true) // Still valid, just a warning
      expect(result.warnings).toContain(
        'The types string is empty. Consider providing TypeScript type definitions for better LLM code generation.'
      )
    })

    it('should warn about whitespace-only types string', () => {
      const scope: DoScope = {
        bindings: {
          fn: () => {},
        },
        types: '   \n\t  ',
      }

      const result = validateScope(scope)

      expect(result.valid).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('should warn about circular references', () => {
      const circular: Record<string, unknown> = { name: 'test' }
      circular.self = circular

      const scope: DoScope = {
        bindings: {
          circular,
        },
        types: 'declare const circular: any;',
      }

      const result = validateScope(scope)

      expect(result.valid).toBe(true) // Circular refs are just a warning
      expect(result.warnings.some((w) => w.includes('circular reference'))).toBe(true)
    })

    it('should detect deeply nested circular references', () => {
      const obj: Record<string, unknown> = {
        nested: {
          deeper: {
            deepest: {},
          },
        },
      }
      ;(obj.nested as any).deeper.deepest.backToTop = obj

      const scope: DoScope = {
        bindings: { obj },
        types: '',
      }

      const result = validateScope(scope)

      expect(result.warnings.some((w) => w.includes('circular reference'))).toBe(true)
    })

    it('should not warn about circular refs in functions', () => {
      // Functions themselves aren't checked for circular refs
      const scope: DoScope = {
        bindings: {
          fn: () => 'result',
        },
        types: 'declare function fn(): string;',
      }

      const result = validateScope(scope)

      expect(result.warnings.filter((w) => w.includes('circular'))).toHaveLength(0)
    })

    it('should handle multiple errors', () => {
      const scope: DoScope = {
        bindings: {
          good: () => {},
          bad1: null as any,
          bad2: undefined as any,
          bad3: 'string' as any,
        },
        types: '',
      }

      const result = validateScope(scope)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(3)
    })

    it('should handle empty bindings', () => {
      const scope: DoScope = {
        bindings: {},
        types: '',
      }

      const result = validateScope(scope)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should allow array binding values', () => {
      // Arrays are objects, so they should be valid
      const scope: DoScope = {
        bindings: {
          arr: [1, 2, 3],
        },
        types: 'declare const arr: number[];',
      }

      const result = validateScope(scope)

      expect(result.valid).toBe(true)
    })
  })
})
