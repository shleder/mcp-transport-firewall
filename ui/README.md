
React/Vite control-plane UI for the MCP Transport Firewall.

The dashboard is not the primary security boundary. The primary boundary is the stdio firewall runtime. The UI exposes operational state for runtime inspection and operators:

- blocked-request totals and denial codes
- cache hit and miss statistics
- circuit-breaker state
- preflight registry state
- route counts


```bash
npm --prefix ui install
npm --prefix ui run dev
```

By default the UI reads the admin API from:

- `http://localhost:9090` in local development
- the same origin in production builds

You can override the base URL with `VITE_API_BASE`.


```bash
npm --prefix ui run build
```

The built UI is served by the admin control plane when `MCP_ADMIN_ENABLED=true`.
