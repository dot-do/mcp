/**
 * Wrangler Configuration Tests
 *
 * Tests for the Cloudflare Worker configuration.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const rootDir = join(__dirname, '../..')
const wranglerPath = join(rootDir, 'wrangler.jsonc')

// Helper to parse JSONC (JSON with comments)
function parseJsonc(content: string): any {
  // Remove single-line comments (only at start of line or after whitespace, not in strings)
  // This approach: remove comments line by line, being careful about strings
  let result = ''
  let inString = false
  let escape = false

  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    const nextChar = content[i + 1]

    if (escape) {
      result += char
      escape = false
      continue
    }

    if (char === '\\' && inString) {
      result += char
      escape = true
      continue
    }

    if (char === '"' && !escape) {
      inString = !inString
      result += char
      continue
    }

    // Check for single-line comment outside of string
    if (!inString && char === '/' && nextChar === '/') {
      // Skip until end of line
      while (i < content.length && content[i] !== '\n') {
        i++
      }
      result += '\n'
      continue
    }

    // Check for multi-line comment outside of string
    if (!inString && char === '/' && nextChar === '*') {
      i += 2
      while (i < content.length && !(content[i] === '*' && content[i + 1] === '/')) {
        i++
      }
      i++ // skip the closing */
      continue
    }

    result += char
  }

  return JSON.parse(result)
}

describe('Wrangler Configuration', () => {
  describe('File Structure', () => {
    it('should have wrangler.jsonc in project root', () => {
      expect(existsSync(wranglerPath)).toBe(true)
    })

    it('should be valid JSONC format', () => {
      const content = readFileSync(wranglerPath, 'utf-8')
      expect(() => parseJsonc(content)).not.toThrow()
    })
  })

  describe('Basic Configuration', () => {
    let config: any

    beforeAll(() => {
      const content = readFileSync(wranglerPath, 'utf-8')
      config = parseJsonc(content)
    })

    it('should have worker name set to "mcp"', () => {
      expect(config.name).toBe('mcp')
    })

    it('should point main to worker entry point', () => {
      expect(config.main).toBe('src/worker/index.ts')
    })

    it('should have a compatibility_date', () => {
      expect(config.compatibility_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should have account_id configured', () => {
      expect(config.account_id).toBeDefined()
    })
  })

  describe('Environment Variables', () => {
    let config: any

    beforeAll(() => {
      const content = readFileSync(wranglerPath, 'utf-8')
      config = parseJsonc(content)
    })

    it('should have vars section', () => {
      expect(config.vars).toBeDefined()
    })

    it('should have MODE variable', () => {
      expect(config.vars.MODE).toBeDefined()
    })

    it('should have ISSUER variable', () => {
      expect(config.vars.ISSUER).toBeDefined()
    })
  })

  describe('Environment Configurations', () => {
    let config: any

    beforeAll(() => {
      const content = readFileSync(wranglerPath, 'utf-8')
      config = parseJsonc(content)
    })

    it('should have test environment', () => {
      expect(config.env?.test).toBeDefined()
      expect(config.env?.test?.vars?.MODE).toBe('test')
    })

    it('should have dev environment', () => {
      expect(config.env?.dev).toBeDefined()
      expect(config.env?.dev?.vars?.MODE).toBe('dev')
    })

    it('should have production environment', () => {
      expect(config.env?.production).toBeDefined()
      expect(config.env?.production?.vars?.MODE).toBe('production')
    })

    it('should have custom domains configured', () => {
      expect(config.env?.test?.routes?.[0]?.pattern).toBe('test.mcp.do')
      expect(config.env?.dev?.routes?.[0]?.pattern).toBe('dev.mcp.do')
      expect(config.env?.production?.routes?.[0]?.pattern).toBe('mcp.do')
    })
  })

  describe('Optional Features', () => {
    let config: any

    beforeAll(() => {
      const content = readFileSync(wranglerPath, 'utf-8')
      config = parseJsonc(content)
    })

    it('should have nodejs_compat flag', () => {
      expect(config.compatibility_flags).toContain('nodejs_compat')
    })

    it('should have observability enabled', () => {
      expect(config.observability?.enabled).toBe(true)
    })
  })

  describe('Development Configuration', () => {
    let config: any

    beforeAll(() => {
      const content = readFileSync(wranglerPath, 'utf-8')
      config = parseJsonc(content)
    })

    it('should have dev settings', () => {
      expect(config.dev).toBeDefined()
    })

    it('should have dev port configured', () => {
      expect(config.dev?.port).toBe(8787)
    })
  })
})

describe('Wrangler Types', () => {
  it('should have wrangler as a dev dependency', () => {
    const pkgPath = join(rootDir, 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    expect(pkg.devDependencies).toHaveProperty('wrangler')
  })

  it('should have @cloudflare/workers-types as a dev dependency', () => {
    const pkgPath = join(rootDir, 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    expect(pkg.devDependencies).toHaveProperty('@cloudflare/workers-types')
  })
})
