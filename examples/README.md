# Examples

## Stdio Demo

- `demo-target.js`: local JSON-RPC tool server used by the stdio firewall demo and tests
- `slow-stdio-target.js`: delayed target used to reproduce the shutdown race regression

For the complete Windows and Linux evaluator path, see [docs/EVALUATOR_WALKTHROUGH.md](docs/EVALUATOR_WALKTHROUGH.md).

Canonical reviewer path:

```bash
npm run build
npm run demo:stdio
```

Manual interactive path:

```bash
npm run start:cli -- -- node examples/demo-target.js
```

Then write JSON-RPC lines to stdin. If `PROXY_AUTH_TOKEN` is configured, include `_meta.authorization` inside the request body.

## HTTP Review Harness

- `register-route.json`: admin payload for registering a downstream HTTP tool route
- `tool-call.json`: MCP `tools/call` payload for the HTTP `/mcp` harness

Register a route:

```powershell
curl.exe -X POST http://localhost:9090/routes `
  -H "Authorization: Bearer $env:ADMIN_TOKEN" `
  -H "Content-Type: application/json" `
  --data @examples/register-route.json
```

Send a tool call:

```powershell
curl.exe -X POST http://localhost:3000/mcp `
  -H "Authorization: Bearer $nhiHeader" `
  -H "Content-Type: application/json" `
  --data @examples/tool-call.json
```
