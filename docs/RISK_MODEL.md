## Risk Model

This repository implements a fail-closed transport control for **MCP JSON-RPC tool traffic**. It intercepts unsafe traffic before tool execution and sanitizes tool output before it re-enters the agent context.

The design is intentionally narrow:

- inspect requests at the stdio transport boundary
- enforce trust gates before execution
- sanitize returned tool output
- produce repeatable evidence of allow and deny behavior

The primary protected boundary is **stdio** between:

- an MCP client or agent runtime emitting JSON-RPC messages
- a local MCP tool server receiving those messages

The repository also ships an HTTP companion harness that reuses the same trust gates, but the stdio runtime is the main path.

Protected assets:

- local filesystem contents reachable through tool arguments
- secrets embedded in tool parameters or tool output
- high-trust mutation and execution capabilities
- the integrity of multi-tool execution plans
- the safety of responses that flow back into an agent context

The control set is aimed at transport-layer abuse patterns common to agentic toolchains:

- an attacker or untrusted content source attempts to coerce an agent into invoking a tool with unsafe arguments
- an unsafe request is relayed through MCP without a dedicated transport control
- a tool response contains sensitive data or hidden payload strings that could re-enter the agent loop
- trust is escalated implicitly across tool boundaries, such as mixed red/blue execution or replayed approvals

This includes indirect prompt-injection traffic only to the extent that it appears as inspectable request or response material at the transport boundary.

| Gate | Decision | Failure mode |
|---|---|---|
| `nhi-auth-validator` | Is the caller carrying the expected shared secret and declared scopes? | deny request |
| `scope-validator` | Is the requested tool inside the declared scope set? | deny request |
| `color-boundary` | Does the request mix incompatible trust domains or flip an established session color? | deny request |
| `preflight-validator` | Does a high-trust (`blue`) action carry a valid one-time preflight ID? | deny request |
| `schema-validator` | Do registered tool arguments match a strict contract? | deny request |
| `ast-egress-filter` | Do request strings match exfiltration, sensitive-path, shell-injection, or epistemic-risk markers? | deny request |

All gates fail closed. If validation cannot be completed, the request is rejected instead of forwarded.

| Attack class | Current control | Evidence |
|---|---|---|
| missing or invalid auth | `nhi-auth-validator` | `tests/nhi-auth.test.ts`, `tests/cli.test.ts` |
| scope escalation | `scope-validator` | `tests/scope-validator.test.ts` |
| mixed trust domains / cross-tool hijack | `color-boundary` | `tests/color-boundary.test.ts` |
| missing or replayed approval for high-trust actions | `preflight-validator` | `tests/preflight-validator.test.ts` |
| undeclared or schema-smuggled arguments | `schema-validator` | `tests/schema-validator.test.ts` |
| ShadowLeak-style URL exfiltration | `ast-egress-filter` | `tests/ast-egress-filter.test.ts`, `tests/cli.test.ts` |
| sensitive-path access markers | `ast-egress-filter` | `tests/ast-egress-filter.test.ts`, `examples/evidence-corpus.json` |
| shell-injection markers in tool arguments | `ast-egress-filter` | `tests/ast-egress-filter.test.ts`, `examples/evidence-corpus.json` |
| unsafe response material flowing back to the caller | response sanitization | `src/proxy/shadow-leak-sanitizer.ts`, `tests/app.test.ts` |

The strict registry currently covers these contract families and aliases:

- file reads: `read_file`, `read`, `open_file`
- file writes and creation: `write_file`, `write`, `create_file`
- directory enumeration: `list_directory`, `list_files`
- content search: `search_files`, `search`
- command execution: `execute_command`, `execute`
- network fetch: `fetch_url`

These names are the contracts enforced by this repository. They are not presented as a universal MCP standard.

What the repo currently demonstrates:

- blocked requests do not reach the downstream stdio target in the reproducible demo path
- allowed read-style tool calls can be served from cache
- downstream responses are sanitized before returning to the caller
- the control plane exposes route, cache, preflight, circuit-breaker, blocked-request, and Prometheus-formatted metrics

What it does not claim:

- cryptographic identity attestation
- kernel, VM, or container sandboxing
- complete semantic detection of every prompt-injection variant
- post-execution containment after a tool has already started
- that every MCP deployment is safe once this control is inserted
