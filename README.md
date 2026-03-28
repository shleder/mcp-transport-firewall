
Fail-closed transport firewall for **Model Context Protocol (MCP)** tool traffic.

This repository implements a model-agnostic interception layer that sits between an MCP client and local or downstream tool servers. The primary security boundary is **stdio**. The firewall inspects MCP-shaped JSON-RPC messages before tool execution and denies unsafe traffic by default.

The repository provides a narrow transport-layer control that can be independently inspected, reproduced, and deployed without changing the agent model itself.


The MCP ecosystem currently relies on tool descriptions, client behavior, and downstream tool implementations for most safety properties. This repository adds an explicit transport control with fail-closed behavior for high-risk request classes, including:

- missing or invalid authorization envelopes
- scope escalation across tool boundaries
- mixed-trust or cross-tool hijack attempts
- high-trust actions without one-time preflight approval
- schema-smuggled arguments on registered tool contracts
- ShadowLeak-style exfiltration patterns in outbound request strings
- sensitive path and shell-injection markers in tool arguments

The control point is deliberately small: inspect, allow, deny, sanitize, and emit evidence.


- **Primary surface:** stdio firewall between an MCP client and a local MCP tool server
- **Secondary surface:** HTTP companion service for compatibility testing and route registration
- **Control plane:** admin API, React dashboard, and Prometheus-formatted metrics exporter

The stdio runtime is the main product path. The HTTP `/mcp` service exists to reuse the same trust gates in a reviewable harness.


| Gate | Enforcement | Code |
|---|---|---|
| `nhi-auth-validator` | fail-closed shared-secret authorization envelope and scope extraction | `src/middleware/nhi-auth-validator.ts` |
| `scope-validator` | reject tool calls outside declared scopes | `src/middleware/scope-validator.ts` |
| `color-boundary` | block mixed trust domains and session color flips | `src/middleware/color-boundary.ts` |
| `preflight-validator` | require one-time preflight IDs for high-trust (`blue`) actions | `src/middleware/preflight-validator.ts` |
| `schema-validator` | enforce strict contracts for registered MCP tool schemas | `src/middleware/schema-validator.ts` |
| `ast-egress-filter` | deny exfiltration, sensitive-path, shell-injection, and epistemic-risk markers | `src/middleware/ast-egress-filter.ts` |


- strict interception of MCP-shaped JSON-RPC `tools/call` traffic
- fail-closed denial when a trust gate cannot validate the request
- response sanitization before tool output re-enters the agent context
- L1/L2 caching for allowlisted read-style tool calls
- route-level circuit breaking for downstream HTTP targets
- blocked-request metrics, cache metrics, route counts, and preflight stats through `/metrics`


1. Install dependencies.

```bash
npm install
npm --prefix ui install
```

2. Copy the example environment.

```powershell
Copy-Item .env.example .env
```

3. Run the reproducible verification path.

```bash
npm run verify:all
npm run benchmark:stdio
```

Expected benchmark outcomes:

- zero false positives across the allow corpus
- zero false negatives across the blocked corpus
- zero cache consistency failures across repeated allow cases
- explicit denial codes for blocked cases

4. Run the stdio demo when you want a short manual proof.

```bash
npm run demo:stdio
```

5. Run the Docker monolith when you want the HTTP harness, dashboard, and metrics endpoint together.

```bash
docker compose up --build
```

Control-plane endpoints:

