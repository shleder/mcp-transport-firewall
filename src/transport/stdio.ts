import { logger } from "../logger.js";
import type { ProxyEngine } from "../proxy/engine.js";

export class StdioTransport {
  constructor(private readonly engine: ProxyEngine) {}

  start(): void {
    logger.info("📡 StdioTransport: Ожидание сообщений на stdin...");

    process.stdin.setEncoding("utf8");

    let buffer = "";

    process.stdin.on("data", (chunk: string) => {
      buffer += chunk;

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (line) {
          this.handleIncomingLine(line);
        }
      }
    });

    process.stdin.on("end", () => {
      logger.info("📡 StdioTransport: Клиент закрыл соединение (EOF). Завершение работы...");
      this.engine.close().finally(() => process.exit(0));
    });

    process.stdin.on("error", (err) => {
      logger.error("❌ StdioTransport: Ошибка чтения stdin", err);
    });
  }

  private handleIncomingLine(line: string): void {

    this.engine.handleClientMessage(line).catch(err => {
      logger.error("❌ Ошибка при обработке сообщения от клиента:", err);
    });
  }
}
