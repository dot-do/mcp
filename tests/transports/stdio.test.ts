import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { connectStdio } from '../../src/transports/stdio.js'
import type { MCPServerWrapper } from '../../src/server.js'

// Mock the StdioServerTransport
vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    send: vi.fn(),
    onmessage: undefined,
    onerror: undefined,
    onclose: undefined,
  })),
}))

describe('stdio transport', () => {
  const createMockServer = (): MCPServerWrapper => ({
    server: {
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as MCPServerWrapper['server'],
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('connectStdio', () => {
    it('should be a function', () => {
      expect(typeof connectStdio).toBe('function')
    })

    it('should connect server to StdioServerTransport', async () => {
      const server = createMockServer()
      await connectStdio(server)

      expect(server.connect).toHaveBeenCalled()
    })

    it('should pass transport to server.connect', async () => {
      const server = createMockServer()
      await connectStdio(server)

      expect(server.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          start: expect.any(Function),
          close: expect.any(Function),
          send: expect.any(Function),
        })
      )
    })

    it('should return a promise that resolves when connected', async () => {
      const server = createMockServer()
      const result = connectStdio(server)

      expect(result).toBeInstanceOf(Promise)
      await expect(result).resolves.toBeUndefined()
    })
  })

  describe('signal handling', () => {
    let signalHandlers: Map<string, () => void>
    let mockExit: ReturnType<typeof vi.fn>

    beforeEach(() => {
      signalHandlers = new Map()
      mockExit = vi.fn()

      // Mock process.on for signal handling
      vi.spyOn(process, 'on').mockImplementation((event: string, handler: () => void) => {
        signalHandlers.set(event as string, handler as () => void)
        return process
      })

      // Mock process.exit to prevent actual exit during tests
      vi.spyOn(process, 'exit').mockImplementation(mockExit as never)
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should register SIGINT handler when connecting', async () => {
      const server = createMockServer()
      await connectStdio(server)

      // Check that SIGINT handler was registered
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    })

    it('should register SIGTERM handler when connecting', async () => {
      const server = createMockServer()
      await connectStdio(server)

      // Check that SIGTERM handler was registered
      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
    })

    it('should close server on SIGINT', async () => {
      const server = createMockServer()
      await connectStdio(server)

      // Get the SIGINT handler and call it
      const sigintHandler = signalHandlers.get('SIGINT')
      if (sigintHandler) {
        await sigintHandler()
        expect(server.close).toHaveBeenCalled()
      }
    })

    it('should close server on SIGTERM', async () => {
      const server = createMockServer()
      await connectStdio(server)

      // Get the SIGTERM handler and call it
      const sigtermHandler = signalHandlers.get('SIGTERM')
      if (sigtermHandler) {
        await sigtermHandler()
        expect(server.close).toHaveBeenCalled()
      }
    })
  })
})
