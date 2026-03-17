export type MiddlewareContext = {
  rawMessage: string;
  message?: unknown; 
  serverId: string;
  isCached?: boolean;
  rateLimitTokens?: number;
  blocked?: boolean;     // Fail-Closed флаг
  blockReason?: string;  // Причина блокировки
  [key: string]: unknown;
};

export type NextFunction = () => Promise<void>;
export type Middleware = (ctx: MiddlewareContext, next: NextFunction) => Promise<void>;

export class Pipeline {
  private middlewares: Middleware[] = [];

  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  async execute(ctx: MiddlewareContext): Promise<void> {
    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error("next() called multiple times");
      index = i;

      let fn = this.middlewares[i];
      if (!fn) return; 

      try {
        await fn(ctx, dispatch.bind(null, i + 1));
      } catch (err) {
        // Fail-Closed логика: блокируем выполнение при любой ошибке в middleware
        ctx.blocked = true;
        ctx.blockReason = err instanceof Error ? `Fail-Closed: Ошибка в middleware: ${err.message}` : "Fail-Closed: Неизвестная ошибка в middleware";
        throw err; // Проброс ошибки для обработки выше по стеку, если необходимо
      }
    };

    return dispatch(0);
  }
}
