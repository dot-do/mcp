# MCP

**Three primitives. Infinite capabilities.**

Build AI agents that can search, fetch, and do — with any backend, any scale, complete safety.

```typescript
import { createMCPServer } from 'mcp'

const server = createMCPServer({
  search: webSearch(),
  fetch: httpFetch(),
  do: evaluate()
})
```

---

## The Problem

AI agents are trapped in a fragmented world.

Every capability requires a separate tool. Every tool requires a round-trip to the model. Every round-trip costs tokens, time, and reliability.

An agent that needs to search the web, fetch a document, extract data, and save results might make **5-10 sequential tool calls** — each one requiring the model to:

1. Receive the previous result
2. Decide what to do next
3. Format a new tool call
4. Wait for execution
5. Repeat

This pattern has three fatal flaws:

**Token explosion.** Context windows fill with intermediate results. A workflow that should cost 2,000 tokens balloons to 150,000.

**Latency multiplication.** Each tool call requires a full model inference. Ten tools means ten inference round-trips.

**Fragile orchestration.** The model must correctly sequence every step. One wrong decision cascades into failure.

There's a better way.

---

## The Insight

LLMs are better programmers than they are tool-callers.

They've been trained on billions of lines of code. They understand TypeScript interfaces, async/await patterns, error handling, loops, and conditionals.

But structured tool-call syntax? That's artificial. It was never in their training data. Every tool call is the model working against its strengths.

**The solution: let the model write code.**

Instead of N sequential tool calls, give the model ONE tool that accepts code. That code can call functions, handle errors, loop over results, and compose operations — all in a single execution.

```typescript
// Before: 5 tool calls, 5 round-trips, 150K tokens
tool_call: search({ query: "latest AI research" })
tool_call: fetch({ url: results[0].url })
tool_call: extract({ content: page, fields: ["title", "abstract"] })
tool_call: search({ query: extracted.abstract })
tool_call: save({ data: relatedPapers })

// After: 1 tool call, 1 round-trip, 2K tokens
tool_call: do({
  code: `
    const results = await search("latest AI research")
    const page = await fetch(results[0].url)
    const { title, abstract } = extractFields(page, ["title", "abstract"])
    const related = await search(abstract)
    return { title, abstract, related }
  `
})
```

Same capability. **98% fewer tokens.** One inference instead of five.

---

## Three Primitives

Every AI agent capability reduces to three operations:

### `search` — Find information

Query a corpus. Discover resources. Match patterns.

```typescript
search("users who signed up last week")
search("*.config.json")
search("SELECT * FROM orders WHERE status = 'pending'")
```

### `fetch` — Retrieve resources

Get a specific thing by identifier.

```typescript
fetch("https://api.example.com/users/123")
fetch("/etc/nginx/nginx.conf")
fetch("order:ord_abc123")
```

### `do` — Execute operations

Run code with access to search and fetch (and any other bindings you provide).

```typescript
do(`
  const users = await search("premium users")
  const enriched = await Promise.all(
    users.map(async u => ({
      ...u,
      profile: await fetch(u.profileUrl)
    }))
  )
  return enriched.filter(u => u.profile.verified)
`)
```

The `do` primitive is where the magic happens. It's not just code execution — it's **composable orchestration**.

---

## Safe by Design

Arbitrary code execution sounds dangerous. It isn't — when designed correctly.

The execution environment is a V8 isolate with **zero ambient capabilities**:

- No filesystem access
- No network access
- No environment variables
- No system calls

The ONLY way code can interact with the outside world is through **explicitly provided bindings**.

```typescript
do({
  code: `
    // These work because they're provided bindings
    const results = await search("query")
    const doc = await fetch("doc:123")

    // These fail because they're not provided
    await fetch("https://evil.com")      // Error: not a valid resource
    require('fs').readFileSync('/etc/passwd')  // Error: require is not defined
    process.env.API_KEY                   // Error: process is not defined
  `,
  bindings: {
    search: scopedSearch,  // Your implementation
    fetch: scopedFetch     // Your implementation
  }
})
```

This is **capability-based security**. Code can only do what you explicitly allow. Credentials never enter the sandbox. The attack surface is exactly the surface you define.

---

## Configurable Scope

The power of this pattern comes from configurable scope. The same three primitives adapt to any domain:

### Web Research Agent

```typescript
createMCPServer({
  search: braveSearch({ apiKey }),
  fetch: httpFetch({ allowedDomains: ['*.gov', '*.edu'] }),
  do: {
    bindings: { search, fetch },
    types: WEB_TYPES
  }
})
```

### Database Agent

```typescript
createMCPServer({
  search: db.query,
  fetch: db.get,
  do: {
    bindings: {
      search: db.query,
      fetch: db.get,
      db: { create: db.create, update: db.update, delete: db.delete }
    },
    types: generateTypes(db.schema)
  }
})
```

### Filesystem Agent

```typescript
createMCPServer({
  search: fs.glob,
  fetch: fs.read,
  do: {
    bindings: {
      search: fs.glob,
      fetch: fs.read,
      fs: { write: fs.write, mkdir: fs.mkdir, move: fs.move }
    },
    types: FS_TYPES
  }
})
```

### Git Agent

