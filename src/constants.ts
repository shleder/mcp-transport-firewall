
export const VERSION = "1.0.0" as const;
export const PACKAGE_NAME = "mcp-context-optimizer" as const;

export const CACHEABLE_METHODS = new Set<string>([
  "tools/call",
  "resources/read",
  "resources/list",
  "tools/list",
  "prompts/get",
  "prompts/list",
]);

export const PASSTHROUGH_METHODS = new Set<string>([
  "initialize",
  "initialized",
  "ping",
  "notifications/initialized",
  "notifications/progress",
  "notifications/message",
  "notifications/resources/updated",
  "notifications/resources/list_changed",
  "notifications/tools/list_changed",
  "notifications/prompts/list_changed",
  "completion/complete",
  "logging/setLevel",
  "roots/list",
  "sampling/createMessage",
]);

export const NEVER_CACHE_METHODS = new Set<string>([
  "sampling/createMessage",
  "roots/list",
  "logging/setLevel",
  "completion/complete",
]);

export const JSON_RPC_VERSION = "2.0" as const;

export const BYTES_PER_KB = 1_024;
export const BYTES_PER_MB = 1_024 * 1_024;

export const DEFAULT_MAX_RESPONSE_BYTES = 5 * BYTES_PER_MB;

export const STDIO_BUFFER_SIZE = 64 * BYTES_PER_KB;

export const DEFAULT_CACHE_DIR = ".mcp-cache" as const;
export const DEFAULT_CACHE_DB_NAME = "cache.db" as const;
export const DEFAULT_CACHE_TTL_SECONDS = 3_600; 
export const DEFAULT_L1_MAX_ITEMS = 500;
export const DEFAULT_L1_MAX_SIZE_BYTES = 50 * BYTES_PER_MB; 
export const DEFAULT_CLEANUP_INTERVAL_MS = 10 * 60 * 1_000; 

export const CHARS_PER_TOKEN = 4;

export const DEFAULT_ADMIN_PORT = 9090;
export const DEFAULT_ADMIN_HOST = "127.0.0.1" as const;
export const ADMIN_API_VERSION = "v1" as const;
export const ADMIN_API_PREFIX = `/api/${ADMIN_API_VERSION}` as const;

export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000; 
export const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 1_000;

export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_RETRY_DELAY_MS = 100;
export const DEFAULT_RETRY_BACKOFF_FACTOR = 2;
export const DEFAULT_RETRY_MAX_DELAY_MS = 5_000;

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000; 
export const DEFAULT_CONNECTION_TIMEOUT_MS = 5_000;

export const DEFAULT_CB_FAILURE_THRESHOLD = 5;
export const DEFAULT_CB_SUCCESS_THRESHOLD = 2;
export const DEFAULT_CB_TIMEOUT_MS = 60_000; 

export const METRICS_FLUSH_INTERVAL_MS = 5_000; 

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatusCode = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

export const MIME_JSON = "application/json" as const;
export const MIME_TEXT = "text/plain" as const;
export const MIME_PROMETHEUS = "text/plain; version=0.0.4" as const;

export const HEADER_CONTENT_TYPE = "Content-Type" as const;
export const HEADER_AUTHORIZATION = "Authorization" as const;
export const HEADER_X_REQUEST_ID = "X-Request-ID" as const;
export const HEADER_X_RESPONSE_TIME = "X-Response-Time" as const;
export const HEADER_X_CACHE = "X-Cache" as const;

export const ENV_KEYS = {
  CACHE_DIR: "CACHE_DIR",
  CACHE_TTL_SECONDS: "CACHE_TTL_SECONDS",
  L1_MAX_ITEMS: "L1_MAX_ITEMS",
  MAX_RESPONSE_BYTES: "MAX_RESPONSE_BYTES",
  VERBOSE: "VERBOSE",
  ADMIN_ENABLED: "ADMIN_ENABLED",
  ADMIN_PORT: "ADMIN_PORT",
  ADMIN_HOST: "ADMIN_HOST",
  ADMIN_TOKEN: "ADMIN_TOKEN",
  MAX_RETRIES: "MAX_RETRIES",
  REQUEST_TIMEOUT_MS: "REQUEST_TIMEOUT_MS",
  RATE_LIMIT_MAX: "RATE_LIMIT_MAX",
  RATE_LIMIT_WINDOW_MS: "RATE_LIMIT_WINDOW_MS",
  COMPRESS_CACHE: "COMPRESS_CACHE",
  CB_ENABLED: "CB_ENABLED",
  CB_FAILURE_THRESHOLD: "CB_FAILURE_THRESHOLD",
  METRICS_ENABLED: "METRICS_ENABLED",
} as const;

export type EnvKey = (typeof ENV_KEYS)[keyof typeof ENV_KEYS];

export const DB_TABLE_CACHE = "cache_entries" as const;
export const DB_TABLE_STATS = "cache_stats" as const;

export const EVENTS = {
  CACHE_HIT: "cache:hit",
  CACHE_MISS: "cache:miss",
  CACHE_SET: "cache:set",
  CACHE_EVICT: "cache:evict",
  CACHE_EXPIRE: "cache:expire",
  PROXY_REQUEST: "proxy:request",
  PROXY_RESPONSE: "proxy:response",
  PROXY_ERROR: "proxy:error",
  CB_OPEN: "circuit_breaker:open",
  CB_CLOSE: "circuit_breaker:close",
  CB_HALF_OPEN: "circuit_breaker:half_open",
  RATE_LIMIT_EXCEEDED: "rate_limit:exceeded",
  ADMIN_REQUEST: "admin:request",
  SERVER_START: "server:start",
  SERVER_STOP: "server:stop",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
