import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum SecurityEventType {
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  PASSWORD_RESET_REQUEST = 'password_reset_request',
  PASSWORD_RESET_SUCCESS = 'password_reset_success',
  API_KEY_CREATED = 'api_key_created',
  API_KEY_REVOKED = 'api_key_revoked',
  API_KEY_USED = 'api_key_used',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  PERMISSION_DENIED = 'permission_denied',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  DATA_ENCRYPTION = 'data_encryption',
  DATA_DECRYPTION = 'data_decryption',
  ENCRYPTION_KEY_ROTATION = 'encryption_key_rotation',
  SESSION_CREATED = 'session_created',
  SESSION_EXPIRED = 'session_expired',
  SESSION_INVALIDATED = 'session_invalidated',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  IP_BLOCKED = 'ip_blocked',
  SECURITY_SCAN_DETECTED = 'security_scan_detected',
}

export enum SecurityEventSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('security_events')
@Index(['tenantId', 'eventType'])
@Index(['userId', 'eventType'])
@Index(['ipAddress', 'eventType'])
@Index(['createdAt'])
@Index(['severity', 'createdAt'])
export class SecurityEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true, name: 'tenant_id' })
  @Index()
  tenantId?: string;

  @Column({ nullable: true, name: 'user_id' })
  @Index()
  userId?: string;

  @Column({
    type: 'enum',
    enum: SecurityEventType,
    name: 'event_type',
  })
  eventType: SecurityEventType;

  @Column({
    type: 'enum',
    enum: SecurityEventSeverity,
    default: SecurityEventSeverity.LOW,
  })
  severity: SecurityEventSeverity;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true, name: 'ip_address' })
  @Index()
  ipAddress?: string;

  @Column({ nullable: true, name: 'user_agent' })
  userAgent?: string;

  @Column({ nullable: true, name: 'session_id' })
  sessionId?: string;

  @Column({ nullable: true, name: 'resource_type' })
  resourceType?: string;

  @Column({ nullable: true, name: 'resource_id' })
  resourceId?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'json', nullable: true, name: 'request_details' })
  requestDetails?: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: any;
  };

  @Column({ default: false })
  resolved: boolean;

  @Column({ nullable: true, name: 'resolved_by' })
  resolvedBy?: string;

  @Column({ nullable: true, name: 'resolved_at' })
  resolvedAt?: Date;

  @Column({ nullable: true })
  resolution?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
