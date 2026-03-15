import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CircuitBreaker, CircuitState } from "../src/proxy/circuit-breaker.js";
import { CircuitBreakerOpenError } from "../src/errors.js";
import * as timeUtils from "../src/utils/time.js";

describe("CircuitBreaker", () => {
  const config = {
    enabled: true,
    failureThreshold: 3,
    successThreshold: 2,
    timeoutMs: 5000,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(timeUtils, "nowMs").mockImplementation(() => Date.now());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should not do anything if disabled", () => {
    const cb = new CircuitBreaker({ ...config, enabled: false });
    cb.onFailure();
    cb.onFailure();
    cb.onFailure();
    expect(() => cb.check("test")).not.toThrow();
  });

  it("should open circuit after failureThreshold is reached", () => {
    const cb = new CircuitBreaker(config);
    cb.onFailure();
    cb.onFailure();
    
    expect(() => cb.check("test")).not.toThrow();
    
    cb.onFailure();
    
    expect(() => cb.check("test")).toThrowError(CircuitBreakerOpenError);
  });

  it("should transition to HALF_OPEN after timeoutMs", () => {
    const cb = new CircuitBreaker(config);
    cb.onFailure();
    cb.onFailure();
    cb.onFailure();
    
    expect(() => cb.check("test")).toThrowError();
    
    vi.advanceTimersByTime(5001);
    
    expect(() => cb.check("test")).not.toThrow();
  });

  it("should reset failures on success when CLOSED", () => {
    const cb = new CircuitBreaker(config);
    cb.onFailure();
    cb.onFailure();
    
    cb.onSuccess();
    
    cb.onFailure();
    cb.onFailure();
    expect(() => cb.check("test")).not.toThrow();
  });

  it("should transition to CLOSED after successThreshold hits in HALF_OPEN", () => {
    const cb = new CircuitBreaker(config);
    cb.onFailure(); cb.onFailure(); cb.onFailure();
    
    vi.advanceTimersByTime(5001);
    
    cb.check("test"); // Transitions to HALF_OPEN internally
    
    cb.onSuccess(); // 1
    cb.onSuccess(); // 2 -> CLOSED
    
    cb.onFailure();
    cb.onFailure();
    expect(() => cb.check("test")).not.toThrow();
  });

  it("should transition back to OPEN if failure occurs in HALF_OPEN", () => {
    const cb = new CircuitBreaker(config);
    cb.onFailure(); cb.onFailure(); cb.onFailure(); // OPEN
    
    vi.advanceTimersByTime(5001);
    cb.check("test"); // HALF_OPEN
    
    cb.onFailure(); // OPEN again
    
    expect(() => cb.check("test")).toThrowError();
  });

  it("should limit concurrent requests in HALF_OPEN state (bounded probes)", () => {
    const cb = new CircuitBreaker(config);
    cb.onFailure(); cb.onFailure(); cb.onFailure(); // OPEN
    
    vi.advanceTimersByTime(5001);
    
    // First request triggers HALF_OPEN and uses 1 probe
    cb.check("test1"); 
    
    // Second request uses 2nd probe (successThreshold is 2)
    cb.check("test2");
    
    // Third request should be blocked because successThreshold is 2
    expect(() => cb.check("test3")).toThrowError(CircuitBreakerOpenError);
  });
});
