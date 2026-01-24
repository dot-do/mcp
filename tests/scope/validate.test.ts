import { describe, it, expect, vi } from 'vitest'
import { validateScope, type ValidationResult } from '../../src/scope/validate'
import type { DoScope } from '../../src/scope/types'

describe('validateScope', () => {
  describe('binding validation', () => {
    it('should accept valid function bindings', () => {
      const scope: DoScope = {
        bindings: {
          greet: (name: string) => `Hello, ${name}!`,
          add: (a: number, b: number) => a + b,
        },
        types: 'declare function greet(name: string): string;',
      }

      const result = validateScope(scope)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should accept valid object bindings', () => {
      const scope: DoScope = {
        bindings: {
          math: {
            add: (a: number, b: number) => a + b,
          },
          config: {
            timeout: 5000,
            name: 'test',
          },
        },
        types: 'declare const math: { add: (a: number, b: number) => number };',
      }

      const result = validateScope(scope)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject primitive bindings (string)', () => {
      const scope: DoScope = {
        bindings: {
          invalidString: 'just a string' as unknown,
        },
        types: '',
      }

      const result = validateScope(scope)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('invalidString')
    })

    it('should reject primitive bindings (number)', () => {
      const scope: DoScope = {
        bindings: {
          invalidNumber: 42 as unknown,
        },
        types: '',
      }

      const result = validateScope(scope)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('invalidNumber')
    })

    it('should reject null bindings', () => {
      const scope: DoScope = {
        bindings: {
          nullBinding: null as unknown,
        },
        types: '',
      }

      const result = validateScope(scope)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('nullBinding')
    })

    it('should reject undefined bindings', () => {
      const scope: DoScope = {
        bindings: {
          undefinedBinding: undefined as unknown,
        },
        types: '',
      }

      const result = validateScope(scope)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('undefinedBinding')
    })
  })

  describe('types validation', () => {
    it('should warn if types string is empty', () => {
      const scope: DoScope = {
        bindings: {
          greet: (name: string) => `Hello, ${name}!`,
        },
        types: '',
      }

      const result = validateScope(scope)

      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toContain('types')
    })

    it('should not warn if types string is provided', () => {
      const scope: DoScope = {
        bindings: {
          greet: (name: string) => `Hello, ${name}!`,
        },
        types: 'declare function greet(name: string): string;',
      }

      const result = validateScope(scope)

      expect(result.warnings).toHaveLength(0)
    })

    it('should warn if types string is only whitespace', () => {
      const scope: DoScope = {
        bindings: {
          greet: (name: string) => `Hello, ${name}!`,
        },
        types: '   \n\t  ',
      }

      const result = validateScope(scope)

      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })

  describe('potential issues detection', () => {
    it('should detect circular references in objects', () => {
      const circular: Record<string, unknown> = { name: 'test' }
      circular.self = circular

      const scope: DoScope = {
        bindings: {
          obj: circular,
        },
        types: 'declare const obj: { name: string };',
      }

      const result = validateScope(scope)

      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings.some((w) => w.toLowerCase().includes('circular'))).toBe(true)
    })

    it('should not falsely detect circular references in normal objects', () => {
      const scope: DoScope = {
        bindings: {
          math: {
            add: (a: number, b: number) => a + b,
            nested: {
              multiply: (a: number, b: number) => a * b,
            },
          },
        },
        types: 'declare const math: { add: Function; nested: { multiply: Function } };',
      }

      const result = validateScope(scope)

      expect(result.warnings.filter((w) => w.toLowerCase().includes('circular'))).toHaveLength(0)
    })
  })

  describe('validation result structure', () => {
    it('should return ValidationResult with valid, errors, and warnings', () => {
      const scope: DoScope = {
        bindings: {},
        types: '',
      }

      const result = validateScope(scope)

      expect(result).toHaveProperty('valid')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('warnings')
      expect(typeof result.valid).toBe('boolean')
      expect(Array.isArray(result.errors)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
    })

    it('should be valid with no bindings and empty types (with warning)', () => {
      const scope: DoScope = {
        bindings: {},
        types: '',
      }

      const result = validateScope(scope)

      // Empty bindings with empty types is technically valid, just with a warning
      expect(result.valid).toBe(true)
    })
  })
})
