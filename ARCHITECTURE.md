# MCP Context Optimizer Proxy — Detailed Architecture and Security Model

## 1. Introduction & Project Philosophy

This document describes the architecture of the "MCP Context Optimizer," a caching proxy server for the Model Context Protocol (MCP), developed with extreme security (Zero Trust) and functional programming paradigms. Unlike standard relay servers, this proxy implements cryptographically strict validation of every request and response, acting as an invisible but impenetrable barrier between vulnerable LLM agents (clients) and sensitive corporate systems (MCP servers).

Main project goals:
- **Eliminating Attack Vectors:** Cross-Tool Hijacking, Prompt Injection (IPI), ShadowLeak attacks (character-by-character data exfiltration), and ZombieAgent (supply chain compromise).
- **Token Savings and Latency Reduction:** Optimizing responses at L1 (LRU-Cache) and L2 (Better-SQLite3 Persistent Store) levels.
- **Absolute Determinism:** The codebase is written in a functional TypeScript style (Strict Mode). Classes are excluded where unnecessary, and `any` types are completely banned. Calls pass through pure middleware functions.

## 2. Architectural Dogmas and Security Constitution

The proxy architecture obeys immutable dogmas specified in the `.agents/skills/security-constitution.md` file. Violating them is considered a critical Design Flaw.

### 2.1. Fail-Closed Paradigm (Zero Trust)
The proxy server is hardware and logic-bound to never run in Fail-Open mode. This means any unrecognized state, JSON parsing error, network anomaly, missing token, or slightest Zod schema mismatch triggers a **Hard Halt** (immediate processing halt). 
The system does not attempt to "normalize" or fix erroneous data. Instead, it throws a typed exception, unconditionally rejects the request with an HTTP error code (401 or 403), and logs the incident in an immutable `audit.log`. Returning `null` or `undefined` to continue execution is strictly forbidden.

### 2.2. Strict Ban on Token Passthrough
Passing original authentication tokens from the client directly to the target backend server is completely architecturally excluded. 
The intermediate layer (Auth Validator) checks the client agent token, destroys it in the proxy memory layer, and if necessary, provides the request with a new, local context permission to connect to the target server. This guarantees that if the LLM agent is compromised, the attacker can never steal the root backend system token.

### 2.3. Semantic Isolation (MCP Colors Concept)
Every tool in MCP is tagged with color metadata (`_meta.color`). Colors reflect the tool's risk level classification:
- **Red:** Untrusted external content (reading external emails, parsing unfamiliar sites, Google searches).
- **Blue:** Critical internal actions (modifying production databases, changing IAM policies, running system processes).
- **Green:** Local read operations (no side effects).

**The Security Core (Color Boundary)** continuously scans sessions and requested tool arrays. The gateway's fundamental rule: **RED and BLUE can never be called within a single client context or array.** Their intersection mathematically guarantees a Cross-Tool Hijack attack (e.g., a "read Red email" hacking a "Blue database"). Detecting such an intersection instantly triggers a Hard Halt.

## 3. Topology and Transport Layer

The server's transport layer is built on `Express.js`, providing reliable handling of bi-directional HTTP/REST and Server-Sent Events (SSE) according to the `Model Context Protocol` standard.
- **SSE Subsystem:** The proxy maintains a constant `keep-alive` connection (`/sse`) for instantaneous data exchange with agents without polling overhead.
- **JSON Smuggling Defense:** The proxy uses a strictly configured `express.json({ strict: true, limit: '1mb' })`. Any payload larger than 1 Megabyte or containing invalid JSON characters is blocked at the entry point before reaching business logic.

## 4. Request Lifecycle (The Request Pipeline)

Every JSON-RPC call from the agent client passes through a synchronous validation chain (Security Pipeline) consisting of independent middlewares:

