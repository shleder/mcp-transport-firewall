
Use this page when you want a short, reproducible validation path for the **primary stdio boundary**.


```powershell
npm install
npm --prefix ui install
Copy-Item .env.example .env
npm run verify:all
npm run demo:stdio
npm run benchmark:stdio -- --json > evidence.json
npm run pack:dry-run
npm run pack:smoke
```

Manual stdio launch:

```powershell
npm run build
npm run start:cli -- -- node examples/demo-target.js
```

Expected evidence:

- the first `search_files` request reaches the target
- the second identical `search_files` request is served from cache
- the `fetch_url` exfiltration sample returns `SHADOWLEAK_DETECTED`
- the missing-auth sample returns `AUTH_FAILURE`
- the benchmark JSON packet records zero false positives and zero false negatives


```bash
npm install
npm --prefix ui install
cp .env.example .env
npm run verify:all
npm run demo:stdio
npm run benchmark:stdio -- --json > evidence.json
npm run pack:dry-run
npm run pack:smoke
```

Manual stdio launch:

```bash
npm run build
npm run start:cli -- -- node examples/demo-target.js
```


If you want the secondary HTTP harness, dashboard, and metrics exporter:

```bash
docker compose up --build
curl http://localhost:9090/metrics
```

The Docker path is useful for observability and packaging review. The stdio path remains the main proof of transport-boundary enforcement.


The intended public CLI contract after the first npm release is:

```bash
npx mcp-transport-firewall
npx mcp-transport-firewall --help
npm install -g mcp-transport-firewall
```

Standalone MCP client configuration:

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

When you need to protect a downstream MCP server instead of using the bundled standalone tools, add `MCP_TARGET_COMMAND` plus one of the supported argument variables from the root README.
