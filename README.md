# MCP Context Optimizer

**High-performance proxy and Application Firewall for the Model Context Protocol (MCP).**

**Benchmark (100 calls, 20 unique tool invocations):** Cache Hit Ratio **80%** · Tokens saved **~36,000** · Latency reduced from **~110ms to ~26ms (4x)**

[![CI/CD](https://github.com/maksboreichuk88-commits/MCP-server/actions/workflows/ci.yml/badge.svg)](https://github.com/maksboreichuk88-commits/MCP-server/actions)
[![Docker](https://img.shields.io/badge/docker-ghcr.io-blue)](https://github.com/maksboreichuk88-commits/MCP-server/pkgs/container/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## Integration

| Client | Config |
|--------|--------|
| Claude Desktop | [`examples/claude_desktop_config.json`](./examples/claude_desktop_config.json) |
| LangChain / Python | [`examples/langchain_integration.py`](./examples/langchain_integration.py) |
| Docker | `docker run ghcr.io/maksboreichuk88-commits/mcp-server:latest node dist/index.js <target-cmd>` |

---

## What It Does

MCP Context Optimizer is a **transparent stdio proxy** between any MCP client (Claude Desktop, Codex CLI, LangChain) and a target MCP server. It intercepts JSON-RPC traffic and provides:

- **L1 + L2 Hybrid Cache** — LRU in-memory (fast) + SQLite (persistent across restarts). Cache keys are SHA-256 hashes of `(server + method + params)`.
- **Selective Caching** — `alwaysCacheTools` / `neverCacheTools` config fields prevent caching of state-mutating tools (`write_file`, `execute_command`, etc.).
- **Application Firewall** — blocks path traversal (`/etc/`, `.env`, `.ssh/`), prompt injection patterns, payloads > 256KB, and dangerous tool names (`exec`, `eval`, `shell`).
- **Circuit Breaker** — prevents cascade failures when the target MCP server is unavailable.
- **Request Deduplication** — concurrent identical requests are collapsed into a single backend call.
- **Web Dashboard** — real-time metrics at `http://localhost:9090` after `node dist/index.js --admin-only`.

---

## Quick Start

### npm

```bash
git clone https://github.com/maksboreichuk88-commits/MCP-server.git
cd MCP-server && npm install && npm run build
node dist/index.js npx -y @modelcontextprotocol/server-filesystem /your/path
```

### Docker

```bash
docker run -it --rm -p 9090:9090 \
  ghcr.io/maksboreichuk88-commits/mcp-server:latest \
  node dist/index.js npx -y @modelcontextprotocol/server-filesystem /data
```

---

## Configuration

`mcp-optimizer.json` (place in project root):

```jsonc
{
  "admin": { "enabled": true, "port": 9090 },
  "cache": {
    "ttlSeconds": 300,
    "alwaysCacheTools": ["read_file", "list_directory", "search_files"],
    "neverCacheTools": ["write_file", "create_file", "execute_command"]
  }
}
```

| ENV Variable | Description | Default |
|---|---|---|
| `MCP_CACHE_TTL_SECONDS` | Cache entry TTL | `300` |
| `MCP_ADMIN_PORT` | Dashboard / Admin API port | `9090` |
| `ADMIN_TOKEN` | Bearer token for Admin API | *(none)* |
| `MCP_VERBOSE` | Enable debug logging | `false` |

---

## Benchmark

```
npx tsx tests/benchmark.ts
```

```
Total Calls : 100
Cache Hits  : 80
Cache Misses: 20
Hit Ratio   : 80.0%
Direct      : ~110ms
Cached      : ~26ms
Speedup     : 4x
Tokens Saved: ~36,000
```

---

## Architecture

```
MCP Client (Claude / Codex / LangChain)
        │ stdio JSON-RPC
        ▼
┌─────────────────────────────────┐
│     MCP Context Optimizer       │
│                                 │
│  Firewall → Dedup → L1 Cache    │
│                  └─▶ L2 Cache   │
│                  └─▶ Target     │
│                                 │
│  Admin HTTP API + Dashboard     │
└─────────────────────────────────┘
        │ stdio JSON-RPC
        ▼
   Target MCP Server
```

---

## Project Structure

```
src/proxy/       — Engine, circuit breaker, retry, timeout
src/cache/       — L1 LRU + L2 SQLite, cache policies
src/middleware/  — Rate limiter, deduplicator, normalizer, firewall
src/admin/       — HTTP Admin API + static UI file server
src/config/      — Zod schema + multi-source loader (JSON/ENV/CLI)
ui/              — React/Vite dashboard (Recharts)
examples/        — Claude Desktop + LangChain integration configs
tests/           — Unit tests + benchmark script
.github/         — CI/CD: typecheck, build, Docker publish to ghcr.io
```

**License:** MIT
