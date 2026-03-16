import { ChildProcess, spawn } from "node:child_process";
import { resolve } from "node:path";
import type { ProxyConfig } from "../config/schema.js";
import { CacheManager } from "../cache/manager.js";
import type { CacheGetResult } from "../cache/manager.js";
import { CircuitBreaker } from "./circuit-breaker.js";
import { ResponseInterceptor } from "./interceptor.js";
import { InFlightDeduplicator } from "../utils/async.js";
import { buildServerId } from "../cache/key-builder.js";
import { logger } from "../logger.js";
import { withProxyRetry } from "./retry.js";
import { withProxyTimeout } from "./timeout.js";
import {
  parseIncomingMessage,
  formatOutgoingMessage,
  buildRpcSuccessResponse,
  buildRpcErrorResponse
} from "./transformer.js";
import { isPassthroughMessage } from "./passthrough.js";
import { nowMs, elapsed, hrNow } from "../utils/time.js";
import { TargetServerError } from "../errors.js";
import { createFirewall, type FirewallEvaluator } from "../middleware/firewall.js";

interface DeferredTargetResponse {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

export class ProxyEngine {
  private targetProcess: ChildProcess | null = null;
  private stdoutBuffer = "";
  private serverId: string;
  private isShuttingDown = false;

  public readonly cacheManager: CacheManager;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly interceptor: ResponseInterceptor;
  private readonly inFlightDeduplicator = new InFlightDeduplicator<unknown>();
  private readonly firewall: FirewallEvaluator;

  private readonly pendingTargetCalls = new Map<string | number, DeferredTargetResponse>();

  constructor(private readonly config: ProxyConfig) {
    this.cacheManager = new CacheManager(config);
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
    this.interceptor = new ResponseInterceptor();
    this.serverId = buildServerId(config.target.command, config.target.args);
    this.firewall = createFirewall();

    setInterval(() => {
      this.interceptor.cleanupStaleRequests(config.timeout.requestMs * 2);
    }, 60000).unref();

    process.on("exit", () => {
      if (this.targetProcess) {
        try {
          this.targetProcess.kill("SIGKILL");
        } catch { }
      }
    });
  }

  async start(): Promise<void> {
    await this.cacheManager.init();
    this.spawnTarget();
  }

  async handleClientMessage(rawClientMessage: string): Promise<void> {
    const receiveHr = hrNow();
    let message: unknown;

    try {
      message = parseIncomingMessage(rawClientMessage);
    } catch (err) {
      this.sendToClientRaw(buildRpcErrorResponse(null, -32700, "Parse error"));
      return;
    }

    if (isPassthroughMessage(message)) {
      this.sendToTargetRaw(rawClientMessage);
      return;
    }

    const req = message as { jsonrpc: string; id: string | number; method: string; params?: Record<string, unknown> };

    const firewallDecision = this.firewall(req.method, req.params);
    if (firewallDecision.blocked) {
      this.sendToClientRaw(buildRpcErrorResponse(
        req.id,
        -32001,
        `[MCP Firewall] Request blocked by rule '${firewallDecision.ruleName}': ${firewallDecision.reason}`
      ));
      return;
    }

    try {
      const cacheResult = await this.cacheManager.get(this.serverId, req.method, req.params);
      
      if (cacheResult.hit) {
        
        this.sendToClientRaw(buildRpcSuccessResponse(req.id, cacheResult.data));
        return;
      }
    } catch (err) {
      logger.error("Error reading from cache. Falling back to real server.", err);
    }

    const dedupKey = `${this.serverId}::${req.method}::${JSON.stringify(req.params)}`;
    
    try {
      const targetResponse = await this.inFlightDeduplicator.execute(dedupKey, () => {
        return this.executeOnTargetWithPolicies(req);
      });

      this.sendToClientRaw(buildRpcSuccessResponse(req.id, targetResponse));

      this.cacheManager.set({
        serverId: this.serverId,
        method: req.method,
        params: req.params,
        result: targetResponse
      }).catch(err => logger.error("Background Cache Set Error:", err));

    } catch (err) {

      let code = -32603; 
      let msg = err instanceof Error ? err.message : String(err);
      let data: unknown;

      if (typeof err === "object" && err !== null && "rpcCode" in err) {
        code = (err as any).rpcCode;
        msg = (err as any).message;
        data = (err as any).data;

        this.cacheManager.set({
           serverId: this.serverId,
           method: req.method,
           params: req.params,
           result: undefined,
           error: { code, message: msg }
        }).catch(e => logger.error("Background Error Cache Set:", e));
      } else if (err instanceof Error && err.name === "CircuitBreakerOpenError") {
        code = -32000;
        msg = "Target server is unavailable (Circuit Breaker Open)";
      } else if (err instanceof TargetServerError) {
        code = -32001;
      }

      this.sendToClientRaw(buildRpcErrorResponse(req.id, code, msg, data));
    }
  }

