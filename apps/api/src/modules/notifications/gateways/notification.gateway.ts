import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NotificationCenterService } from '../services/notification-center.service';
import { OnEvent } from '@nestjs/event-emitter';

interface AuthenticatedSocket extends Socket {
  subscriberId?: string;
  tenantId?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private readonly connectedClients = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly notificationService: NotificationCenterService,
  ) {}

  /**
   * Handle client connection
   */
  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        this.logger.warn('Connection attempt without token');
        client.disconnect();
        return;
      }

      // Verify JWT token
      const decoded = this.jwtService.verify(token);
      client.subscriberId = decoded.sub;
      client.tenantId = decoded.tenantId;

      // Join subscriber-specific room
      const room = `subscriber:${decoded.sub}`;
      client.join(room);

      // Track connected client
      if (!this.connectedClients.has(decoded.sub)) {
        this.connectedClients.set(decoded.sub, new Set());
      }
      this.connectedClients.get(decoded.sub)!.add(client.id);

      this.logger.log(
        `Client connected: ${client.id} (subscriber: ${decoded.sub})`,
      );

      // Send connection confirmation
      client.emit('connected', {
        message: 'Connected to notification service',
        subscriberId: decoded.sub,
        timestamp: new Date(),
      });

      // Send unread count
      const unreadCount = await this.notificationService.getUnreadCount(
        decoded.sub,
        decoded.tenantId,
      );
      client.emit('unread_count', { count: unreadCount });
    } catch (error) {
      this.logger.error('Connection error', error);
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: AuthenticatedSocket) {
    if (client.subscriberId) {
      const clients = this.connectedClients.get(client.subscriberId);
      if (clients) {
        clients.delete(client.id);
        if (clients.size === 0) {
          this.connectedClients.delete(client.subscriberId);
        }
      }

      this.logger.log(
        `Client disconnected: ${client.id} (subscriber: ${client.subscriberId})`,
      );
    }
  }

  /**
   * Get notification feed
   */
  @SubscribeMessage('get_notifications')
  async handleGetNotifications(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { page?: number; limit?: number; status?: string },
  ) {
    try {
      if (!client.subscriberId || !client.tenantId) {
        return { error: 'Unauthorized' };
      }

      const feed = await this.notificationService.getNotificationFeed(
        client.subscriberId,
        client.tenantId,
        data.page || 1,
        data.limit || 20,
        data.status as any,
      );

      return { success: true, data: feed };
    } catch (error) {
      this.logger.error('Error getting notifications', error);
      return { error: error.message };
    }
  }

  /**
   * Mark notification as read
   */
  @SubscribeMessage('mark_as_read')
  async handleMarkAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { notificationId: string },
  ) {
    try {
      if (!client.subscriberId) {
        return { error: 'Unauthorized' };
      }

      const notification = await this.notificationService.markAsRead(
        data.notificationId,
      );

      // Broadcast to all client connections
      const room = `subscriber:${client.subscriberId}`;
      this.server.to(room).emit('notification_read', {
        notificationId: data.notificationId,
        timestamp: new Date(),
      });

      return { success: true, data: notification };
    } catch (error) {
      this.logger.error('Error marking notification as read', error);
      return { error: error.message };
    }
  }

  /**
   * Mark all notifications as read
   */
  @SubscribeMessage('mark_all_as_read')
  async handleMarkAllAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      if (!client.subscriberId || !client.tenantId) {
        return { error: 'Unauthorized' };
      }

      await this.notificationService.markAllAsRead(
        client.subscriberId,
        client.tenantId,
      );

      // Broadcast to all client connections
      const room = `subscriber:${client.subscriberId}`;
      this.server.to(room).emit('all_marked_as_read', {
        timestamp: new Date(),
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Error marking all as read', error);
      return { error: error.message };
    }
  }

  /**
   * Archive notification
   */
  @SubscribeMessage('archive_notification')
  async handleArchiveNotification(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { notificationId: string },
  ) {
    try {
      if (!client.subscriberId) {
        return { error: 'Unauthorized' };
      }

      const notification = await this.notificationService.archiveNotification(
        data.notificationId,
      );

      const room = `subscriber:${client.subscriberId}`;
      this.server.to(room).emit('notification_archived', {
        notificationId: data.notificationId,
        timestamp: new Date(),
      });

      return { success: true, data: notification };
    } catch (error) {
      this.logger.error('Error archiving notification', error);
      return { error: error.message };
    }
  }

  /**
   * Delete notification
   */
  @SubscribeMessage('delete_notification')
  async handleDeleteNotification(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { notificationId: string },
  ) {
    try {
      if (!client.subscriberId) {
        return { error: 'Unauthorized' };
      }

      await this.notificationService.deleteNotification(data.notificationId);

      const room = `subscriber:${client.subscriberId}`;
      this.server.to(room).emit('notification_deleted', {
        notificationId: data.notificationId,
        timestamp: new Date(),
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Error deleting notification', error);
      return { error: error.message };
    }
  }

  /**
   * Search notifications
   */
  @SubscribeMessage('search_notifications')
  async handleSearchNotifications(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: { query: string; page?: number; limit?: number },
  ) {
    try {
      if (!client.subscriberId || !client.tenantId) {
        return { error: 'Unauthorized' };
      }

      const results = await this.notificationService.searchNotifications(
        client.subscriberId,
        client.tenantId,
        data.query,
        data.page || 1,
        data.limit || 20,
      );

      return { success: true, data: results };
    } catch (error) {
      this.logger.error('Error searching notifications', error);
      return { error: error.message };
    }
  }

  /**
   * Get statistics
   */
  @SubscribeMessage('get_stats')
  async handleGetStats(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      if (!client.subscriberId || !client.tenantId) {
        return { error: 'Unauthorized' };
      }

      const stats = await this.notificationService.getStats(
        client.subscriberId,
        client.tenantId,
      );

      return { success: true, data: stats };
    } catch (error) {
      this.logger.error('Error getting stats', error);
      return { error: error.message };
    }
  }

  /**
   * Event listener: New notification added
   */
  @OnEvent('notification.created')
  async handleNotificationCreated(payload: {
    subscriberId: string;
    notification: any;
  }) {
    const room = `subscriber:${payload.subscriberId}`;

    // Broadcast to all connected clients for this subscriber
    this.server.to(room).emit('new_notification', {
      notification: payload.notification,
      timestamp: new Date(),
    });

    // Update unread count
    const unreadCount = await this.notificationService.getUnreadCount(
      payload.subscriberId,
      payload.notification.tenantId,
    );

    this.server.to(room).emit('unread_count', { count: unreadCount });

    this.logger.log(
      `Notification broadcast to ${room}: ${payload.notification.id}`,
    );
  }

  /**
   * Event listener: Bulk notifications added
   */
  @OnEvent('notifications.bulk_created')
  async handleBulkNotificationsCreated(payload: {
    subscriberIds: string[];
    notifications: any[];
  }) {
    for (const subscriberId of payload.subscriberIds) {
      const room = `subscriber:${subscriberId}`;

      // Broadcast to all connected clients
      this.server.to(room).emit('bulk_notifications', {
        notifications: payload.notifications,
        count: payload.notifications.length,
        timestamp: new Date(),
      });

      // Update unread count
      if (payload.notifications.length > 0) {
        const unreadCount = await this.notificationService.getUnreadCount(
          subscriberId,
          payload.notifications[0].tenantId,
        );

        this.server.to(room).emit('unread_count', { count: unreadCount });
      }
    }
  }

  /**
   * Broadcast notification to subscriber
   */
  broadcastToSubscriber(
    subscriberId: string,
    event: string,
    data: any,
  ): void {
    const room = `subscriber:${subscriberId}`;
    this.server.to(room).emit(event, {
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * Get connected clients count for subscriber
   */
  getConnectedClientsCount(subscriberId: string): number {
    return this.connectedClients.get(subscriberId)?.size || 0;
  }

  /**
   * Check if subscriber is online
   */
  isSubscriberOnline(subscriberId: string): boolean {
    return this.connectedClients.has(subscriberId);
  }
}
