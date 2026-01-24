/**
 * CLI Argument Parsing
 *
 * Parses command-line arguments for the MCP CLI.
 */

/**
 * Parsed CLI arguments
 */
export interface CLIArgs {
  /** Show help message */
  help: boolean
  /** Show version */
  version: boolean
  /** Template to use */
  template?: string
  /** HTTP port number */
  port: number
  /** Use stdio transport */
  stdio: boolean
  /** Use HTTP transport */
  http: boolean
  /** Path to config file */
  config?: string
  /** Enable OAuth authentication for stdio */
  auth: boolean
  /** Skip browser auto-open during auth */
  noBrowser: boolean
  /** Force new login even if token exists */
  forceLogin: boolean
}

/**
 * Available template names
 */
export const AVAILABLE_TEMPLATES = [
  'web',
  'database',
  'filesystem',
  'git',
  'memory',
] as const

export type TemplateName = (typeof AVAILABLE_TEMPLATES)[number]

/**
 * Parse command-line arguments
 */
export function parseArgs(args: string[]): CLIArgs {
  const result: CLIArgs = {
    help: false,
    version: false,
    port: 8787,
    stdio: true,
    http: false,
    auth: false,
    noBrowser: false,
    forceLogin: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    switch (arg) {
      case '--help':
      case '-h':
        result.help = true
        break

      case '--version':
      case '-v':
        result.version = true
        break

      case '--template':
      case '-t':
        result.template = args[++i]
        break

      case '--port':
      case '-p':
        result.port = parseInt(args[++i], 10)
        break

      case '--stdio':
        result.stdio = true
        result.http = false
        break

      case '--http':
        result.http = true
        result.stdio = false
        break

      case '--config':
      case '-c':
        result.config = args[++i]
        break

      case '--auth':
      case '-a':
        result.auth = true
        break

      case '--no-browser':
        result.noBrowser = true
        break

      case '--force-login':
        result.forceLogin = true
        break
    }
  }

  return result
}

/**
 * Get help text for the CLI
 */
export function getHelpText(): string {
  return `
MCP Server - Model Context Protocol server with search, fetch, and do primitives

Usage:
  mcp [options]
  mcp --template <name>
  mcp --config <path>

Options:
  -h, --help              Show this help message
  -v, --version           Show version number
  -t, --template <name>   Use a pre-built template
  -p, --port <number>     HTTP port (default: 8787)
  --stdio                 Use stdio transport (default)
  --http                  Use HTTP transport
  -c, --config <path>     Path to config file

Authentication (stdio only):
  -a, --auth              Enable OAuth authentication via oauth.do
  --no-browser            Skip automatic browser open during login
  --force-login           Force new login even if token exists

Templates:
  web          Web research (Brave search, HTTP fetch)
  database     SQL database operations
  filesystem   File system operations
  git          Git repository operations
  memory       In-memory knowledge graph

Examples:
  # Start with web template
  mcp --template web

  # Start with HTTP transport on custom port
  mcp --http --port 3000

  # Start with custom config
  mcp --config ./mcp.config.ts

  # Start with stdio (for Claude Desktop)
  mcp --stdio --template filesystem

  # Start with authentication
  mcp --auth --template web
`.trim()
}

/**
 * Get version from package.json
 */
export function getVersion(): string {
  // This will be replaced at build time or read from package.json
  return '0.0.1'
}

/**
 * Load a template by name
 */
export async function loadTemplate(
  name: string
): Promise<Record<string, unknown> | null> {
  if (!AVAILABLE_TEMPLATES.includes(name as TemplateName)) {
    return null
  }

  try {
    // Dynamically import the template
    const module = await import(`../templates/${name}.js`)
    return module.default || module
  } catch {
    return null
  }
}

/**
 * Validate CLI arguments
 */
export function validateArgs(args: CLIArgs): string[] {
  const errors: string[] = []

  if (args.port < 1 || args.port > 65535) {
    errors.push('Port must be between 1 and 65535')
  }

  if (args.template && !AVAILABLE_TEMPLATES.includes(args.template as TemplateName)) {
    errors.push(
      `Unknown template: ${args.template}. Available: ${AVAILABLE_TEMPLATES.join(', ')}`
    )
  }

  if (args.stdio && args.http) {
    errors.push('Cannot use both --stdio and --http')
  }

  return errors
}
