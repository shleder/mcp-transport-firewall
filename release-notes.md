#  MCP Context Optimizer Proxy v2.0.0 (The Security Update)

This major release completely overhauls the architecture, migrating from a Fail-Open design to a strict **Fail-Closed (Zero Trust)** protocol-level security gateway. Designed specifically to mitigate prompt injections (IPI) and supply chain attacks (OWASP ASI05/ASI06).

##  Key Architectural Changes
* **Absolute Fail-Closed Paradigm**: Any network anomaly, invalid Zod-parsed schema, or auth token absence immediately halts execution (HTTP 401/403). No state corruption or memory poisoning allowed.
* **Zero Token Passthrough**: System securely consumes proxy auth tokens. Proxy tokens are permanently blocked from reaching downstream target MCP servers.

##  New Security Middleware Stack
* **AST Egress Filtering (`ast-egress-filter`)**: Deterministically inspects all outbound AST payloads. Defends against **ShadowLeak** (character-by-character URL exfiltration), blocks sensitive system file access (`.env`, `id_rsa`), and intercepts shell injection attacks (`$(...)`, backticks, pipes).
* **Color Boundary Enforcement (`color-boundary`)**: Introduces "Semantic Context Isolation". Instant detection and Hard Halt for "Cross-Tool Hijacking" attempts (blocks malicious `Red` contexts from simultaneously invoking critical `Blue` components).
* **Preflight Idempotency (`preflight-validator`)**: Critical `Blue` tools now require a one-time-use `preflightId`. Fully mitigates replay attacks and strictly preserves idempotency for destructive actions.

##  Features & Internal Upgrades
* **Abstract Route Federation**: Safe proxy routing dictionary (`Map<string, TargetServerConfig>`). Unknown routes strictly drop to 403.
* **Append-Only Auditing**: Secure, immutable stderr logging for all semantic violations and auth failures.
* **Fully Tested**: Powered by a robust suite of 34 Jest tests ensuring 100% boundary safety.
* **Clean Open-Source Codebase**: Codebase totally overhauled, strictly typed (TypeScript strict module), and translated entirely to standard English conventions without documentation clutter.
