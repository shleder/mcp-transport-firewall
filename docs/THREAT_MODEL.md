# Threat Model

## Protected Boundary

The primary protected boundary is stdio between:

- an MCP client emitting MCP JSON-RPC messages
- a local tool server process receiving those messages

The repository also ships an HTTP compatibility harness that reuses the same trust gates, but the transport-boundary firewall is the stdio runtime.

## Validation Flow

Validate the control in this order:

1. read the stdio-first walkthrough in [docs/WALKTHROUGH.md](docs/WALKTHROUGH.md)
2. run `npm run verify:all`
3. run `npm run demo:stdio`
4. inspect the denied and allowed cases in `tests/cli.test.ts` and `scripts/stdio-demo.mjs`
5. use the HTTP harness only as a secondary compatibility surface

## Assets

- secrets embedded in tool arguments or tool output
- local filesystem paths and credentials
- high-trust tool capabilities such as write, mutation, or execution
- the integrity of multi-tool execution plans

## Trust Gates

| Gate | Decision | Failure Mode |
|---|---|---|
| `nhi-auth-validator` | is the caller carrying the expected shared secret and declared scopes? | deny request |
| `scope-validator` | is the requested tool within the declared scopes? | deny request |
| `color-boundary` | does the request mix incompatible trust domains? | deny request |
| `preflight-validator` | does a high-trust action carry a valid one-time preflight ID? | deny request |
| `schema-validator` | do registered tool arguments match the strict contract? | deny request |
| `ast-egress-filter` | do request strings match exfiltration or injection markers? | deny request |

All gates fail closed. If a gate cannot validate the request, the request is rejected instead of passed through.

## Covered Attack Classes

| Attack class | Current control | Evidence |
|---|---|---|
| missing or invalid auth | `nhi-auth-validator` | `tests/nhi-auth.test.ts`, `tests/cli.test.ts` |
| scope escalation | `scope-validator` | `tests/scope-validator.test.ts` |
| cross-tool hijack / mixed trust domains | `color-boundary` | `tests/color-boundary.test.ts` |
| replay or missing approval for blue actions | `preflight-validator` | `tests/preflight-validator.test.ts` |
| undeclared tool arguments / indirect prompt smuggling through known schemas | `schema-validator` | `tests/schema-validator.test.ts` |
| ShadowLeak-style exfil via URL parameters | `ast-egress-filter` | `tests/ast-egress-filter.test.ts`, `tests/cli.test.ts` |
| sensitive path access or shell-injection markers in arguments | `ast-egress-filter` | `tests/ast-egress-filter.test.ts` |

## Supported Schema Registry

The strict registry currently covers these contract families and aliases:

- file reads: `read_file`, `read`, `open_file`
- file writes and creation: `write_file`, `write`, `create_file`
- directory enumeration: `list_directory`, `list_files`
- content search: `search_files`, `search`
- command execution: `execute_command`, `execute`
- network fetch: `fetch_url`

These names are not claimed as a universal MCP standard. They are the common tool contracts this repository enforces today.

## Operational Properties

- blocked requests do not reach the downstream stdio target in the demo path
- allowed read-style tool calls can be served from cache
- downstream responses are sanitized before returning to the client
- the admin API exposes route, cache, preflight, rate-limit, circuit-breaker, and SIEM state

## Current Limits

- The auth envelope is a shared secret carried in a Bearer wrapper. It is not signed identity proof.
- Schema enforcement is strict only for tools present in the registry.
- The `ast-egress-filter` performs structured recursive string inspection. It is not a full AST or semantic parser.
- The firewall decides before tool execution. It does not contain side effects after a tool has started.
- The project does not claim to stop every indirect prompt-injection technique. It implements a fail-closed control set for specific transport-boundary risks.