### Stage 1: Fail-Closed Auth Validator (`src/middleware/auth-validator.ts`)
1. Server configuration check: if the `PROXY_AUTH_TOKEN` variable is not set on the host machine — **the server blocks absolutely all requests**.
2. Extraction of the `Authorization` header and validation of the authentication scheme (only `Bearer` is allowed).
3. Zod validation of the token itself per the `schema-security-validator` algorithm (minimum 32 characters, strictly alphanumeric string).
4. Constant-time token comparison between client and server to protect against Timing Attacks.
5. `next()` is called strictly without passing the initial token further down the chain.

### Stage 2: Progressive Scheme Validator (`src/types/index.ts`)
The incoming request is converted into Zod `McpToolSchema` interfaces. All parameters are checked against a strict schema; using the `.strict()` method on Zod objects means that the presence of any parameters in the request body not specified by the protocol (an injection attempt) will throw an Exception.

### Stage 3: Color Boundary Enforcer (`src/middleware/color-boundary.ts`)
1. An extractor function retrieves all requested tools from `req.body.tools` or `req.body.params.tools`.
2. Analyzes the color metadata of each tool, collecting them into control arrays `redTools` and `blueTools`.
3. If an intersection occurs (red > 0 and blue > 0), the request is immediately interrupted by calling `res.status(403)`.
4. The client receives JSON with the `CROSS_TOOL_HIJACK_ATTEMPT` error code, and the IP address is logged.

### Stage 4: Egress Filtering and Immutable Audit (`src/utils/auditLogger.ts`)
All rejection events (schema violations, authentication failures, cross-hijack attempts) are routed to a local `audit.log` file using the `auditLog()` function. The file is opened with `flag: 'a'`, forming an immutable Append-Only log.
Future development stages will introduce full-scale outbound AST (Egress) filtering to prevent character-by-character data exfiltration via malicious URLs.

## 5. L1/L2 Caching System (Performance Context Optimizer)

In addition to isolation, the proxy solves the problem of optimizing immense LLM token-related costs. This is achieved through dual-level caching:
1. **L1 (In-Memory LRU Cache, `lru-cache` package):** A lightweight in-memory layer for high-frequency repetitive requests. Provides instant (<5ms) response for standard `read` operations.
2. **L2 (Persistent SQLite Store, `better-sqlite3` package):** SQL cache utilizing parameterized queries (preventing SQL injections). Stores heavy, expensive, or rarely updated contexts (knowledge bases, lengthy AST computations) across proxy server restarts.
3. **Optimization Metrics:** Upon every successful cache access, the system must produce clear logging: `Cache Hit! Estimated Tokens Saved: ~X | ⏱ Latency: Y ms`.

## 6. Project Tree and Hierarchy (Directory Structure)

The repository structure follows Antigravity directives:

**System Context `.agents/`**
- `.agents/rules/` — Local rules, linting, general code style guidelines.
- `.agents/skills/` — Instructions for AI agents on generating secure Zod schemas (`schema-validator.md`) and core security rules (`security-constitution.md`).
- `.agents/workflows/` — Automated workflows and checklists for CI/CD.

**Application Layer `src/`**
- `src/index.ts` — Proxy application entry point (Express HTTP/SSE server).
- `src/middleware/auth-validator.ts` — Fail-safe authorization mechanism.
- `src/middleware/color-boundary.ts` — Semantic tool separation validator.
- `src/types/index.ts` — Strict Zod types.
- `src/utils/auditLogger.ts` — Utility logging function.

**Verification Layer `tests/`**
Tests are written in `Jest` (`ts-jest`), implementing the TDD paradigm and mathematically proving the uncompromising nature of blocks during attack simulations (Hard Halt). Compilation runs via `tsconfig.json` in strict TypeScript mode (`strict: true`, without `any`).

## Conclusion
The **MCP Context Optimizer** architecture is the gold standard for a secure transit layer (Middleware proxy) in the generative AI era. Rejecting familiar soft validations (Fail-Open), the project takes an uncompromising path to Fail-Closed design, combining the cryptographic strictness of `Zod`, powerful semantic risk color isolation, JSON-smuggling defense, and hybrid L1/L2 cache performance.
