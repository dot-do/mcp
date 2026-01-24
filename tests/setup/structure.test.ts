import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '../..')
const SRC = join(ROOT, 'src')

describe('Directory Structure', () => {
  describe('src/', () => {
    it('has index.ts', () => {
      expect(existsSync(join(SRC, 'index.ts'))).toBe(true)
    })

    it('has server.ts', () => {
      expect(existsSync(join(SRC, 'server.ts'))).toBe(true)
    })

    it('has types.ts', () => {
      expect(existsSync(join(SRC, 'types.ts'))).toBe(true)
    })
  })

  describe('src/transports/', () => {
    const transportsDir = join(SRC, 'transports')

    it('has index.ts', () => {
      expect(existsSync(join(transportsDir, 'index.ts'))).toBe(true)
    })

    it('has stdio.ts', () => {
      expect(existsSync(join(transportsDir, 'stdio.ts'))).toBe(true)
    })

    it('has http.ts', () => {
      expect(existsSync(join(transportsDir, 'http.ts'))).toBe(true)
    })
  })

  describe('src/auth/', () => {
    const authDir = join(SRC, 'auth')

    it('has index.ts', () => {
      expect(existsSync(join(authDir, 'index.ts'))).toBe(true)
    })

    it('has types.ts', () => {
      expect(existsSync(join(authDir, 'types.ts'))).toBe(true)
    })

    it('has oauth.ts', () => {
      expect(existsSync(join(authDir, 'oauth.ts'))).toBe(true)
    })

    it('has apikey.ts', () => {
      expect(existsSync(join(authDir, 'apikey.ts'))).toBe(true)
    })

    it('has middleware.ts', () => {
      expect(existsSync(join(authDir, 'middleware.ts'))).toBe(true)
    })
  })

  describe('src/tools/', () => {
    const toolsDir = join(SRC, 'tools')

    it('has index.ts', () => {
      expect(existsSync(join(toolsDir, 'index.ts'))).toBe(true)
    })

    it('has search.ts', () => {
      expect(existsSync(join(toolsDir, 'search.ts'))).toBe(true)
    })

    it('has fetch.ts', () => {
      expect(existsSync(join(toolsDir, 'fetch.ts'))).toBe(true)
    })

    it('has do.ts', () => {
      expect(existsSync(join(toolsDir, 'do.ts'))).toBe(true)
    })
  })

  describe('src/scope/', () => {
    const scopeDir = join(SRC, 'scope')

    it('has index.ts', () => {
      expect(existsSync(join(scopeDir, 'index.ts'))).toBe(true)
    })

    it('has types.ts', () => {
      expect(existsSync(join(scopeDir, 'types.ts'))).toBe(true)
    })

    it('has validate.ts', () => {
      expect(existsSync(join(scopeDir, 'validate.ts'))).toBe(true)
    })
  })

  describe('src/templates/', () => {
    const templatesDir = join(SRC, 'templates')

    it('has index.ts', () => {
      expect(existsSync(join(templatesDir, 'index.ts'))).toBe(true)
    })

    it('has web.ts', () => {
      expect(existsSync(join(templatesDir, 'web.ts'))).toBe(true)
    })

    it('has database.ts', () => {
      expect(existsSync(join(templatesDir, 'database.ts'))).toBe(true)
    })

    it('has filesystem.ts', () => {
      expect(existsSync(join(templatesDir, 'filesystem.ts'))).toBe(true)
    })

    it('has git.ts', () => {
      expect(existsSync(join(templatesDir, 'git.ts'))).toBe(true)
    })

    it('has memory.ts', () => {
      expect(existsSync(join(templatesDir, 'memory.ts'))).toBe(true)
    })
  })

  describe('src/worker/', () => {
    const workerDir = join(SRC, 'worker')

    it('has index.ts', () => {
      expect(existsSync(join(workerDir, 'index.ts'))).toBe(true)
    })
  })

  describe('test/', () => {
    const testDir = join(ROOT, 'test')

    it('has setup.test.ts', () => {
      // Allow either test/ or tests/ directory structure
      const hasTestDir = existsSync(join(testDir, 'setup.test.ts'))
      const hasTestsDir = existsSync(join(ROOT, 'tests', 'setup', 'package.test.ts'))
      expect(hasTestDir || hasTestsDir).toBe(true)
    })
  })
})
