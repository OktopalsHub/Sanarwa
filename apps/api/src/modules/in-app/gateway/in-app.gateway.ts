import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { OnEvent } from "@nestjs/event-emitter";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({
  namespace: "/in-app",
  cors: { origin: "*" },
  transports: ["websocket"],
})
export class InAppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(InAppGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  afterInit() {
    this.logger.log("In-App WS gateway ready - world-class Novu-style /in-app");
  }

  async handleConnection(client: Socket) {
    try {
      const { token, tenantId, subscriberId, userId } = client.handshake.auth as {
        token?: string;
        tenantId?: string;
        subscriberId?: string;
        userId?: string;
      };
      const sid = subscriberId || userId;
      if (!token || !tenantId || !sid) {
        this.logger.warn(`In-App reject missing auth tenant:${tenantId} sub:${sid}`);
        client.disconnect();
        return;
      }
      try {
        this.jwtService.verify(token);
      } catch {
        this.logger.warn(`In-App JWT invalid for ${sid}`);
        client.disconnect();
        return;
      }
      const rooms = [`tenant:${tenantId}`, `tenant:${tenantId}:user:${sid}`, `tenant:${tenantId}:subscriber:${sid}`];
      await client.join(rooms);
      this.logger.log(`In-App connected ${sid} tenant:${tenantId} rooms:${rooms.join(",")}`);
      client.emit("in-app:connected", { subscriberId: sid, tenantId });
    } catch (error) {
      this.logger.error(`In-App handleConnection failed: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`In-App disconnected ${client.id}`);
  }

  emitToSubscriber(tenantId: string, subscriberId: string, event: string, data: any): boolean {
    const room = `tenant:${tenantId}:user:${subscriberId}`;
    const room2 = `tenant:${tenantId}:subscriber:${subscriberId}`;
    const size1 = this.server.sockets.adapter.rooms.get(room)?.size || 0;
    const size2 = this.server.sockets.adapter.rooms.get(room2)?.size || 0;
    if (size1 + size2 === 0) return false;
    this.server.to(room).to(room2).emit(event, data);
    return true;
  }

  emitToTenant(tenantId: string, event: string, data: any) {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }

  emitToRoom(roomId: string, event: string, data: any) {
    this.server.to(roomId).emit(event, data);
  }

  getRoomSize(room: string): number {
    return this.server.sockets.adapter.rooms.get(room)?.size || 0;
  }

  @OnEvent("in-app.notification.created")
  handleNotificationCreated(payload: { tenantId: string; subscriberId: string; notification: any }) {
    const { tenantId, subscriberId, notification } = payload;
    const delivered = this.emitToSubscriber(tenantId, subscriberId, "notifications:feed:updated", notification);
    // Also emit unseen count bump for bell
    if (delivered) {
      this.server.to(`tenant:${tenantId}:user:${subscriberId}`).to(`tenant:${tenantId}:subscriber:${subscriberId}`).emit("notifications:unseen_count:updated", { feedId: notification.feedId || "default" });
      this.logger.log(`In-App pushed live to ${subscriberId} tenant:${tenantId} id:${notification.id} delivered:${delivered}`);
    } else {
      this.logger.log(`In-App offline for ${subscriberId} tenant:${tenantId} id:${notification.id} - will be in feed poll`);
    }
  }
}
