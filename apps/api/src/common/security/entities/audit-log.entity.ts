import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type AuditAction =
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'EXPORT'
  | 'IMPORT'
  | 'SEND'
  | 'RECEIVE'
  | 'APPROVE'
  | 'REJECT'
  | 'ARCHIVE'
  | 'RESTORE'
  | 'CONFIGURE'
  | 'AUTHENTICATE'
  | 'AUTHORIZE'
  | 'PERMISSION_CHANGE'
  | 'ROLE_CHANGE'
  | 'OTHER';

export type AuditResourceType =
  | 'USER'
  | 'TENANT'
  | 'MESSAGE'
  | 'TEMPLATE'
  | 'CONFIGURATION'
  | 'API_KEY'
  | 'PROVIDER'
  | 'SUBSCRIBER'
  | 'CAMPAIGN'
  | 'NOTIFICATION'
  | 'ROLE'
  | 'PERMISSION'
  | 'WEBHOOK'
  | 'INTEGRATION'
  | 'OTHER';

@Entity('audit_logs')
@Index(['tenantId', 'createdAt'])
@Index(['tenantMemberId', 'createdAt'])
@Index(['resourceType', 'resourceId'])
@Index(['action'])
@Index(['severity'])
@Index(['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId: string;

  @Column('uuid', { nullable: true, name: 'tenant_member_id' })
  tenantMemberId: string;

  @Column('varchar', { length: 50 })
  action: AuditAction;

  @Column('varchar', { length: 50, name: 'resource_type' })
  resourceType: AuditResourceType;

  @Column('uuid', { name: 'resource_id' })
  resourceId: string;

  @Column('text')
  description: string;

  @Column('varchar', { length: 45, nullable: true, name: 'ip_address' })
  ipAddress: string;

  @Column('text', { nullable: true, name: 'user_agent' })
  userAgent: string;

  @Column('uuid', { nullable: true, name: 'session_id' })
  sessionId: string;

  @Column('jsonb', { nullable: true, name: 'old_values' })
  oldValues: Record<string, any>;

  @Column('jsonb', { nullable: true, name: 'new_values' })
  newValues: Record<string, any>;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @Column('boolean', { default: true })
  success: boolean;

  @Column('text', { nullable: true, name: 'error_message' })
  errorMessage: string;

  @Column('integer', { default: 0 })
  duration: number;

  @Column('uuid', { nullable: true, name: 'correlation_id' })
  correlationId: string;

  @Column('uuid', { nullable: true, name: 'request_id' })
  requestId: string;

  @Column('jsonb', { nullable: true, name: 'request_headers' })
  requestHeaders: Record<string, string>;

  @Column('jsonb', { nullable: true, name: 'response_data' })
  responseData: Record<string, any>;

  @Column('varchar', { length: 20, nullable: true, name: 'api_version' })
  apiVersion: string;

  @Column('varchar', { length: 50, nullable: true, name: 'client_version' })
  clientVersion: string;

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column('varchar', { length: 20, default: 'low' })
  severity: 'low' | 'medium' | 'high' | 'critical';

  @Column('simple-array', { nullable: true, name: 'compliance_flags' })
  complianceFlags: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
