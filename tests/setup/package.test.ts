import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '../..')
const packageJsonPath = join(ROOT, 'package.json')

describe('package.json', () => {
  it('exists', () => {
    expect(existsSync(packageJsonPath)).toBe(true)
  })

  it('has required dependencies', () => {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    expect(pkg.dependencies).toHaveProperty('@modelcontextprotocol/sdk')
    expect(pkg.dependencies).toHaveProperty('ai-evaluate')
    expect(pkg.dependencies).toHaveProperty('hono')
    expect(pkg.dependencies).toHaveProperty('jose')
    expect(pkg.dependencies).toHaveProperty('zod')
  })

  it('has required devDependencies', () => {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    expect(pkg.devDependencies).toHaveProperty('typescript')
    expect(pkg.devDependencies).toHaveProperty('vitest')
    expect(pkg.devDependencies).toHaveProperty('@cloudflare/workers-types')
    expect(pkg.devDependencies).toHaveProperty('wrangler')
    expect(pkg.devDependencies).toHaveProperty('eslint')
  })

  it('has correct scripts', () => {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    expect(pkg.scripts).toHaveProperty('build')
    expect(pkg.scripts).toHaveProperty('test')
    expect(pkg.scripts).toHaveProperty('lint')
    expect(pkg.scripts).toHaveProperty('dev')
  })

  it('has correct exports configuration', () => {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    expect(pkg.exports).toBeDefined()
    expect(pkg.exports['.']).toBeDefined()
    expect(pkg.exports['.'].import).toBeDefined()
    expect(pkg.exports['.'].types).toBeDefined()
  })
})
