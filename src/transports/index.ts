/**
 * MCP Transports
 *
 * Transport layer implementations for MCP communication.
 *
 * Available transports:
 * - Stdio: For CLI-based usage (stdin/stdout)
 * - HTTP: For web-based usage (JSON-RPC over HTTP)
 * - SSE: For server-sent events streaming
 */

// Export all transport implementations
export * from './http.js'
export * from './stdio.js'
export * from './sse.js'

/**
 * Transport interface for MCP connections
 *
 * Both stdio and HTTP transports implement this common interface
 * for connecting MCP servers to different transport layers.
 */
export interface Transport {
  /** Start accepting connections */
  start(): Promise<void>
  /** Close all connections and shut down */
  close(): Promise<void>
  /** Send a message to connected clients */
  send?(message: unknown): void
  /** Handle incoming messages */
  onmessage?: (message: unknown) => void
  /** Handle errors */
  onerror?: (error: Error) => void
  /** Handle connection close */
  onclose?: () => void
}

/**
 * Transport factory options
 */
export interface TransportFactoryOptions {
  /** Transport type */
  type: 'stdio' | 'http' | 'sse'
  /** HTTP-specific options */
  http?: import('./http.js').HttpTransportOptions
  /** SSE-specific options */
  sse?: import('./sse.js').SSEStreamOptions
}
