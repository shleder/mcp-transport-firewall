import { auditLog } from '../utils/auditLogger.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxCalls: number;
}

export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: number | null;
  lastSuccess: number | null;
  totalCalls: number;
}

export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

export interface CircuitBreaker {
  getState: () => CircuitState;
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
  reset: () => void;
  getStats: () => CircuitBreakerStats;
}

export const createCircuitBreaker = (config: CircuitBreakerConfig): CircuitBreaker => {
  const { name, failureThreshold, resetTimeoutMs, halfOpenMaxCalls } = config;
  let state: CircuitState = 'CLOSED';
  let failures = 0;
  let successes = 0;
  let lastFailure: number | null = null;
  let lastSuccess: number | null = null;
  let halfOpenCalls = 0;
  let openedAt: number | null = null;

  const getState = (): CircuitState => {
    if (state === 'OPEN') {
      if (openedAt && Date.now() - openedAt > resetTimeoutMs) {
        state = 'HALF_OPEN';
        halfOpenCalls = 0;
        auditLog('CIRCUIT_HALF_OPEN', { name });
      }
    }
    return state;
  };

  const onSuccess = (): void => {
    successes++;
    lastSuccess = Date.now();

    if (state === 'HALF_OPEN') {
      state = 'CLOSED';
      failures = 0;
      halfOpenCalls = 0;
      auditLog('CIRCUIT_CLOSED', { name });
    }
  };

  const onFailure = (): void => {
    failures++;
    lastFailure = Date.now();

    if (failures >= failureThreshold) {
      state = 'OPEN';
      openedAt = Date.now();
      auditLog('CIRCUIT_OPENED', {
        name,
        failures,
        threshold: failureThreshold,
      });
    }
  };

  return {
    getState,

    execute: async <T>(fn: () => Promise<T>): Promise<T> => {
      const currentState = getState();

      if (currentState === 'OPEN') {
        throw new CircuitOpenError(`Circuit '${name}' is OPEN. Failure threshold: ${failureThreshold}`);
      }

      if (currentState === 'HALF_OPEN') {
        if (halfOpenCalls >= halfOpenMaxCalls) {
          throw new CircuitOpenError(`Circuit '${name}' is in HALF_OPEN state with max calls reached.`);
        }
        halfOpenCalls++;
      }

      try {
        const result = await fn();
        onSuccess();
        return result;
      } catch (error) {
        onFailure();
        throw error;
      }
    },

    reset: (): void => {
      state = 'CLOSED';
      failures = 0;
      successes = 0;
      lastFailure = null;
      lastSuccess = null;
      halfOpenCalls = 0;
      openedAt = null;
      auditLog('CIRCUIT_RESET', { name });
    },

    getStats: (): CircuitBreakerStats => {
      return {
        name,
        state: getState(),
        failures,
        successes,
        lastFailure,
        lastSuccess,
        totalCalls: failures + successes,
      };
    },
  };
};

const circuitBreakers = new Map<string, CircuitBreaker>();

export const getOrCreateCircuitBreaker = (config: CircuitBreakerConfig): CircuitBreaker => {
  const existing = circuitBreakers.get(config.name);
  if (existing) return existing;

  const cb = createCircuitBreaker(config);
  circuitBreakers.set(config.name, cb);
  return cb;
};

export const getCircuitBreaker = (name: string): CircuitBreaker | undefined => {
  return circuitBreakers.get(name);
};

export const removeCircuitBreaker = (name: string): boolean => {
  return circuitBreakers.delete(name);
};

export const getAllCircuitBreakerStats = (): CircuitBreakerStats[] => {
  return Array.from(circuitBreakers.values()).map(cb => cb.getStats());
};
