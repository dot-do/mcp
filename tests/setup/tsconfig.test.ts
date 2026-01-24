import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '../..')
const tsconfigPath = join(ROOT, 'tsconfig.json')

describe('tsconfig.json', () => {
  it('exists', () => {
    expect(existsSync(tsconfigPath)).toBe(true)
  })

  it('is valid JSON', () => {
    const content = readFileSync(tsconfigPath, 'utf8')
    expect(() => JSON.parse(content)).not.toThrow()
  })

  describe('compilerOptions', () => {
    let config: Record<string, unknown>

    beforeAll(() => {
      config = JSON.parse(readFileSync(tsconfigPath, 'utf8'))
    })

    it('uses modern ECMAScript target', () => {
      expect(config.compilerOptions).toHaveProperty('target')
      expect(['ES2022', 'ES2023', 'ES2024', 'ESNext']).toContain(
        (config.compilerOptions as Record<string, string>).target
      )
    })

    it('uses ESNext module system', () => {
      expect(config.compilerOptions).toHaveProperty('module')
      expect(['ESNext', 'ES2022']).toContain(
        (config.compilerOptions as Record<string, string>).module
      )
    })

    it('has strict mode enabled', () => {
      expect((config.compilerOptions as Record<string, boolean>).strict).toBe(true)
    })

    it('outputs to dist directory', () => {
      expect((config.compilerOptions as Record<string, string>).outDir).toBe('dist')
    })

    it('has source from src directory', () => {
      expect((config.compilerOptions as Record<string, string>).rootDir).toBe('src')
    })

    it('generates declaration files', () => {
      expect((config.compilerOptions as Record<string, boolean>).declaration).toBe(true)
    })

    it('generates source maps', () => {
      expect((config.compilerOptions as Record<string, boolean>).sourceMap).toBe(true)
    })

    it('uses bundler module resolution', () => {
      expect((config.compilerOptions as Record<string, string>).moduleResolution).toBe('bundler')
    })
  })

  describe('include/exclude', () => {
    let config: Record<string, unknown>

    beforeAll(() => {
      config = JSON.parse(readFileSync(tsconfigPath, 'utf8'))
    })

    it('includes src directory', () => {
      expect(config.include).toBeDefined()
      expect((config.include as string[]).some(p => p.includes('src'))).toBe(true)
    })

    it('excludes node_modules', () => {
      expect(config.exclude).toBeDefined()
      expect((config.exclude as string[]).includes('node_modules')).toBe(true)
    })

    it('excludes dist', () => {
      expect((config.exclude as string[]).includes('dist')).toBe(true)
    })
  })
})
