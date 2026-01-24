# MCP Server Project

## Critical Knowledge: MCP OAuth 2.1 Authentication

**This is NOT in Claude's training data** - MCP OAuth 2.1 was finalized in March 2025.

### Key Insight: MCP Server = Federated OAuth 2.1 Server

The MCP server itself MUST serve `.well-known/oauth-authorization-server`. It acts as:
- **OAuth CLIENT** to upstream provider (WorkOS, GitHub, Auth0, etc.)
- **OAuth SERVER** to MCP clients (Claude, ChatGPT, etc.)

The MCP server issues its OWN tokens to MCP clients after authenticating users via the upstream provider.

### Required Endpoints (served by MCP server)

```
/.well-known/oauth-authorization-server  # RFC 8414 - Discovery
/.well-known/oauth-protected-resource    # RFC 9728 - Resource metadata
/authorize                                # Start OAuth flow
/token                                    # Token exchange
/register                                 # Dynamic client registration (RFC 7591)
```

### Flow Diagram

```
MCP Client (Claude/ChatGPT)
    │
    ├─► GET /.well-known/oauth-authorization-server
    │   └── Returns: { authorization_endpoint, token_endpoint, ... }
    │
    ├─► GET /authorize?client_id=...&code_challenge=...
    │   │
    │   └──► MCP Server redirects to WorkOS/GitHub/etc
    │        │
    │        └──► User authenticates
    │             │
    │             └──► Callback to MCP server
    │                  │
    │                  └──► MCP server issues its OWN auth code
    │
    ├─► POST /token (exchange code for MCP server's tokens)
    │
    └─► Use token for MCP requests
```

---

## Implementation Options

### Option 1: @cloudflare/workers-oauth-provider

```typescript
import { OAuthProvider } from '@cloudflare/workers-oauth-provider'

export default new OAuthProvider({
  apiRoute: "/",
  apiHandler: MyMCP.serve("/"),
  defaultHandler: WorkOSHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
```

**Storage**: KV only (hardcoded `OAUTH_KV` binding)
- Client registrations: `client:{clientId}`
- Grants: `grant:{userId}:{grantId}`
- Tokens: `token:{userId}:{grantId}:{tokenId}`

**Limitations**:
- No storage abstraction - cannot use D1/SQLite/Durable Objects
- Must fork to customize storage

**Docs**: https://developers.cloudflare.com/agents/model-context-protocol/authorization/

### Option 2: better-auth (MCP Plugin)

```typescript
import { betterAuth } from "better-auth";
import { mcp } from "better-auth/plugins";

export const auth = betterAuth({
  database: new D1Dialect({ database: env.DB }),
  plugins: [
    mcp({
      loginPage: "/sign-in",
      oidcConfig: {
        accessTokenExpiresIn: 3600,
        refreshTokenExpiresIn: 604800,
      }
    })
  ]
});
```

**Storage**: SQL database (D1, Postgres, MySQL, etc.)
- Tables: `oauthClient`, `oauthAccessToken`, `oauthRefreshToken`, `oauthConsent`
- Supports secondary storage (Redis/KV for sessions)

**Advantages**:
- Flexible storage (D1/SQLite, Postgres via Hyperdrive)
- Native MCP plugin with proper `.well-known` endpoints
- Full OAuth 2.1 compliance with PKCE mandatory
- Works with Cloudflare Workers

**Docs**: https://www.better-auth.com/docs/plugins/mcp

### Option 3: @dotdo/oauth (Recommended)

```typescript
import { createOAuth21Server, MemoryOAuthStorage } from '@dotdo/oauth'
import { DOAuthStorage } from '@dotdo/do/oauth' // Production storage

const oauthServer = createOAuth21Server({
  issuer: 'https://mcp.do',
  storage: new DOAuthStorage(digitalObject), // or MemoryOAuthStorage for testing
  upstream: {
    provider: 'workos',
    apiKey: env.WORKOS_API_KEY,
    clientId: env.WORKOS_CLIENT_ID,
  },
})

app.route('/', oauthServer)
```

**Storage**: Pluggable via `OAuthStorage` interface
- `MemoryOAuthStorage` for testing
- `DOAuthStorage` from @dotdo/do for Durable Object SQLite
- Custom implementations for D1, KV, Postgres

**Architecture** (breaks circular dependency):
```
@dotdo/oauth (leaf - no deps on oauth.do or @dotdo/do)
     ↑
oauth.do (depends on @dotdo/oauth)
     ↑
@dotdo/do (depends on oauth.do, provides DOAuthStorage)
```

**Features**:
- Full OAuth 2.1 server (.well-known, /authorize, /token, /register, /revoke)
- Federated auth to upstream (WorkOS, Auth0, custom)
- PKCE required (S256 only)
- Storage agnostic - bring your own backend
- 52 tests passing

**Location**: oauth.do/core/
**Package**: @dotdo/oauth on npm

---

## OAuth 2.1 Requirements (RFC Compliance)

1. **PKCE is MANDATORY** - Only S256 method allowed
2. **No implicit grant** - Only `response_type=code`
3. **State parameter required** - CSRF protection
4. **Token introspection** - RFC 7662 (`/oauth2/introspect`)
5. **Token revocation** - RFC 7009 (`/oauth2/revoke`)
6. **Dynamic client registration** - RFC 7591 (`/register`)

---

## WorkOS AuthKit Integration Pattern

```typescript
// authkit-handler.ts
app.get('/authorize', async (c) => {
  const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw)

  // Redirect to WorkOS
  return Response.redirect(
    workOS.userManagement.getAuthorizationUrl({
      provider: 'authkit',
      clientId: WORKOS_CLIENT_ID,
      redirectUri: '/callback',
      state: btoa(JSON.stringify(oauthReqInfo)),
    })
  )
})

app.get('/callback', async (c) => {
  // Exchange WorkOS code
  const response = await workOS.userManagement.authenticateWithCode({
    clientId: WORKOS_CLIENT_ID,
    code: c.req.query('code'),
  })

  // Issue MCP server's own token
  return c.env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthReqInfo,
    userId: response.user.id,
    metadata: { email: response.user.email },
    scope: oauthReqInfo.scope,
  })
})
```

---

## Common Mistakes

1. **Pointing to external OAuth server for `.well-known`** - WRONG. MCP server must serve it.
2. **Using oauth.do directly as authorization server** - WRONG. MCP server federates.
3. **Not wrapping with OAuthProvider** - Missing `.well-known/oauth-authorization-server`.
4. **Assuming training data is current** - OAuth 2.1 for MCP is new (2025).

---

## References

- [MCP Authorization Spec (2025-03-26)](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization)
- [Cloudflare MCP Authorization](https://developers.cloudflare.com/agents/model-context-protocol/authorization/)
- [workers-oauth-provider](https://github.com/cloudflare/workers-oauth-provider)
- [better-auth MCP Plugin](https://www.better-auth.com/docs/plugins/mcp)
- [RFC 8414 - OAuth Server Metadata](https://www.rfc-editor.org/rfc/rfc8414.html)
- [RFC 9728 - Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728.html)

---

## Project Structure

```
src/
  auth/           # Authentication types and middleware
  core/           # Server factory and types
  scope/          # DoScope for sandboxed execution
  tools/          # search, fetch, do primitives
  transports/     # stdio, HTTP, SSE
  templates/      # Pre-built configurations
  worker/         # Cloudflare Worker entry point
```

## Commands

```bash
npm test          # Run tests (vitest)
npm run build     # Build (tsc)
npm run typecheck # Type check
npm run dev       # Local development (wrangler)
```
