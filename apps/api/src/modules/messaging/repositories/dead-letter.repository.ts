import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from '../../../database/repositories/base.repository';
import { Repository } from 'typeorm';
import { DeadLetter, DeadLetterStatus, DeadLetterType } from '../entities/dead-letter.entity';

@Injectable()
export class DeadLetterRepository extends BaseRepository<DeadLetter> {
  constructor(
    @InjectRepository(DeadLetter)
    private readonly deadLetterRepository: Repository<DeadLetter>,
  ) {
    super(deadLetterRepository);
  }

  /**
   * Find dead letters by tenant ID
   */
  async findByTenantId(tenantId: string): Promise<DeadLetter[]> {
    return this.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find dead letters by status
   */
  async findByStatus(status: DeadLetterStatus): Promise<DeadLetter[]> {
    return this.find({
      where: { status },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find dead letters by type
   */
  async findByType(type: DeadLetterType): Promise<DeadLetter[]> {
    return this.find({
      where: { originalType: type },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find dead letters by tenant and status
   */
  async findByTenantAndStatus(tenantId: string, status: DeadLetterStatus): Promise<DeadLetter[]> {
    return this.find({
      where: { tenantId, status },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get dead letter statistics for a tenant
   */
  async getStatsByTenant(tenantId: string): Promise<{
    total: number;
    pendingReview: number;
    underInvestigation: number;
    resolved: number;
    ignored: number;
  }> {
    const [total, pendingReview, underInvestigation, resolved, ignored] = await Promise.all([
      this.count({ tenantId }),
      this.count({ tenantId, status: DeadLetterStatus.PENDING_REVIEW }),
      this.count({ tenantId, status: DeadLetterStatus.UNDER_INVESTIGATION }),
      this.count({ tenantId, status: DeadLetterStatus.RESOLVED }),
      this.count({ tenantId, status: DeadLetterStatus.IGNORED }),
    ]);

    return {
      total,
      pendingReview,
      underInvestigation,
      resolved,
      ignored,
    };
  }

  /**
   * Mark dead letter as resolved
   */
  async markAsResolved(id: string, resolvedBy: string, resolutionNotes?: string): Promise<DeadLetter | null> {
    return this.update(id, {
      status: DeadLetterStatus.RESOLVED,
      resolvedBy,
      resolvedAt: new Date(),
      resolutionNotes,
    });
  }

  /**
   * Mark dead letter as under investigation
   */
  async markAsUnderInvestigation(id: string): Promise<DeadLetter | null> {
    return this.update(id, {
      status: DeadLetterStatus.UNDER_INVESTIGATION,
    });
  }

  /**
   * Mark dead letter as ignored
   */
  async markAsIgnored(id: string, resolvedBy: string, resolutionNotes?: string): Promise<DeadLetter | null> {
    return this.update(id, {
      status: DeadLetterStatus.IGNORED,
      resolvedBy,
      resolvedAt: new Date(),
      resolutionNotes,
    });
  }

  /**
   * Find recent dead letters (last 24 hours)
   */
  async findRecent(tenantId?: string): Promise<DeadLetter[]> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const queryBuilder = this.createQueryBuilder('deadLetter')
      .where('deadLetter.createdAt >= :yesterday', { yesterday })
      .orderBy('deadLetter.createdAt', 'DESC');

    if (tenantId) {
      queryBuilder.andWhere('deadLetter.tenantId = :tenantId', { tenantId });
    }

    return queryBuilder.getMany();
  }

  /**
   * Find dead letters with high retry count
   */
  async findHighRetryCount(minRetryCount: number = 3): Promise<DeadLetter[]> {
    return this.find({
      where: {
        retryCount: minRetryCount,
        status: DeadLetterStatus.PENDING_REVIEW,
      },
      order: { retryCount: 'DESC', createdAt: 'DESC' },
    });
  }
}