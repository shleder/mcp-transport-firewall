## Proxy Setup

`Toolwall` is the display name on the repo surface. The installable package and CLI entrypoint stay `mcp-transport-firewall`.

Use this page when you want the firewall in front of a local read/search-shaped downstream MCP server.
The main fit is one protected local filesystem/search workflow over `stdio`.

## Canonical install path

Use protected downstream proxy mode as the default integration path:

```json
{
  "mcpServers": {
    "protected-local-tooling": {
      "command": "npx",
      "args": ["-y", "mcp-transport-firewall"],
      "env": {
        "PROXY_AUTH_TOKEN": "replace-with-32-byte-secret",
        "MCP_TARGET_COMMAND": "node",
        "MCP_TARGET_ARGS_JSON": "[\"C:/absolute/path/to/your-mcp-server.js\"]"
      }
    }
  }
}
```

Use `PROXY_AUTH_TOKEN` for fail-closed auth, and prefer `MCP_TARGET_COMMAND` plus `MCP_TARGET_ARGS_JSON` for the downstream target.

## Canonical proof path

```bash
npm install
npm run build
npm run demo:stdio
```

Expected output:

```text
stdio demo passed
allow: tool=search_files callCount=1
cache: second response matched first response for tool=search_files
block: ShadowLeak request denied with code=SHADOWLEAK_DETECTED
block: missing auth denied with code=AUTH_FAILURE
```

What this proves:

- the first `search_files` request reaches the downstream target
- the second identical `search_files` request is served from cache
- the `fetch_url` exfiltration sample is denied before downstream execution
- the missing-auth sample is denied at the transport boundary

The proof path uses `examples/demo-target.js` as a reproducible downstream target. It demonstrates a protected local filesystem/search-style workflow without claiming to be a full filesystem MCP server.
The short demo intentionally stays on the safe `search_files` path; default-high-trust preflight denials are covered by the benchmark corpus and snapshot.

After the proof:

```bash
npm run assert:package-metadata
npm test
npm run verify:all
npm run benchmark:stdio -- --json --output evidence.json
npm run pack:dry-run
npm run pack:smoke
```

Manual stdio launch:

```bash
npm run build
npm run start:cli -- -- node examples/demo-target.js
```

Secondary HTTP harness, dashboard, and metrics exporter:

```bash
docker compose up --build
curl http://localhost:9090/metrics
```

The Docker path is useful for observability and packaging validation. The stdio path stays the main proof of transport-boundary enforcement.

If you need the packaged status tools without configuring another downstream target, `npx -y mcp-transport-firewall` falls back to the bundled `--embedded-target` path behind the same stdio boundary.
