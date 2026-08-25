import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { WebSocketProvider } from "./providers/websocket.provider";
import { SSEProvider } from "./providers/sse.provider";
import { InAppOrchestratorService } from "./in-app-orchestrator.service";

@Module({
  imports: [ConfigModule],
  providers: [WebSocketProvider, SSEProvider, InAppOrchestratorService],
  exports: [WebSocketProvider, SSEProvider, InAppOrchestratorService],
})
export class InAppModule {}
