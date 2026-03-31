This repository inserts a fail-closed control at the stdio transport boundary for MCP `tools/call` traffic.

Protected assets:

- local files and secrets reachable through tool arguments
- high-trust mutation and execution capabilities
- integrity of multi-tool plans
- response material that flows back into the client context

Primary attack classes in scope:

- missing or invalid shared-secret authorization
- scope escalation across tool boundaries
- mixed red/blue trust-domain execution
- missing or replayed preflight approval for blue actions
- schema-smuggled or undeclared tool arguments
- ShadowLeak-style exfiltration markers
- sensitive-path and shell-injection markers in request strings
- unsafe response material returned from downstream tools

Current decision gates:

| Gate | Decision |
|---|---|
| `nhi-auth-validator` | shared secret and declared scopes |
| `scope-validator` | tool is inside the declared scope set |
| `color-boundary` | trust domains are not mixed or flipped |
| `preflight-validator` | blue action has a valid one-time preflight ID |
| `schema-validator` | registered tool args match a strict contract |
| `ast-egress-filter` | request strings do not match deny markers |

Failure mode:

- if a gate cannot validate the request, the request is denied instead of forwarded
- if a downstream response is returned, it is sanitized before re-entry
