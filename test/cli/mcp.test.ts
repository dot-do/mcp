/**
 * CLI Entry Point Tests
 *
 * Tests for the MCP CLI binary.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const rootDir = join(__dirname, '../..')
const binPath = join(rootDir, 'bin/mcp')

describe('CLI Entry Point', () => {
  describe('File Structure', () => {
    it('should have bin/mcp file', () => {
      expect(existsSync(binPath)).toBe(true)
    })

    it('should have shebang line', () => {
      const content = readFileSync(binPath, 'utf-8')
      expect(content.startsWith('#!/usr/bin/env node')).toBe(true)
    })

    it('should be referenced in package.json bin field', () => {
      const pkgPath = join(rootDir, 'package.json')
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      expect(pkg.bin).toBeDefined()
      expect(pkg.bin.mcp).toBeDefined()
    })
  })
})

describe('CLI Argument Parsing', () => {
  // Import the actual module for testing
  let parseArgs: typeof import('../../src/cli/args.js').parseArgs

  beforeEach(async () => {
    const module = await import('../../src/cli/args.js')
    parseArgs = module.parseArgs
  })

  it('should parse --help flag', () => {
    const result = parseArgs(['--help'])
    expect(result.help).toBe(true)
  })

  it('should parse --version flag', () => {
    const result = parseArgs(['--version'])
    expect(result.version).toBe(true)
  })

  it('should parse --template option', () => {
    const result = parseArgs(['--template', 'web'])
    expect(result.template).toBe('web')
  })

  it('should parse -t shorthand for template', () => {
    const result = parseArgs(['-t', 'database'])
    expect(result.template).toBe('database')
  })

  it('should parse --port option', () => {
    const result = parseArgs(['--port', '8080'])
    expect(result.port).toBe(8080)
  })

  it('should parse -p shorthand for port', () => {
    const result = parseArgs(['-p', '3000'])
    expect(result.port).toBe(3000)
  })

  it('should parse --stdio flag', () => {
    const result = parseArgs(['--stdio'])
    expect(result.stdio).toBe(true)
  })

  it('should parse --http flag', () => {
    const result = parseArgs(['--http'])
    expect(result.http).toBe(true)
  })

  it('should have stdio as default transport', () => {
    const result = parseArgs([])
    expect(result.stdio).toBe(true)
  })

  it('should parse --config option', () => {
    const result = parseArgs(['--config', './mcp.config.ts'])
    expect(result.config).toBe('./mcp.config.ts')
  })

  it('should parse multiple options', () => {
    const result = parseArgs([
      '--template', 'filesystem',
      '--port', '9000',
      '--http',
    ])
    expect(result.template).toBe('filesystem')
    expect(result.port).toBe(9000)
    expect(result.http).toBe(true)
  })
})

describe('CLI Help Output', () => {
  let getHelpText: typeof import('../../src/cli/args.js').getHelpText

  beforeEach(async () => {
    const module = await import('../../src/cli/args.js')
    getHelpText = module.getHelpText
  })

  it('should include usage information', () => {
    const help = getHelpText()
    expect(help).toContain('Usage:')
    expect(help).toContain('mcp')
  })

  it('should include available options', () => {
    const help = getHelpText()
    expect(help).toContain('--help')
    expect(help).toContain('--version')
    expect(help).toContain('--template')
    expect(help).toContain('--port')
  })

  it('should include available templates', () => {
    const help = getHelpText()
    expect(help).toContain('Templates:')
    expect(help).toMatch(/web|database|filesystem|git|memory/)
  })

  it('should include examples', () => {
    const help = getHelpText()
    expect(help).toContain('Examples:')
  })
})

describe('CLI Template Loading', () => {
  it('should export loadTemplate function', async () => {
    const module = await import('../../src/cli/args.js')
    expect(typeof module.loadTemplate).toBe('function')
  })

  it('should return null for unknown template', async () => {
    const { loadTemplate } = await import('../../src/cli/args.js')
    const result = await loadTemplate('unknown-template')
    expect(result).toBeNull()
  })
})