- [http://localhost:3000/health](http://localhost:3000/health)
- [http://localhost:9090/health](http://localhost:9090/health)
- [http://localhost:9090/metrics](http://localhost:9090/metrics)
- [http://localhost:9090](http://localhost:9090)


The published package contract is:

```bash
npx mcp-transport-firewall
npx mcp-transport-firewall --help
npm install -g mcp-transport-firewall
```

Standalone published-package MCP client configuration:

```json
{
  "mcpServers": {
    "transport-firewall": {
      "command": "npx",
      "args": ["-y", "mcp-transport-firewall"]
    }
  }
}
```

In standalone mode the package exposes bundled MCP tools for status and launch guidance, so it can be attached as a self-contained MCP server with no additional repo checkout or downstream server install.

Protected downstream proxy mode:

```json
{
  "mcpServers": {
    "protected-local-tooling": {
      "command": "npx",
      "args": ["-y", "mcp-transport-firewall"],
      "env": {
        "PROXY_AUTH_TOKEN": "replace-with-32-byte-secret",
        "MCP_TARGET_COMMAND": "node",
        "MCP_TARGET_ARGS_JSON": "[\"C:/tools/my-mcp-server.js\"]"
      }
    }
  }
}
```

Alternative target configuration inputs for downstream proxy mode:

- `MCP_TARGET_ARGS` for a space-delimited argument string
- `MCP_TARGET` for a full target command string


```text
src/cli.ts                stdio entrypoint
src/stdio/proxy.ts        stdio firewall runtime
src/index.ts              HTTP companion service
src/admin/                control plane API, metrics, and UI hosting
src/middleware/           trust gates and fail-closed validators
src/cache/                L1 memory cache and L2 SQLite cache
src/proxy/                HTTP routing, circuit breaker, response sanitization
src/metrics/              Prometheus-formatted exporter
ui/                       React dashboard
scripts/                  demos, repeatable benchmarks, and package smoke checks
examples/                 demo target and benchmark corpus
docs/                     threat model, validation, verification packet, distribution notes
tests/                    Jest suites for stdio, HTTP, admin, and trust gates
```


- threat model: [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md)
- validation guide: [docs/VALIDATION_GUIDE.md](docs/VALIDATION_GUIDE.md)
- stdio walkthrough: [docs/WALKTHROUGH.md](docs/WALKTHROUGH.md)
- benchmark methodology: [docs/EVIDENCE_BENCHMARK.md](docs/EVIDENCE_BENCHMARK.md)
- verification packet: [docs/SECURITY_REVIEW_PACKET.md](docs/SECURITY_REVIEW_PACKET.md)
- open-source distribution plan: [docs/OPEN_SOURCE_DISTRIBUTION.md](docs/OPEN_SOURCE_DISTRIBUTION.md)
- examples and payloads: [examples/README.md](examples/README.md)


| Variable | Mode | Description | Default |
|---|---|---|---|
| `PROXY_AUTH_TOKEN` | stdio + HTTP | shared secret for fail-closed auth | none |
| `MCP_TARGET_COMMAND` | stdio | protected target command for MCP client configs | none |
| `MCP_TARGET_ARGS_JSON` | stdio | JSON array of args for `MCP_TARGET_COMMAND` | none |
| `MCP_TARGET_ARGS` | stdio | space-delimited fallback args for `MCP_TARGET_COMMAND` | none |
| `MCP_TARGET` | stdio | full target command string fallback | none |
| `MCP_CACHE_DIR` | stdio + HTTP | persistent L2 cache directory | `.mcp-cache` |
| `MCP_CACHE_TTL_SECONDS` | stdio + HTTP | cache TTL in seconds | `300` |
| `MCP_ADMIN_ENABLED` | stdio + HTTP | enable admin API, dashboard, and metrics exporter | `false` |
| `MCP_ADMIN_PORT` | stdio + HTTP | admin port | `9090` |
| `ADMIN_TOKEN` | admin | bearer token for protected admin mutation endpoints | none |
| `MCP_PORT` | HTTP | HTTP companion service port | `3000` |
| `MCP_SERVER_ID` | HTTP | cache namespace key prefix | `default` |
| `MCP_ADMIN_CORS_ORIGIN` | admin | allowed admin origin | `*` |


- The auth envelope is shared-secret based. It is not cryptographic attestation.
- Strict schema enforcement only applies to tool names present in the registry.
- The `ast-egress-filter` name is historical. The current implementation is structured recursive string inspection, not a full parser.
- The firewall is a transport control. It is not a sandbox or post-execution containment layer.
- Prometheus support exports current control-plane and runtime counters; it does not replace external log retention or SIEM pipelines.


This repository is released under the MIT license.