```typescript
createMCPServer({
  search: git.log,
  fetch: git.show,
  do: {
    bindings: {
      search: git.log,
      fetch: git.show,
      git: { commit: git.commit, branch: git.branch, merge: git.merge }
    },
    types: GIT_TYPES
  }
})
```

The libraries don't know about sandboxes. They export typed functions. This server wires them into a secure execution context.

---

## How It Works

### 1. Define Your Scope

```typescript
const scope = {
  bindings: {
    search: mySearchImpl,
    fetch: myFetchImpl,
    custom: myCustomApi
  },
  types: `
    declare function search(query: string): Promise<Result[]>
    declare function fetch(id: string): Promise<Document>
    declare const custom: {
      process(data: unknown): Promise<ProcessedData>
    }
  `
}
```

### 2. Create the Server

```typescript
const server = createMCPServer({
  search: scope.bindings.search,
  fetch: scope.bindings.fetch,
  do: scope
})
```

### 3. Connect to Claude

```json
{
  "mcpServers": {
    "my-agent": {
      "command": "npx",
      "args": ["my-mcp-server"]
    }
  }
}
```

### 4. Let Claude Write Code

When Claude needs to accomplish a complex task, it writes TypeScript against your type definitions. The code executes in a sandboxed V8 isolate with only your bindings available.

Claude sees:

```typescript
// Available APIs (from your types)
declare function search(query: string): Promise<Result[]>
declare function fetch(id: string): Promise<Document>
declare const custom: { process(data: unknown): Promise<ProcessedData> }
```

Claude writes:

```typescript
const results = await search("important documents")
const docs = await Promise.all(results.map(r => fetch(r.id)))
const processed = await custom.process(docs)
return processed
```

You get: composable, efficient, secure AI operations.

---

## Templates

Pre-built configurations for common use cases:

```typescript
import { templates } from 'mcp'

// Knowledge graph / memory
const memory = templates.memory({ storage: memoryStore })

// Filesystem operations
const filesystem = templates.filesystem({ root: '/data', readonly: false })

// SQL database
const database = templates.database({ connection: pgClient })

// Git repository
const git = templates.git({ repo: repoPath })

// Web research
const web = templates.web({ searchProvider: 'brave', apiKey })

// Shell commands (with safety analysis)
const shell = templates.shell({ allowedCommands: ['ls', 'cat', 'grep'] })
```

Each template is a `DoScope` configuration that wires the three primitives to a specific backend.

---

## Why This Matters

### For AI Agent Developers

Stop building N tools for N capabilities. Build three primitives. Configure the scope. Let the model compose.

### For Backend Library Authors

Stop building sandboxes. Export typed functions. Let this library handle execution safety.

### For Organizations

Get the power of arbitrary code execution with the safety of capability-based security. Audit what's possible by auditing the bindings.

---

## The Vision

Every backend becomes an MCP server with three lines:

```typescript
createMCPServer({ search, fetch, do: { bindings, types } })
```

Every AI agent gets the same three tools:

- `search` — find information
- `fetch` — retrieve resources
- `do` — compose operations

The difference is scope. A database agent's `search` queries tables. A filesystem agent's `search` globs paths. A web agent's `search` calls Brave.

But the pattern is universal. And when the pattern is universal, agents become composable.

An agent that knows `search/fetch/do` can work with ANY backend. Swap the scope, keep the agent.

This is the future of AI capabilities: **three primitives, infinite scope, complete safety**.

---

## Getting Started

```bash
npm install mcp
```

```typescript
import { createMCPServer, templates } from 'mcp'

// Quick start with a template
const server = createMCPServer(templates.web({
  searchProvider: 'brave',
  apiKey: process.env.BRAVE_API_KEY
}))

// Or build your own scope
const server = createMCPServer({
  search: mySearch,
  fetch: myFetch,
  do: {
    bindings: { search: mySearch, fetch: myFetch, custom: myApi },
    types: MY_TYPES
  }
})

// Start the server
server.listen()
```

---

## Roadmap

This project follows TDD (Red → Green → Refactor) methodology. Track progress with `bd list`.

### Epics

| ID | Epic | Tasks |
|----|------|-------|
| `mcp-jxp` | **Setup: Project Scaffolding** | Package.json, tsconfig, directory structure |
| `mcp-h3t` | **Core: Server Factory & Types** | MCPServerConfig, createMCPServer(), type exports |
| `mcp-7oh` | **Transports: Stdio & HTTP/SSE** | Stdio transport, HTTP handler, SSE streaming |
| `mcp-xss` | **Auth: Multi-Mode Authentication** | Anonymous, OAuth 2.1, API keys, middleware |
| `mcp-ogn` | **Tools: Search, Fetch, Do** | Three primitives with ai-evaluate sandbox |
| `mcp-xey` | **Scope: Bindings & Types** | DoScope interface, type generation, validation |
| `mcp-txs` | **Templates: Pre-built Configs** | Web, database, filesystem, git, memory |
| `mcp-c1n` | **Worker: Cloudflare Deployment** | Worker entry, wrangler config, rate limiting, CLI |

### TDD Workflow

Each task follows Red → Green → Refactor:

```bash
# Find next task
bd ready

# Start work (write failing test)
bd update mcp-jxp.1 --status in_progress

# Implement (make test pass)
bd update mcp-jxp.2 --status in_progress

# Refactor and complete
bd close mcp-jxp.1
bd close mcp-jxp.2
```

---

## License

MIT
