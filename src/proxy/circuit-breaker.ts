import { CircuitBreakerOpenError } from "../errors.js";
import type { CircuitBreakerConfig } from "../config/schema.js";
import { logger } from "../logger.js";
import { nowMs } from "../utils/time.js";

export enum CircuitState {
  CLOSED,   
  OPEN,     
  HALF_OPEN 
}

export class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private nextAttemptMs = 0;

  constructor(private readonly config: CircuitBreakerConfig) {}

  check(method: string): void {
    if (!this.config.enabled) return;

    if (this.state === CircuitState.OPEN) {
      if (nowMs() >= this.nextAttemptMs) {
        
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        
        throw new CircuitBreakerOpenError(method);
      }
    }
  }

  onSuccess(): void {
    if (!this.config.enabled) return;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        
        this.transitionTo(CircuitState.CLOSED);
      }
    } else if (this.state === CircuitState.CLOSED) {
      
      this.failureCount = 0;
    }
  }

  onFailure(): void {
    if (!this.config.enabled) return;

    if (this.state === CircuitState.HALF_OPEN) {
      
      this.transitionTo(CircuitState.OPEN);
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount++;
      if (this.failureCount >= this.config.failureThreshold) {
        
        this.transitionTo(CircuitState.OPEN);
      }
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    switch (newState) {
      case CircuitState.CLOSED:
        this.failureCount = 0;
        this.successCount = 0;
        logger.info("🔌 Circuit Breaker: CLOSED (сервер восстановлен, трафик разрешён)");
        break;
      case CircuitState.OPEN:
        this.nextAttemptMs = nowMs() + this.config.timeoutMs;
        logger.error(
          `🔌 Circuit Breaker: OPEN (сервер недоступен, трафик заблокирован на ${
            Math.round(this.config.timeoutMs / 1000)
          }s)`
        );
        break;
      case CircuitState.HALF_OPEN:
        logger.warn("🔌 Circuit Breaker: HALF_OPEN (пробный пропуск запросов для проверки)");
        break;
    }
  }
}
