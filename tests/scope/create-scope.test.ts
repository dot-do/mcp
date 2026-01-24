import { describe, it, expect } from 'vitest'
import { createScope } from '../../src/scope/create-scope'
import type { DoScope } from '../../src/scope/types'

describe('createScope', () => {
  it('should create a DoScope with bindings and auto-generated types', () => {
    const bindings = {
      greet: (name: string) => `Hello, ${name}!`,
    }

    const scope = createScope(bindings)

    expect(scope.bindings).toBe(bindings)
    expect(scope.types).toContain('declare function greet')
  })

  it('should use provided types instead of generating them', () => {
    const bindings = {
      greet: (name: string) => `Hello, ${name}!`,
    }
    const customTypes = 'declare function greet(name: string): string;'

    const scope = createScope(bindings, customTypes)

    expect(scope.types).toBe(customTypes)
  })

  it('should validate the scope and throw on invalid bindings', () => {
    const bindings = {
      invalidBinding: 'not a function or object' as unknown,
    }

    expect(() => createScope(bindings)).toThrow()
  })

  it('should include all valid bindings in the returned scope', () => {
    const bindings = {
      greet: (name: string) => `Hello, ${name}!`,
      math: {
        add: (a: number, b: number) => a + b,
      },
    }

    const scope = createScope(bindings)

    expect(scope.bindings.greet).toBe(bindings.greet)
    expect(scope.bindings.math).toBe(bindings.math)
  })

  it('should return a valid DoScope type', () => {
    const bindings = {
      test: () => 'test',
    }

    const scope: DoScope = createScope(bindings)

    expect(scope).toHaveProperty('bindings')
    expect(scope).toHaveProperty('types')
  })

  it('should handle empty bindings', () => {
    const scope = createScope({})

    expect(scope.bindings).toEqual({})
    expect(scope.types).toBe('')
  })

  it('should work with async functions', () => {
    const bindings = {
      fetchData: async (url: string) => {
        return { data: url }
      },
    }

    const scope = createScope(bindings)

    expect(scope.types).toContain('Promise')
  })

  it('should work with complex nested objects', () => {
    const bindings = {
      utils: {
        string: {
          uppercase: (s: string) => s.toUpperCase(),
        },
        number: {
          double: (n: number) => n * 2,
        },
      },
    }

    const scope = createScope(bindings)

    expect(scope.types).toContain('utils')
    expect(scope.types).toContain('string')
    expect(scope.types).toContain('uppercase')
  })

  it('should handle object bindings with primitive values', () => {
    const bindings = {
      config: {
        timeout: 5000,
        name: 'test',
        enabled: true,
      },
    }

    const scope = createScope(bindings)

    expect(scope.types).toContain('config')
    expect(scope.types).toContain('timeout')
  })
})
