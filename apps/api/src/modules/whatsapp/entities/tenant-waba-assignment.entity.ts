
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { WABAConfig } from './waba-config.entity';

@Entity('tenant_waba_assignments')
export class TenantWABAAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  wabaId: string;

  @ManyToOne(() => WABAConfig, waba => waba.assignments)
  @JoinColumn({ name: 'wabaId' })
  waba: WABAConfig;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  messagesSent: number;

  @Column({ default: 0 })
  templatesUsed: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  totalCost: number;

  @Column({ nullable: true })
  lastMessageAt: Date;

  // Additional properties needed by services
  @Column({ nullable: true })
  accessToken: string;

  @Column({ nullable: true })
  phoneNumberId: string;





  @Column({ default: 'PENDING' })
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';

  @Column({ default: 'UNVERIFIED' })
  verificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED';

  @Column({ nullable: true })
  lastSyncAt: Date;

  @Column('json', { nullable: true })
  usage: {
    dailyMessages?: number;
    monthlyMessages?: number;
    templateBreakdown?: Record<string, number>;
    costBreakdown?: {
      messages: number;
      templates: number;
      total: number;
    };
  };

  @CreateDateColumn()
  assignedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  recordMessage(cost: number = 0): void {
    this.messagesSent++;
    this.totalCost = parseFloat(this.totalCost.toString()) + cost;
    this.lastMessageAt = new Date();

    // Update usage statistics
    if (!this.usage) {
      this.usage = {};
    }

    this.usage.dailyMessages = (this.usage.dailyMessages || 0) + 1;
    this.usage.monthlyMessages = (this.usage.monthlyMessages || 0) + 1;
  }

  recordTemplate(templateName: string): void {
    this.templatesUsed++;

    if (!this.usage) {
      this.usage = {};
    }

    if (!this.usage.templateBreakdown) {
      this.usage.templateBreakdown = {};
    }

    this.usage.templateBreakdown[templateName] = (this.usage.templateBreakdown[templateName] || 0) + 1;
  }

  getAverageMessagesPerDay(): number {
    const daysSinceAssignment = Math.max(1, Math.floor((Date.now() - this.assignedAt.getTime()) / (1000 * 60 * 60 * 24)));
    return this.messagesSent / daysSinceAssignment;
  }

  getAverageCostPerMessage(): number {
    return this.messagesSent > 0 ? parseFloat(this.totalCost.toString()) / this.messagesSent : 0;
  }
}