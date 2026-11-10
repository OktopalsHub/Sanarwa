import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
  Logger,
} from "@nestjs/common";
import { McpExecutionContext } from "@nestjs/mcp";
import { performance } from "node:perf_hooks";
import { tap, type Observable } from "rxjs";

@Injectable()
export class McpCallLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("MCP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<string>() !== "mcp") {
      return next.handle();
    }

    const mcp = McpExecutionContext.create(context);
    const started = performance.now();

    return next
      .handle()
      .pipe(
        tap(() =>
          this.logger.log(
            `${mcp.getKind()} ${mcp.getName()} took ${Math.round(performance.now() - started)} ms`,
          ),
        ),
      );
  }
}
