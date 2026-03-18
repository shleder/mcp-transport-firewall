# mcp-proxy-firewall

**Model-Agnostic Transport Firewall for the Model Context Protocol.**

A zero-config, vendor-neutral stdio interceptor that enforces a Fail-Closed security boundary between any MCP client and any MCP server — without modifying either endpoint.

[![CI/CD](https://github.com/maksboreichuk88-commits/MCP-server/actions/workflows/ci.yml/badge.svg)](https://github.com/maksboreichuk88-commits/MCP-server/actions)
[![Docker](https://img.shields.io/badge/docker-ghcr.io-blue)](https://github.com/maksboreichuk88-commits/MCP-server/pkgs/container/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## What It Does

`mcp-proxy-firewall` sits between your MCP client (Claude Desktop, Codex CLI, LangChain, any stdio-based agent) and a target MCP server. It intercepts all JSON-RPC traffic over stdio and enforces a layered security pipeline before any request reaches the target or any response reaches the client.

### Pipeline (executed in order, Fail-Closed at every stage)

```
stdin → [Zod Validation] → [Firewall] → [Rate Limiter] → Target MCP Server
                                                              │
stdout ← [ShadowLeak Sanitiser] ← [L1/L2 Cache] ←──────────┘
```

| Stage | What it blocks |
|---|---|
| **Zod Validation** | Malformed JSON-RPC payloads, oversized requests (> 256 KB) |
| **Firewall** | Path traversal (`/etc/`, `.env`, `.ssh/`), prompt-injection patterns, covert tool invocation (Cross-Tool Hijacking), dangerous tool names (`exec`, `eval`, `shell`) |
| **Rate Limiter** | Burst floods from a single client session |
| **ShadowLeak Sanitiser** | Stack traces, filesystem paths, API tokens in outbound error envelopes — zero-click exfiltration vectors |
| **Circuit Breaker** | Cascade failures when the target server is unavailable |
| **L1 + L2 Cache** | LRU in-memory (fast) + SQLite (persistent). Keyed by SHA-256 of `(server + method + params)` |

**Fail-Closed guarantee:** any middleware fault terminates the request with a structured JSON-RPC error. There is no pass-through fallback.

---

## Quick Start

```bash
git clone https://github.com/maksboreichuk88-commits/MCP-server.git
cd MCP-server
npm install
npm run build
node dist/index.js npx -y @modelcontextprotocol/server-filesystem /your/path
```

### Docker

```bash
docker run -it --rm -p 9090:9090 \
  ghcr.io/maksboreichuk88-commits/mcp-server:latest \
  node dist/index.js npx -y @modelcontextprotocol/server-filesystem /data
```

The proxy wraps any target command — replace `npx -y @modelcontextprotocol/server-filesystem /your/path` with whatever command your MCP server uses.

---

## Integration

| Client | Config |
|--------|--------|
| Claude Desktop | [`examples/claude_desktop_config.json`](./examples/claude_desktop_config.json) |
| LangChain / Python | [`examples/langchain_integration.py`](./examples/langchain_integration.py) |
| Docker | `docker run ghcr.io/maksboreichuk88-commits/mcp-server:latest node dist/index.js <target-cmd>` |

---

## Configuration

Place `mcp-optimizer.json` in the project root:

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
| `MCP_CACHE_TTL_SECONDS` | Cache entry TTL in seconds | `300` |
| `MCP_ADMIN_PORT` | Admin API / Dashboard port | `9090` |
| `ADMIN_TOKEN` | Bearer token for Admin API | *(none)* |
| `MCP_VERBOSE` | Enable debug logging to stderr | `false` |

---

## Running Integration Tests

> Requires Node.js v20+ and Python 3.9+.

### 1. Install dependencies and build

```bash
npm install
npm run build
```

### 2. Run TypeScript unit and integration tests

```bash
npm test
```

### 3. Run Python integration tests via MCP client wrapper

```bash
# Install Python test dependencies (one-time)
pip install pytest mcp

# Run the integration suite
pytest tests/integration/test_langchain_wrapper.py -v
```

Expected output:

```
tests/integration/test_langchain_wrapper.py::test_optimized_command_basic PASSED
tests/integration/test_langchain_wrapper.py::test_optimized_command_with_options PASSED
tests/integration/test_langchain_wrapper.py::test_optimized_command_with_spaces PASSED
tests/integration/test_langchain_wrapper.py::test_empty_command PASSED
```

### 4. Run the performance benchmark

```bash
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
MCP Client (any — Claude / Codex / LangChain / custom)
        │  stdio  JSON-RPC
        ▼
┌───────────────────────────────────────┐
│          mcp-proxy-firewall           │
│                                       │
│  Zod → Firewall → RateLimit           │
│                     │                 │
│              [Cache Hit?]             │
│              ├── yes → return cached  │
│              └── no  → Target Server  │
│                           │           │
│              ShadowLeak Sanitiser     │
│                           │           │
│              Admin HTTP API :9090     │
└───────────────────────────────────────┘
        │  stdio  JSON-RPC
        ▼
   Target MCP Server
```

---

## Project Structure

```
src/proxy/       — Engine, circuit breaker, retry, timeout
src/cache/       — L1 LRU + L2 SQLite, cache policies
src/middleware/  — Zod validation, firewall, rate limiter, deduplicator, normalizer
src/admin/       — HTTP Admin API + static dashboard
src/config/      — Zod schema + multi-source config loader (JSON / ENV / CLI)
ui/              — Admin dashboard (React + Vite + Recharts)
examples/        — Claude Desktop + LangChain integration configs
tests/           — Unit tests, integration tests, benchmark
.github/         — CI/CD: typecheck, build, Docker publish to ghcr.io
```

---

**License:** MIT · No proprietary APIs · No LLM-vendor dependencies
