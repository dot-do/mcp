import { describe, it, expect } from 'vitest'
import type { DoScope, DoPermissions } from '../../src/scope/types'

describe('DoScope interface', () => {
  it('should have bindings property as Record<string, unknown>', () => {
    const scope: DoScope = {
      bindings: {
        greet: (name: string) => `Hello, ${name}!`,
        calculate: (a: number, b: number) => a + b,
      },
      types: '',
    }

    expect(scope.bindings).toBeDefined()
    expect(typeof scope.bindings).toBe('object')
    expect(typeof scope.bindings.greet).toBe('function')
    expect(typeof scope.bindings.calculate).toBe('function')
  })

  it('should have types property as string containing TypeScript definitions', () => {
    const scope: DoScope = {
      bindings: {},
      types: 'declare function greet(name: string): string;',
    }

    expect(scope.types).toBeDefined()
    expect(typeof scope.types).toBe('string')
    expect(scope.types).toContain('declare')
  })

  it('should have optional timeout property', () => {
    const scopeWithTimeout: DoScope = {
      bindings: {},
      types: '',
      timeout: 5000,
    }

    const scopeWithoutTimeout: DoScope = {
      bindings: {},
      types: '',
    }

    expect(scopeWithTimeout.timeout).toBe(5000)
    expect(scopeWithoutTimeout.timeout).toBeUndefined()
  })

  it('should have optional permissions property', () => {
    const scopeWithPermissions: DoScope = {
      bindings: {},
      types: '',
      permissions: {
        allowNetwork: true,
        allowedHosts: ['api.example.com'],
      },
    }

    const scopeWithoutPermissions: DoScope = {
      bindings: {},
      types: '',
    }

    expect(scopeWithPermissions.permissions).toBeDefined()
    expect(scopeWithPermissions.permissions?.allowNetwork).toBe(true)
    expect(scopeWithPermissions.permissions?.allowedHosts).toContain('api.example.com')
    expect(scopeWithoutPermissions.permissions).toBeUndefined()
  })
})

describe('DoPermissions interface', () => {
  it('should have optional allowNetwork boolean', () => {
    const permissions: DoPermissions = {
      allowNetwork: true,
    }

    expect(permissions.allowNetwork).toBe(true)
  })

  it('should have optional allowedHosts string array', () => {
    const permissions: DoPermissions = {
      allowedHosts: ['example.com', 'api.example.com'],
    }

    expect(permissions.allowedHosts).toEqual(['example.com', 'api.example.com'])
  })

  it('should allow empty permissions object', () => {
    const permissions: DoPermissions = {}

    expect(permissions.allowNetwork).toBeUndefined()
    expect(permissions.allowedHosts).toBeUndefined()
  })
})
