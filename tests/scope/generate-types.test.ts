import { describe, it, expect } from 'vitest'
import { generateTypes } from '../../src/scope/generate-types'

describe('generateTypes', () => {
  it('should create .d.ts content for simple functions', () => {
    const bindings = {
      greet: function greet(name: string): string {
        return `Hello, ${name}!`
      },
    }

    const types = generateTypes(bindings)

    expect(types).toContain('declare function greet')
    expect(types).toContain(': ')
  })

  it('should handle functions with multiple parameters', () => {
    const bindings = {
      add: function add(a: number, b: number): number {
        return a + b
      },
    }

    const types = generateTypes(bindings)

    expect(types).toContain('declare function add')
  })

  it('should handle async functions with Promise return type', () => {
    const bindings = {
      fetchData: async function fetchData(url: string): Promise<string> {
        return 'data'
      },
    }

    const types = generateTypes(bindings)

    expect(types).toContain('declare function fetchData')
    expect(types).toContain('Promise')
  })

  it('should handle arrow functions', () => {
    const bindings = {
      multiply: (a: number, b: number) => a * b,
    }

    const types = generateTypes(bindings)

    expect(types).toContain('declare function multiply')
  })

  it('should handle object bindings', () => {
    const bindings = {
      math: {
        add: (a: number, b: number) => a + b,
        subtract: (a: number, b: number) => a - b,
      },
    }

    const types = generateTypes(bindings)

    expect(types).toContain('declare const math')
    expect(types).toContain('add')
    expect(types).toContain('subtract')
  })

  it('should handle nested object bindings', () => {
    const bindings = {
      utils: {
        string: {
          uppercase: (s: string) => s.toUpperCase(),
          lowercase: (s: string) => s.toLowerCase(),
        },
        number: {
          double: (n: number) => n * 2,
        },
      },
    }

    const types = generateTypes(bindings)

    expect(types).toContain('declare const utils')
    expect(types).toContain('string')
    expect(types).toContain('number')
    expect(types).toContain('uppercase')
    expect(types).toContain('double')
  })

  it('should handle mixed bindings (functions and objects)', () => {
    const bindings = {
      greet: (name: string) => `Hello, ${name}!`,
      math: {
        add: (a: number, b: number) => a + b,
      },
    }

    const types = generateTypes(bindings)

    expect(types).toContain('declare function greet')
    expect(types).toContain('declare const math')
  })

  it('should return empty string for empty bindings', () => {
    const types = generateTypes({})

    expect(types).toBe('')
  })

  it('should handle functions with no parameters', () => {
    const bindings = {
      getTimestamp: () => Date.now(),
    }

    const types = generateTypes(bindings)

    expect(types).toContain('declare function getTimestamp')
    expect(types).toContain('()')
  })

  it('should use function name from binding key', () => {
    // Anonymous function
    const bindings = {
      myFunction: function () {
        return 42
      },
    }

    const types = generateTypes(bindings)

    expect(types).toContain('declare function myFunction')
  })

  it('should handle primitive object values', () => {
    const bindings = {
      config: {
        timeout: 5000,
        name: 'test',
        enabled: true,
      },
    }

    const types = generateTypes(bindings)

    expect(types).toContain('declare const config')
    expect(types).toContain('timeout')
    expect(types).toContain('name')
    expect(types).toContain('enabled')
  })
})
