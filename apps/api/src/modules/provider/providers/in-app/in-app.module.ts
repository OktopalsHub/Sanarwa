import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { TypeOrmModule } from "@nestjs/typeorm";
import { InAppNotification } from "../../../messaging/entities/in-app-notification.entity";
import { WebSocketProvider } from "./providers/websocket.provider";
import { SSEProvider } from "./providers/sse.provider";
import { InAppOrchestratorService } from "./in-app-orchestrator.service";

@Module({
  imports: [ConfigModule, EventEmitterModule, TypeOrmModule.forFeature([InAppNotification])],
  providers: [WebSocketProvider, SSEProvider, InAppOrchestratorService],
  exports: [WebSocketProvider, SSEProvider, InAppOrchestratorService],
})
export class InAppModule {}
