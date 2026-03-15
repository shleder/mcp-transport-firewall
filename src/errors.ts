import { HTTP_STATUS, type HttpStatusCode } from "./constants.js";

export class McpOptimizerError extends Error {
  public readonly code: string;
  public readonly statusCode: HttpStatusCode;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: string,
    statusCode: HttpStatusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      ...(this.details !== undefined ? { details: this.details } : {}),
    };
  }
}

export class ConfigurationError extends McpOptimizerError {
  constructor(message: string, details?: unknown) {
    super(message, "CONFIGURATION_ERROR", HTTP_STATUS.UNPROCESSABLE_ENTITY, details);
  }
}

export class InvalidConfigValueError extends ConfigurationError {
  constructor(field: string, value: unknown, expected: string) {
    super(
      `Неверное значение поля конфигурации '${field}': получено ${JSON.stringify(value)}, ожидалось ${expected}`,
      { field, value, expected }
    );
    this.name = "InvalidConfigValueError";
  }
}

export class MissingConfigError extends ConfigurationError {
  constructor(field: string) {
    super(`Обязательное поле конфигурации '${field}' не задано`, { field });
    this.name = "MissingConfigError";
  }
}

export class CacheError extends McpOptimizerError {
  constructor(message: string, code = "CACHE_ERROR", details?: unknown) {
    super(message, code, HTTP_STATUS.INTERNAL_SERVER_ERROR, details);
  }
}

export class CacheReadError extends CacheError {
  constructor(key: string, cause?: unknown) {
    super(`Ошибка чтения из кэша по ключу: ${key}`, "CACHE_READ_ERROR", { key, cause });
    this.name = "CacheReadError";
  }
}

export class CacheWriteError extends CacheError {
  constructor(key: string, cause?: unknown) {
    super(`Ошибка записи в кэш по ключу: ${key}`, "CACHE_WRITE_ERROR", { key, cause });
    this.name = "CacheWriteError";
  }
}

export class CachePayloadTooLargeError extends CacheError {
  constructor(method: string, sizeBytes: number, maxBytes: number) {
    super(
      `Ответ метода '${method}' слишком большой для кэширования: ${sizeBytes} байт > ${maxBytes} байт`,
      "CACHE_PAYLOAD_TOO_LARGE",
      { method, sizeBytes, maxBytes }
    );
    this.name = "CachePayloadTooLargeError";
  }
}

export class CacheSerializationError extends CacheError {
  constructor(operation: "serialize" | "deserialize", cause?: unknown) {
    super(
      `Ошибка ${operation === "serialize" ? "сериализации" : "десериализации"} данных кэша`,
      "CACHE_SERIALIZATION_ERROR",
      { operation, cause }
    );
    this.name = "CacheSerializationError";
  }
}

export class ProxyError extends McpOptimizerError {
  constructor(message: string, code = "PROXY_ERROR", statusCode?: HttpStatusCode, details?: unknown) {
    super(message, code, statusCode ?? HTTP_STATUS.BAD_REQUEST, details);
  }
}

export class InvalidJsonRpcError extends ProxyError {
  constructor(raw: string) {
    super(
      `Получено невалидное JSON-RPC сообщение`,
      "INVALID_JSONRPC",
      HTTP_STATUS.BAD_REQUEST,
      { raw: raw.slice(0, 200) } 
    );
    this.name = "InvalidJsonRpcError";
  }
}

export class TargetServerError extends ProxyError {
  constructor(message: string, exitCode?: number) {
    super(
      `Ошибка целевого MCP-сервера: ${message}`,
      "TARGET_SERVER_ERROR",
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      { exitCode }
    );
    this.name = "TargetServerError";
  }
}

export class TargetServerTimeoutError extends ProxyError {
  constructor(method: string, timeoutMs: number) {
    super(
      `Таймаут ожидания ответа от целевого сервера на метод '${method}' (${timeoutMs}ms)`,
      "TARGET_SERVER_TIMEOUT",
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      { method, timeoutMs }
    );
    this.name = "TargetServerTimeoutError";
  }
}

export class PayloadTooLargeError extends ProxyError {
  constructor(sizeBytes: number, maxBytes: number) {
    super(
      `Входящий payload слишком большой: ${sizeBytes} байт > ${maxBytes} байт`,
      "PAYLOAD_TOO_LARGE",
      HTTP_STATUS.PAYLOAD_TOO_LARGE,
      { sizeBytes, maxBytes }
    );
    this.name = "PayloadTooLargeError";
  }
}

export class CircuitBreakerOpenError extends McpOptimizerError {
  constructor(method: string) {
    super(
      `Circuit Breaker открыт — запросы к целевому серверу временно заблокированы (метод: ${method})`,
      "CIRCUIT_BREAKER_OPEN",
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      { method }
    );
    this.name = "CircuitBreakerOpenError";
  }
}

export class RateLimitExceededError extends McpOptimizerError {
  constructor(limit: number, windowMs: number) {
    super(
      `Превышен лимит запросов: максимум ${limit} запросов за ${windowMs / 1000} секунд`,
      "RATE_LIMIT_EXCEEDED",
      HTTP_STATUS.TOO_MANY_REQUESTS,
      { limit, windowMs }
    );
    this.name = "RateLimitExceededError";
  }
}

export class AdminApiError extends McpOptimizerError {
  constructor(message: string, code = "ADMIN_API_ERROR", statusCode?: HttpStatusCode) {
    super(message, code, statusCode ?? HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export class UnauthorizedError extends AdminApiError {
  constructor() {
    super("Неавторизованный доступ — требуется Bearer токен", "UNAUTHORIZED", HTTP_STATUS.UNAUTHORIZED);
    this.name = "UnauthorizedError";
  }
}

export class NotFoundError extends AdminApiError {
  constructor(resource: string) {
    super(`Ресурс не найден: ${resource}`, "NOT_FOUND", HTTP_STATUS.NOT_FOUND);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AdminApiError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", HTTP_STATUS.UNPROCESSABLE_ENTITY);
    this.name = "ValidationError";
    
    Object.defineProperty(this, "details", { value: details, enumerable: true });
  }
}

export class TransportError extends McpOptimizerError {
  constructor(message: string, details?: unknown) {
    super(message, "TRANSPORT_ERROR", HTTP_STATUS.INTERNAL_SERVER_ERROR, details);
  }
}

export class StdioTransportError extends TransportError {
  constructor(message: string, cause?: unknown) {
    super(`Ошибка stdio транспорта: ${message}`, { cause });
    this.name = "StdioTransportError";
  }
}

export function isOptimizerError(err: unknown): err is McpOptimizerError {
  return err instanceof McpOptimizerError;
}

export function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof McpOptimizerError) {
    return err.toJSON();
  }
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }
  return { raw: String(err) };
}

export function toJsonRpcError(
  id: string | number | null | undefined,
  err: unknown
): {
  jsonrpc: "2.0";
  id: string | number | null;
  error: { code: number; message: string; data?: unknown };
} {
  const jsonId = id ?? null;
  if (err instanceof McpOptimizerError) {
    return {
      jsonrpc: "2.0",
      id: jsonId,
      error: {
        code: err.statusCode,
        message: err.message,
        data: err.details,
      },
    };
  }
  if (err instanceof Error) {
    return {
      jsonrpc: "2.0",
      id: jsonId,
      error: { code: -32603, message: err.message },
    };
  }
  return {
    jsonrpc: "2.0",
    id: jsonId,
    error: { code: -32603, message: "Internal error" },
  };
}