  private async executeOnTargetWithPolicies(
    req: { id: string | number; method: string; params?: Record<string, unknown> }
  ): Promise<unknown> {

    this.circuitBreaker.check(req.method);

    const operation = async () => {
       
       return new Promise<unknown>((resolve, reject) => {
         this.pendingTargetCalls.set(req.id, { resolve, reject });

         this.interceptor.registerPending({
           id: req.id,
           method: req.method,
           timestampMs: nowMs()
         });

         this.sendToTargetRaw(JSON.stringify(req));
       });
    };

    try {
      
      const result = await withProxyRetry(
        req.method,
        this.config.retry,
        () => withProxyTimeout(req.method, this.config.timeout, operation)
      );
      
      this.circuitBreaker.onSuccess();
      return result;

    } catch (err) {
      this.circuitBreaker.onFailure();

      this.interceptor.removePending(req.id);
      this.pendingTargetCalls.delete(req.id);

      throw err;
    }
  }

  private spawnTarget(): void {
    if (this.isShuttingDown) return;

    logger.info(`🚀 Starting target server: ${this.config.target.command} ${this.config.target.args.join(" ")}`);
    
    this.targetProcess = spawn(this.config.target.command, this.config.target.args, {
      cwd: this.config.target.cwd ? resolve(this.config.target.cwd) : process.cwd(),
      env: { ...process.env, ...this.config.target.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.targetProcess.on("error", (err) => {
      logger.error(`❌ Failed to start target server:`, err);
    });

    this.targetProcess.stdout?.on("data", (chunk: Buffer) => {
      this.stdoutBuffer += chunk.toString("utf8");
      let newlineIndex;
      while ((newlineIndex = this.stdoutBuffer.indexOf("\n")) !== -1) {
        const msg = this.stdoutBuffer.slice(0, newlineIndex).trim();
        this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);

        if (msg.length === 0) continue;

        let parsed: unknown;
        try {
           parsed = JSON.parse(msg);
        } catch {
           logger.error("Target Server returned invalid JSON: " + msg.slice(0, 100));
           continue;
        }

        const { req, isPassthrough } = this.interceptor.processTargetMessage(parsed);

        if (isPassthrough) {
          this.sendToClientRaw(parsed);
        } else if (req) {
          const response = parsed as { result?: unknown, error?: { code: number, message: string, data?: unknown } };
          const deferred = this.pendingTargetCalls.get(req.id);
          
          if (deferred) {
            this.pendingTargetCalls.delete(req.id);
            this.interceptor.removePending(req.id);

            if (response.error) {
               const errObj = new Error(response.error.message);
               Object.assign(errObj, { rpcCode: response.error.code, data: response.error.data });
               deferred.reject(errObj);
            } else {
               deferred.resolve(response.result);
            }
          }
        }
      }
    });

    this.targetProcess.stderr?.on("data", (chunk: Buffer) => {
      const logs = chunk.toString("utf8").trim();
      if (logs) {
        if (this.config.verbose) {
           process.stderr.write(`[Target STDERR] ${logs}\n`);
        }
      }
    });

    this.targetProcess.on("close", (code) => {
      logger.warn(`⚠ Target server exited with code ${code}. Restarting in 3 seconds...`);
      this.targetProcess = null;
      if (!this.isShuttingDown) {
        setTimeout(() => this.spawnTarget(), 3000);
      }
    });
  }

  private sendToTargetRaw(rawOrObj: string | unknown): void {
    if (!this.targetProcess || !this.targetProcess.stdin || !this.targetProcess.stdin.writable) {
       logger.warn("Attempted to send to target server, but pipe is not available.");
       return;
    }
    const str = typeof rawOrObj === "string" ? rawOrObj : JSON.stringify(rawOrObj);
    this.targetProcess.stdin.write(str + "\n");
  }

  private sendToClientRaw(obj: unknown): void {
    process.stdout.write(JSON.stringify(obj) + "\n");
  }

  async close(): Promise<void> {
    this.isShuttingDown = true;
    logger.info("🛑 Shutting down Proxy Engine...");
    
    if (this.targetProcess) {
      this.targetProcess.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        if (!this.targetProcess) return resolve();
        this.targetProcess.on("close", resolve);
        
        setTimeout(() => {
          this.targetProcess?.kill("SIGKILL");
          resolve();
        }, 5000);
      });
    }

    await this.cacheManager.close();
  }
}
