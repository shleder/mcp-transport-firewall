# MCP Context Optimizer

> **The first intelligent caching proxy and application firewall for the Model Context Protocol.**

[![CI/CD](https://github.com/maksboreichuk88-commits/MCP-server/actions/workflows/ci.yml/badge.svg)](https://github.com/maksboreichuk88-commits/MCP-server/actions)
[![Docker](https://img.shields.io/badge/docker-ghcr.io-blue)](https://github.com/maksboreichuk88-commits/MCP-server/pkgs/container/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)

---

## 📊 Benchmark Results

Benchmarked across **100 realistic tool invocations** with 20 unique queries (simulating a typical AI coding agent session):

| Metric | Value |
|--------|-------|
| ✅ Cache Hit Ratio | **80%** |
| ⚡ Cached Latency | **~0.3ms** (vs ~100ms direct) |
| 🚀 Speedup Factor | **~333x** for cached calls |
| 💰 Tokens Saved | **~36,000** per 100 calls |
| 🔒 Firewall Rules | 4 active (path traversal, prompt injection, oversized payload, dangerous tools) |

> Run it yourself: `npx ts-node tests/benchmark.ts`

---

## 🏗️ What it does

MCP Context Optimizer is a **drop-in transparent proxy** that sits between your AI agent (Claude Desktop, Codex CLI, LangChain) and any MCP tool server. It:

1. **Caches tool responses** (L1 in-memory + L2 SQLite) — dramatically reduces repeated token costs
2. **Deduplicates in-flight requests** — multiple concurrent agent threads share one backend call
3. **Protects against prompt injection & path traversal** — built-in MCP Application Firewall
4. **Provides a real-time Web Dashboard** at `http://localhost:9090`

---

## 🚀 Quick Start

### Docker (recommended)

```bash
docker run -it --rm \
  -p 9090:9090 \
  ghcr.io/maksboreichuk88-commits/mcp-server:latest \
  node dist/index.js npx -y @modelcontextprotocol/server-filesystem /data
```

### npm (local)

```bash
npm install -g mcp-context-optimizer  # or clone this repo
mcp-optimizer npx -y @modelcontextprotocol/server-filesystem /your/path
```

### Claude Desktop

See [`examples/claude_desktop_config.json`](./examples/claude_desktop_config.json) for a ready-to-use config.

---

## 🛡️ MCP Application Firewall

The built-in firewall automatically blocks:

- **Path Traversal** — requests accessing `/etc/`, `.env`, `.ssh/`, `/proc/`
- **Prompt Injection** — patterns like `"ignore previous instructions"`, `"act as root"`
- **Oversized Payloads** — tool args larger than 256KB (OOM protection)
- **Dangerous Tool Names** — `exec`, `eval`, `shell`, `subprocess`

---

## ⚙️ Configuration

Create `mcp-optimizer.json` in your project root:

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

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_CACHE_TTL_SECONDS` | Cache TTL | `300` |
| `MCP_ADMIN_PORT` | Admin/Dashboard port | `9090` |
| `ADMIN_TOKEN` | Bearer token for Admin API | (none) |
| `MCP_VERBOSE` | Enable debug logging | `false` |

---

## 🏛️ Architecture

```
AI Agent (Claude / Codex / LangChain)
        │  (stdio JSON-RPC)
        ▼
┌─────────────────────────────────────┐
│        MCP Context Optimizer        │
│                                     │
│  Firewall → Dedup → Cache L1 (RAM)  │
│                  └─→ Cache L2 (DB)  │
│                  └─→ Target Server  │
│                                     │
│  Admin HTTP API + Web Dashboard     │
└─────────────────────────────────────┘
        │  (stdio JSON-RPC)
        ▼
   Target MCP Server (filesystem, github, etc.)
```

---

## 🧪 Run Benchmark

```bash
npm install
npx ts-node tests/benchmark.ts
```

---

## 📂 Project Structure

```
src/
  proxy/         — Core proxy engine, circuit breaker, retry, timeout
  cache/         — L1 LRU + L2 SQLite hybrid cache
  middleware/    — Rate limiter, deduplicator, normalizer, firewall
  admin/         — HTTP Admin API + static UI server
  config/        — Zod schema + multi-source config loader
ui/              — React/Vite web dashboard
examples/        — Integration examples (Claude Desktop, LangChain)
tests/           — Unit tests + benchmark script
```

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). PRs welcome!

**License:** MIT
