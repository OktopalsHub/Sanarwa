import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { getPaginationSummary } from '../../common/dto/pagination.dto';
import { IPaginatedData } from '../../common/interfaces';
import { BulkMessageDto, SendMessageDto } from './dto/send-message.dto';
import { MessageStatus } from './message.entity';
import { MessageDeliveryRepository, MessageRepository } from './repositories';
import { DigestService, DigestNotification } from './services/digest.service';
import { SchedulingService, ScheduleConfig } from './services/scheduling.service';
import { NotificationEngineService } from '../notifications/engine/notification-engine.service';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly messageDeliveryRepository: MessageDeliveryRepository,
    private readonly digestService: DigestService,
    private readonly schedulingService: SchedulingService,
    private readonly notificationEngine: NotificationEngineService,
  ) { }

  /**
   * Filter recipients based on subscriber preferences
   */
  private async filterRecipientsByPreferences(
    recipients: any[],
    channels: string[],
    tenantId: string,
  ): Promise<any[]> {
    const filteredRecipients: any[] = [];

    for (const recipient of recipients) {
      const subscriberId = recipient.subscriberId || recipient.userId;
      
      if (!subscriberId) {
        // No subscriber ID, include recipient
        filteredRecipients.push(recipient);
        continue;
      }

      // Transport system: include all recipients without preference checking
      filteredRecipients.push(recipient);
    }

    return filteredRecipients;
  }

  /**
   * Filter channels based on subscriber preferences
   */
  private async filterChannelsByPreferences(
    channels: string[],
    subscriberId: string,
    tenantId: string,
  ): Promise<string[]> {
    // Transport system: return all channels without preference checking
    return channels;
  }

  async sendMessage(sendMessageDto: SendMessageDto, tenantId?: string) {
    const metadata = {
      ...sendMessageDto.metadata,
      ...(sendMessageDto.brandId && { brandId: sendMessageDto.brandId }),
    };

    const filteredRecipients = await this.filterRecipientsByPreferences(
      sendMessageDto.recipients,
      sendMessageDto.channels,
      tenantId || 'default',
    );

    if (filteredRecipients.length === 0) {
      this.logger.warn(
        'No recipients passed preference filters for channels: ' +
          sendMessageDto.channels.join(', '),
      );
      return {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        status: MessageStatus.FAILED,
        channels: sendMessageDto.channels,
        recipientCount: 0,
        deliveries: [],
        createdAt: new Date(),
        message: 'No recipients passed preference filters',
      };
    }

    return this.notificationEngine.sendMessagingRequest({
      tenantId: tenantId || 'default',
      projectId:
        (sendMessageDto.metadata?.projectId as string | undefined) ??
        tenantId ??
        'default',
      channels: sendMessageDto.channels,
      recipients: filteredRecipients,
      subject: sendMessageDto.subject,
      content: sendMessageDto.content,
      data: sendMessageDto.data,
      templateId: sendMessageDto.templateId,
      priority: sendMessageDto.priority,
      brandId: sendMessageDto.brandId,
      scheduledAt: sendMessageDto.scheduledAt,
      metadata,
    });
  }

  async sendBulkMessages(bulkMessageDto: BulkMessageDto, tenantId?: string) {
    const results: any[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const messageDto of bulkMessageDto.messages) {
      try {
        const result = await this.sendMessage(messageDto, tenantId);
        results.push(result);
        successCount++;
      } catch (error) {
        failedCount++;
        this.logger.error('Failed to send message in bulk:', error.message, {
          error: error.stack,
          messageIndex: bulkMessageDto.messages.indexOf(messageDto),
          batchId: bulkMessageDto.batchId
        });
      }
    }

    return {
      batchId: bulkMessageDto.batchId || `batch_${Date.now()}`,
      totalMessages: bulkMessageDto.messages.length,
      successCount,
      failedCount,
      messages: results,
    };
  }

  /**
   * Get message status - ONLY for scheduled messages
   * Immediate sends don't have persistent status
   */
  async getMessageStatus(messageId: string, tenantId?: string) {
    // Check if this is a transient ID (immediate send)
    if (messageId.startsWith('msg_')) {
      throw new NotFoundException(
        'Status not available for immediate sends. Only scheduled messages have persistent status.'
      );
    }

    const whereCondition = tenantId ? { tenantId } : {};
    const message = await this.messageRepository.findById(
      messageId,
      false,
      whereCondition,
    );

    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    return {
      id: message.id,
      status: message.status,
      channels: message.channels,
      recipients: message.recipients,
      createdAt: message.createdAt,
      scheduledAt: message.scheduledAt,
      deliveredAt: message.deliveredAt,
      errorMessage: message.errorMessage,
    };
  }

  /**
   * Get delivery reports - ONLY for scheduled messages
   * Immediate sends don't store delivery records
   */
  async getDeliveryReports(messageId: string, tenantId?: string) {
    if (messageId.startsWith('msg_')) {
      throw new NotFoundException(
        'Delivery reports not available for immediate sends. Use provider webhooks for delivery tracking.'
      );
    }

    if (tenantId) {
      const message = await this.messageRepository.findById(messageId, false, {
        tenantId,
      });
      if (!message) {
        throw new NotFoundException(`Message ${messageId} not found`);
      }
    }

    // For scheduled messages, return basic info without detailed delivery records
    return {
      messageId,
      note: 'Detailed delivery tracking available via provider webhooks'
    };
  }

  async getTenantMessages(
    query: any,
    tenantId?: string,
  ): Promise<IPaginatedData<any>> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (query.status) where.status = query.status;

    const result = await this.messageRepository.findAllPaginated(
      page,
      limit,
      false,
      where,
    );
    return getPaginationSummary(
      result.data,
      result.total,
      { page, limit },
      'messages',
    );
  }

  async cancelMessage(messageId: string, tenantId?: string) {
    const whereCondition = tenantId ? { tenantId } : {};
    const message = await this.messageRepository.findById(
      messageId,
      false,
      whereCondition,
    );

    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    if (message.status !== MessageStatus.PENDING) {
      throw new Error(`Cannot cancel message with status: ${message.status}`);
    }

    await this.messageRepository.update(messageId, {
      status: MessageStatus.CANCELLED,
    });
  }

  /**
   * Get delivery stats - ONLY for scheduled messages
   * For comprehensive analytics, use provider dashboards or webhook logs
   */
  async getDeliveryStats(query: any, tenantId?: string) {
    const whereCondition: any = {};
    if (tenantId) whereCondition.tenantId = tenantId;
    if (query.startDate) whereCondition.createdAt = { gte: query.startDate };
    if (query.endDate) {
      whereCondition.createdAt = {
        ...whereCondition.createdAt,
        lte: query.endDate,
      };
    }

    // Only count scheduled messages (stored in DB)
    const messages = await this.messageRepository.find({
      where: whereCondition,
    });

    const totalScheduled = messages.length;
    const delivered = messages.filter(m => m.status === MessageStatus.DELIVERED).length;
    const failed = messages.filter(m => m.status === MessageStatus.FAILED).length;
    const pending = messages.filter(m => m.status === MessageStatus.PENDING).length;

    return {
      scheduledMessages: totalScheduled,
      delivered,
      failed,
      pending,
      note: 'Stats only include scheduled messages. Immediate sends are not tracked in database.',
      recommendation: 'Use provider webhooks and analytics for comprehensive delivery tracking'
    };
  }

  /**
   * Process scheduled messages only (called by scheduler/cron)
   */
  async processMessage(messageId: string) {
    try {
      const message = await this.messageRepository.findById(messageId);
      if (!message) {
        throw new Error(`Message ${messageId} not found`);
      }

      // Update status to processing
      await this.messageRepository.update(messageId, {
        status: MessageStatus.PROCESSING,
      });

      // Process each channel
      const deliveryResults: Array<{
        channel: string;
        status: 'delivered' | 'failed';
        result?: any;
        error?: string;
      }> = [];
      
      for (const channel of message.channels) {
        try {
          let result;
          
          switch (channel.toLowerCase()) {
            // case 'email':
            //   result = await this.processEmailChannel(message);
            //   break;
            // case 'sms':
            //   result = await this.processSMSChannel(message);
            //   break;
            // case 'push':
            //   result = await this.processPushChannel(message);
            //   break;
            // case 'whatsapp':
            //   result = await this.processWhatsAppChannel(message);
            //   break;
            // case 'inapp':
            //   result = await this.processInAppChannel(message);
            //   break;
            // case 'voice':
            //   result = await this.processVoiceChannel(message);
            //   break;
            default:
              this.logger.warn(`Unsupported channel: ${channel}`);
              continue;
          }

          deliveryResults.push({
            channel,
            status: 'delivered',
            result
          });

        } catch (error) {
          this.logger.error(`Failed to process ${channel} for message ${messageId}:`, error);
          deliveryResults.push({
            channel,
            status: 'failed',
            error: error.message
          });
        }
      }

      // Update final message status
      const hasFailures = deliveryResults.some(r => r.status === 'failed');
      const hasSuccess = deliveryResults.some(r => r.status === 'delivered');
      
      let finalStatus = MessageStatus.FAILED;
      if (hasSuccess && !hasFailures) {
        finalStatus = MessageStatus.DELIVERED;
      } else if (hasSuccess && hasFailures) {
        finalStatus = MessageStatus.PARTIALLY_DELIVERED;
      }

      await this.messageRepository.update(messageId, {
        status: finalStatus,
        deliveredAt: hasSuccess ? new Date() : undefined,
        errorMessage: hasFailures ? 'Some channels failed' : undefined,
      });

      // NO DELIVERY RECORDS - Keep it lightweight
      this.logger.log(`Processed scheduled message ${messageId}: ${finalStatus}`);

    } catch (error) {
      this.logger.error(`Failed to process message ${messageId}:`, error);
      await this.messageRepository.update(messageId, {
        status: MessageStatus.FAILED,
        errorMessage: error.message,
      });
    }
  }

  /**
   * DIRECT SEND METHODS - Transport mode (no storage)
   */
  
  // private async sendEmailDirect(messageData: any) {
  //   const emailPayload = {
  //     to: messageData.recipients.map(r => r.email).filter(Boolean),
  //     subject: messageData.subject,
  //     html: messageData.content?.html,
  //     text: messageData.content?.text,
  //     from: messageData.metadata?.fromEmail,
  //     templateId: messageData.templateId,
  //     templateData: messageData.data,
  //   };

  //   const brandId = messageData.metadata?.brandId;
  //   return this.quotaAwareOrchestrator.sendEmail(emailPayload, messageData.tenantId, brandId);
  // }

  // private async sendSMSDirect(messageData: any) {
  //   const smsPayload = {
  //     to: messageData.recipients.map(r => r.phone).filter(Boolean),
  //     message: messageData.content?.text || messageData.subject,
  //     templateId: messageData.templateId,
  //     templateData: messageData.data,
  //   };

  //   return this.quotaAwareOrchestrator.sendSMS(smsPayload, messageData.tenantId);
  // }

  // private async sendPushDirect(messageData: any) {
  //   const pushPayload = {
  //     deviceTokens: messageData.recipients.map(r => r.pushToken).filter(Boolean),
  //     title: messageData.subject,
  //     body: messageData.content?.text,
  //     data: messageData.data,
  //     templateId: messageData.templateId,
  //   };

  //   const brandId = messageData.metadata?.brandId;
  //   return this.quotaAwareOrchestrator.sendPushNotification(pushPayload, messageData.tenantId, brandId);
  // }

  // private async sendWhatsAppDirect(messageData: any) {
  //   const whatsappPayload = {
  //     channel: 'whatsapp',
  //     to: messageData.recipients.map(r => r.phone).filter(Boolean),
  //     message: messageData.content?.text || messageData.subject,
  //     templateId: messageData.templateId,
  //     templateData: messageData.data,
  //   };

  //   return this.quotaAwareOrchestrator.sendChatMessage(whatsappPayload, 'whatsapp', messageData.tenantId);
  // }

  // private async sendInAppDirect(messageData: any) {
  //   const inAppPayload = {
  //     userId: messageData.recipients.map(r => r.userId).filter(Boolean)[0] || '',
  //     message: messageData.content?.text || messageData.subject,
  //     title: messageData.subject,
  //     data: messageData.data,
  //     templateId: messageData.templateId,
  //   };

  //   return this.quotaAwareOrchestrator.sendInAppNotification(inAppPayload);
  // }

  // private async sendVoiceDirect(messageData: any) {
  //   const voicePayload = {
  //     to: messageData.recipients.map(r => r.phone).filter(Boolean),
  //     message: messageData.content?.text || messageData.subject,
  //     templateId: messageData.templateId,
  //     templateData: messageData.data,
  //   };

  //   return this.quotaAwareOrchestrator.sendVoiceCall(voicePayload, messageData.tenantId);
  // }

  /**
   * SCHEDULED MESSAGE PROCESSING - Only for stored scheduled messages
   */
  
  // private async processEmailChannel(message: any) {
  //   const emailPayload = {
  //     to: message.recipients.map(r => r.email).filter(Boolean),
  //     subject: message.subject,
  //     html: message.content?.html,
  //     text: message.content?.text,
  //     from: message.metadata?.fromEmail,
  //     templateId: message.templateId,
  //     templateData: message.data,
  //   };

  //   const brandId = message.metadata?.brandId;
  //   return this.quotaAwareOrchestrator.sendEmail(emailPayload, message.tenantId, brandId);
  // }

  // private async processSMSChannel(message: any) {
  //   const smsPayload = {
  //     to: message.recipients.map(r => r.phone).filter(Boolean),
  //     message: message.content?.text || message.subject,
  //     templateId: message.templateId,
  //     templateData: message.data,
  //   };

  //   return this.quotaAwareOrchestrator.sendSMS(smsPayload, message.tenantId);
  // }

  // private async processPushChannel(message: any) {
  //   const pushPayload = {
  //     deviceTokens: message.recipients.map(r => r.pushToken).filter(Boolean),
  //     title: message.subject,
  //     body: message.content?.text,
  //     data: message.data,
  //     templateId: message.templateId,
  //   };

  //   const brandId = message.metadata?.brandId;
  //   return this.quotaAwareOrchestrator.sendPushNotification(pushPayload, message.tenantId, brandId);
  // }

  // private async processWhatsAppChannel(message: any) {
  //   const whatsappPayload = {
  //     channel: 'whatsapp',
  //     to: message.recipients.map(r => r.phone).filter(Boolean),
  //     message: message.content?.text || message.subject,
  //     templateId: message.templateId,
  //     templateData: message.data,
  //   };

  //   return this.quotaAwareOrchestrator.sendChatMessage(whatsappPayload, 'whatsapp', message.tenantId);
  // }

  // private async processInAppChannel(message: any) {
  //   const inAppPayload = {
  //     userId: message.recipients.map(r => r.userId).filter(Boolean)[0] || '',
  //     message: message.content?.text || message.subject,
  //     title: message.subject,
  //     data: message.data,
  //     templateId: message.templateId,
  //   };

  //   return this.quotaAwareOrchestrator.sendInAppNotification(inAppPayload);
  // }

  // private async processVoiceChannel(message: any) {
  //   const voicePayload = {
  //     to: message.recipients.map(r => r.phone).filter(Boolean),
  //     message: message.content?.text || message.subject,
  //     templateId: message.templateId,
  //     templateData: message.data,
  //   };

  //   return this.quotaAwareOrchestrator.sendVoiceCall(voicePayload, message.tenantId);
  // }

  /**
   * Send external notification (email, SMS, push, etc.)
   * TRANSPORT MODE: Direct send without storage
   */
  async sendExternalNotification(request: {
    tenantId: string;
    templateId?: string;
    channels: string[];
    recipients: Array<{
      email?: string;
      phone?: string;
      userId?: string;
    }>;
    data: Record<string, any>;
    subject?: string;
    content?: string;
    priority?: string;
    scheduledAt?: Date;
    metadata?: Record<string, any>;
  }) {
    // Use the main sendMessage method which handles transport mode
    return this.sendMessage({
      channels: request.channels as any,
      recipients: request.recipients as any,
      templateId: request.templateId,
      data: request.data,
      subject: request.subject,
      content: request.content,
      priority: request.priority as any,
      scheduledAt: request.scheduledAt,
      metadata: request.metadata,
    }, request.tenantId);
  }

  /**
   * DIGEST/BATCHING METHODS
   */

  /**
   * Send notification with digest support
   */
  async sendWithDigest(
    sendMessageDto: SendMessageDto,
    tenantId: string,
    frequency: 'instant' | 'daily' | 'weekly' | 'monthly' = 'instant',
  ) {
    const digestConfig = this.digestService.getDigestConfig(frequency);
    if (!digestConfig) {
      throw new Error(`Invalid digest frequency: ${frequency}`);
    }

    // For instant, send immediately
    if (frequency === 'instant') {
      return this.sendMessage(sendMessageDto, tenantId);
    }

    // For other frequencies, queue for digest
    for (const recipient of sendMessageDto.recipients) {
      const subscriberId = recipient.userId || recipient.id;
      if (!subscriberId) continue;

      for (const channel of sendMessageDto.channels) {
        const contentText = typeof sendMessageDto.content === 'string' 
          ? sendMessageDto.content 
          : (sendMessageDto.content as any)?.text || '';

        const digestNotification: DigestNotification = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          subscriberId,
          tenantId,
          channel,
          title: sendMessageDto.subject || '',
          content: contentText,
          data: sendMessageDto.data,
          createdAt: new Date(),
          templateId: sendMessageDto.templateId,
        };

        await this.digestService.queueNotificationForDigest(
          digestNotification,
          digestConfig,
        );
      }
    }

    return {
      status: 'queued_for_digest',
      frequency,
      recipientCount: sendMessageDto.recipients.length,
      message: `Notifications queued for ${frequency} digest delivery`,
    };
  }

  /**
   * Get digest queue statistics
   */
  getDigestStats() {
    return this.digestService.getQueueStats();
  }

  /**
   * Get pending digests for a subscriber
   */
  getPendingDigests(subscriberId: string, tenantId: string) {
    return this.digestService.getPendingDigests(subscriberId, tenantId);
  }

  /**
   * SCHEDULING METHODS
   */

  /**
   * Schedule notification for specific time in subscriber's timezone
   */
  async scheduleNotification(
    sendMessageDto: SendMessageDto,
    tenantId: string,
    scheduleConfig: ScheduleConfig,
  ) {
    const scheduled: any[] = [];

    for (const recipient of sendMessageDto.recipients) {
      const subscriberId = recipient.userId || recipient.id;
      if (!subscriberId) continue;

      for (const channel of sendMessageDto.channels) {
        const notification = {
          id: `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          subscriberId,
          tenantId,
          channel,
          content: sendMessageDto.content,
          metadata: {
            ...sendMessageDto.metadata,
            templateId: sendMessageDto.templateId,
            subject: sendMessageDto.subject,
          },
        };

        const scheduledNotif = await this.schedulingService.scheduleNotification(
          notification as any,
          scheduleConfig,
        );

        scheduled.push(scheduledNotif);
      }
    }

    return {
      status: 'scheduled',
      timezone: scheduleConfig.timezone,
      sendTime: scheduleConfig.sendTime,
      notificationCount: scheduled.length,
      notifications: scheduled,
    };
  }

  /**
   * Get scheduling statistics
   */
  getSchedulingStats() {
    return this.schedulingService.getSchedulingStats();
  }

  /**
   * Get pending scheduled notifications for a subscriber
   */
  getPendingScheduledNotifications(subscriberId: string, tenantId: string) {
    return this.schedulingService.getPendingNotifications(subscriberId, tenantId);
  }

  /**
   * Get notifications ready to send
   */
  getReadyNotifications() {
    return this.schedulingService.getReadyNotifications();
  }

  /**
   * Cancel scheduled notification
   */
  async cancelScheduledNotification(notificationId: string) {
    await this.schedulingService.cancelNotification(notificationId);
    return { status: 'cancelled', notificationId };
  }

  /**
   * Validate timezone
   */
  isValidTimezone(timezone: string): boolean {
    return this.schedulingService.isValidTimezone(timezone);
  }

  /**
   * Get all valid timezones
   */
  getValidTimezones(): string[] {
    return this.schedulingService.getValidTimezones();
  }
}
