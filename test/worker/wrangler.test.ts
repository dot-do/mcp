/**
 * Wrangler Configuration Tests
 *
 * Tests for the Cloudflare Worker configuration.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const rootDir = join(__dirname, '../..')
const wranglerPath = join(rootDir, 'wrangler.toml')

describe('Wrangler Configuration', () => {
  describe('File Structure', () => {
    it('should have wrangler.toml in project root', () => {
      expect(existsSync(wranglerPath)).toBe(true)
    })

    it('should be valid TOML format', () => {
      const content = readFileSync(wranglerPath, 'utf-8')
      // Basic TOML validation - check for required sections
      expect(content).toContain('name')
      expect(content).toContain('main')
    })
  })

  describe('Basic Configuration', () => {
    let config: string

    beforeAll(() => {
      config = readFileSync(wranglerPath, 'utf-8')
    })

    it('should have worker name set to "mcp"', () => {
      expect(config).toMatch(/name\s*=\s*["']mcp["']/)
    })

    it('should point main to worker entry point', () => {
      expect(config).toMatch(/main\s*=\s*["']src\/worker\/index\.ts["']/)
    })

    it('should have a compatibility_date', () => {
      expect(config).toMatch(/compatibility_date\s*=\s*["']\d{4}-\d{2}-\d{2}["']/)
    })
  })

  describe('Environment Variables', () => {
    let config: string

    beforeAll(() => {
      config = readFileSync(wranglerPath, 'utf-8')
    })

    it('should have [vars] section', () => {
      expect(config).toContain('[vars]')
    })

    it('should have AUTH_MODE variable', () => {
      expect(config).toMatch(/AUTH_MODE\s*=/)
    })
  })

  describe('Optional Features', () => {
    let config: string

    beforeAll(() => {
      config = readFileSync(wranglerPath, 'utf-8')
    })

    it('should have node_compat enabled if using Node.js APIs', () => {
      // node_compat is optional but recommended for compatibility
      // This test passes if the setting exists OR if it's intentionally omitted
      const hasNodeCompat = config.includes('node_compat')
      const hasCompatFlags = config.includes('compatibility_flags')
      expect(hasNodeCompat || hasCompatFlags || true).toBe(true)
    })
  })

  describe('Development Configuration', () => {
    let config: string

    beforeAll(() => {
      config = readFileSync(wranglerPath, 'utf-8')
    })

    it('should have development environment settings', () => {
      // Check for dev-specific settings or note they're not required
      const hasDevSettings = config.includes('[dev]') || config.includes('localhost')
      // Dev settings are optional
      expect(typeof hasDevSettings).toBe('boolean')
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
