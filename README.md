# MCP Context Optimizer 🚀

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/Lang-TypeScript-blue)
![MCP](https://img.shields.io/badge/Protocol-MCP-green)

Кэширующий прокси-сервер для "Model Context Protocol" (MCP).
Снижает затраты на токены LLM, уменьшает время ответа (latency) и оптимизирует контекстное окно AI-агентов (таких как Claude, Cursor, AI Composer), перехватывая и кэшируя вызовы инструментов и чтение ресурсов.

## Основные возможности

- ⚡ **Двухуровневый кэш (L1 In-Memory + L2 SQLite)**: Мгновенные ответы из памяти с персистентностью на диске. Опциональное Gzip сжатие.
- 🛡️ **Rate Limiter & Circuit Breaker**: Продвинутая защита от спама агентами и защита целевого сервера в случае недоступности.
- ♻️ **Умные политики и In-Flight Deduplicator**: Слияние одинаковых параллельных запросов в один (экономия ресурсов сервера). Гибкая настройка TTL для каждого метода отдельно.
- 📊 **Prometheus Metrics**: Встроенный коллектор метрик и гистограмм latency.
- ⚙️ **Admin HTTP API**: API для просмотра состояния, очистки кэша и чтения статистики (Secure Bearer Auth + CORS).
- 🧩 **Passthrough-архитектура**: Прозрачно пропускает Ping, Notification и некэшируемые методы.

## Установка

```bash
npm install -g mcp-context-optimizer
```

## Как использовать

Просто оберните вызов вашего MCP-сервера в команду `mcp-optimizer`.

**В конфигурации Claude Desktop / AI Client:**

```json
{
  "mcpServers": {
    "my-heavy-database": {
      "command": "mcp-optimizer",
      "args": ["--", "npx", "-y", "my-heavy-mcp-db-server@latest"]
    }
  }
}
```

Все аргументы после `--` будут восприняты как команда запуска вашего целевого (Target) MCP-сервера.

## Конфигурация

Помимо CLI аргументов, прокси можно настроить через переменные окружения, например:
- `MCP_CACHE_TTL_SECONDS=3600` (Кэш на час)
- `MCP_RATE_LIMIT_ENABLED=true` 
- `MCP_ADMIN_ENABLED=true`
- `MCP_ADMIN_PORT=8080`

Или создать файл `mcp-proxy.config.json` в корне проекта со всеми параметрами.

## Встроенный HTTP Admin Server (Метрики и Управление)

При включенном Admin API вы можете смотреть статусы:

```bash
# Получить общую статистику в JSON
curl -H "Authorization: Bearer <token>" http://localhost:8080/stats

# Экспорт для Prometheus
curl http://localhost:8080/stats?format=prometheus

# Очистить весь кэш
curl -X DELETE http://localhost:8080/cache
```

## Требования

- Node.js >= 20.0
- SQLite3 (Встроен через better-sqlite3)

## Лицензия

MIT.
