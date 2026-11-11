import { Column, Entity, ManyToOne } from "typeorm";
import { BaseEntity } from "../../../common/database/entities/base.entity";
import { Project } from "../../project/entities/project.entity";
import type { TenantMember } from "../../tenant-member/entities/tenant-member.entity";
import type { Tenant } from "../../tenant/entities/tenant.entity";

export enum CertificateType {
  IOS = "ios",
  ANDROID = "android",
}

export enum CertificateStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  PENDING_VALIDATION = "pending_validation",
}

export enum CertificateEnvironment {
  DEVELOPMENT = "development",
  PRODUCTION = "production",
}

export interface IOSCertificateData {
  certificateData: string;
  certificatePassword?: string;
  bundleId: string;
  teamId: string;
  keyId?: string;
  privateKey?: string;
}

export interface AndroidCertificateData {
  serviceAccountKey: string;
  projectId: string;
  packageName: string;
}

@Entity("push_certificates")
export class PushCertificate extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({
    type: "enum",
    enum: CertificateType,
  })
  type: CertificateType;

  @Column({
    type: "enum",
    enum: CertificateStatus,
    default: CertificateStatus.PENDING_VALIDATION,
  })
  status: CertificateStatus;

  @Column({
    type: "enum",
    enum: CertificateEnvironment,
    default: CertificateEnvironment.DEVELOPMENT,
  })
  environment: CertificateEnvironment;

  @Column({ type: "json" })
  certificateData: IOSCertificateData | AndroidCertificateData;

  @Column({ nullable: true })
  expiresAt?: Date;

  @Column({ nullable: true })
  issuedAt?: Date;

  @Column({ nullable: true })
  issuer?: string;

  @Column({ nullable: true })
  subject?: string;

  @Column({ type: "text", nullable: true })
  fingerprint?: string;

  @Column({ type: "timestamp", nullable: true })
  lastValidatedAt?: Date;

  @Column({ type: "timestamp", nullable: true })
  lastTestedAt?: Date;

  @Column({ type: "json", nullable: true })
  validationResult?: {
    isValid: boolean;
    errors?: string[];
    warnings?: string[];
    lastChecked: Date;
  };

  @Column({ type: "json", nullable: true })
  testResult?: {
    success: boolean;
    messageId?: string;
    error?: string;
    responseTime?: number;
    lastTested: Date;
  };

  @Column({ type: "int", default: 0 })
  totalNotificationsSent: number;

  @Column({ type: "timestamp", nullable: true })
  lastUsedAt?: Date;

  @Column({ type: "json", nullable: true })
  rotationConfig?: {
    autoRotate: boolean;
    rotationDaysBeforeExpiry: number;
    notificationEmails?: string[];
    webhookUrl?: string;
  };

  @Column({ type: "timestamp", nullable: true })
  nextRotationAt?: Date;

  @Column({ type: "simple-array", nullable: true })
  allowedProjects?: string[];

  @Column({ type: "json", nullable: true })
  accessControl?: {
    allowedRoles?: string[];
    allowedUsers?: string[];
    ipWhitelist?: string[];
  };

  @Column({ type: "simple-array", nullable: true })
  tags?: string[];

  @Column({ type: "json", nullable: true })
  metadata?: Record<string, any>;

  @ManyToOne("Tenant", (tenant: Tenant) => tenant.pushCertificates)
  tenant: Tenant;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId: string;

  @ManyToOne("TenantMember", (tenantMember: TenantMember) => tenantMember.createdPushCertificates)
  createdBy: TenantMember;

  @Column({ type: "uuid", name: "created_by_id" })
  createdById: string;

  @ManyToOne(() => Project, (project) => project.pushCertificates, {
    nullable: true,
  })
  project: Project;

  @Column({ type: "uuid", name: "project_id", nullable: true })
  projectId?: string;

  isActive(): boolean {
    return this.status === CertificateStatus.ACTIVE;
  }

  isExpired(): boolean {
    return this.expiresAt ? new Date() > this.expiresAt : false;
  }

  isExpiringSoon(days: number = 30): boolean {
    if (!this.expiresAt) return false;
    const expiryThreshold = new Date();
    expiryThreshold.setDate(expiryThreshold.getDate() + days);
    return this.expiresAt <= expiryThreshold;
  }

  needsRotation(): boolean {
    return this.isExpiringSoon(this.rotationConfig?.rotationDaysBeforeExpiry || 30);
  }

  canUseForProject(projectId: string): boolean {
    if (!this.allowedProjects || this.allowedProjects.length === 0) {
      return true;
    }
    return this.allowedProjects.includes(projectId);
  }

  validateCertificate(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (this.isExpired()) {
      errors.push("Certificate has expired");
    } else if (this.isExpiringSoon(7)) {
      warnings.push("Certificate expires within 7 days");
    }

    if (this.type === CertificateType.IOS) {
      const iosData = this.certificateData as IOSCertificateData;
      if (!iosData.certificateData) {
        errors.push("iOS certificate data is required");
      }
      if (!iosData.bundleId) {
        errors.push("Bundle ID is required for iOS certificates");
      }
      if (!iosData.teamId) {
        errors.push("Team ID is required for iOS certificates");
      }
    } else if (this.type === CertificateType.ANDROID) {
      const androidData = this.certificateData as AndroidCertificateData;
      if (!androidData.serviceAccountKey) {
        errors.push("Android service account key is required");
      }
      if (!androidData.packageName) {
        errors.push("Package name is required for Android certificates");
      }
    }

    if (
      this.environment === CertificateEnvironment.PRODUCTION &&
      this.status === CertificateStatus.PENDING_VALIDATION
    ) {
      warnings.push("Production certificates should be validated before use");
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  getCertificateInfo() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      environment: this.environment,
      status: this.status,
      expiresAt: this.expiresAt,
      issuedAt: this.issuedAt,
      issuer: this.issuer,
      subject: this.subject,
      fingerprint: this.fingerprint,
      lastValidatedAt: this.lastValidatedAt,
      lastTestedAt: this.lastTestedAt,
      totalNotificationsSent: this.totalNotificationsSent,
      tags: this.tags,
    };
  }
}
