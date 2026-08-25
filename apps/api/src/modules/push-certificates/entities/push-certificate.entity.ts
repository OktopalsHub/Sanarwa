import { Column, Entity, ManyToOne } from "typeorm";
import { BaseEntity } from "../../../database/entities/base.entity";
import { Project } from "../../project/entities/project.entity";
import { TenantMember } from "../../tenant-member/entities/tenant-member.entity";
import { Tenant } from "../../tenant/entities/tenant.entity";

export enum CertificateType {
  IOS = "ios",
  ANDROID = "android",
}

export enum CertificateStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  EXPIRED = "expired",
  REVOKED = "revoked",
  PENDING_VALIDATION = "pending_validation",
}

export enum CertificateEnvironment {
  DEVELOPMENT = "development",
  PRODUCTION = "production",
}

export interface IOSCertificateData {
  certificateData: string; // Base64 encoded .p12 or .pem
  certificatePassword?: string;
  bundleId: string;
  teamId: string;
  keyId?: string; // For newer token-based auth
  privateKey?: string; // For token-based auth
}

export interface AndroidCertificateData {
  serviceAccountKey: string; // JSON key file content
  projectId: string;
  packageName: string;
  serverKey?: string; // Legacy FCM server key
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

  // Certificate data (encrypted in production)
  @Column({ type: "json" })
  certificateData: IOSCertificateData | AndroidCertificateData;

  // Certificate metadata
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

  // Validation and testing
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

  // Usage statistics
  @Column({ type: "int", default: 0 })
  totalNotificationsSent: number;

  @Column({ type: "timestamp", nullable: true })
  lastUsedAt?: Date;

  // Rotation and renewal
  @Column({ type: "json", nullable: true })
  rotationConfig?: {
    autoRotate: boolean;
    rotationDaysBeforeExpiry: number;
    notificationEmails?: string[];
    webhookUrl?: string;
  };

  @Column({ type: "timestamp", nullable: true })
  nextRotationAt?: Date;

  // Security and access control
  @Column({ type: "simple-array", nullable: true })
  allowedProjects?: string[]; // Project IDs that can use this certificate

  @Column({ type: "json", nullable: true })
  accessControl?: {
    allowedRoles?: string[];
    allowedUsers?: string[];
    ipWhitelist?: string[];
  };

  // Tags and metadata
  @Column({ type: "simple-array", nullable: true })
  tags?: string[];

  @Column({ type: "json", nullable: true })
  metadata?: Record<string, any>;

  // Relationships
  @ManyToOne(() => Tenant, (tenant) => tenant.pushCertificates)
  tenant: Tenant;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId: string;

  @ManyToOne(() => TenantMember, (tenantMember) => tenantMember.createdPushCertificates)
  createdBy: TenantMember;

  @Column({ type: "uuid", name: "created_by_id" })
  createdById: string;

  @ManyToOne(() => Project, (project) => project.pushCertificates, {
    nullable: true,
  })
  project: Project;

  @Column({ type: "uuid", name: "project_id", nullable: true })
  projectId?: string;

  // Helper methods
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
      return true; // No restrictions
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

    // Check expiry
    if (this.isExpired()) {
      errors.push("Certificate has expired");
    } else if (this.isExpiringSoon(7)) {
      warnings.push("Certificate expires within 7 days");
    }

    // Check required fields based on type
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
      if (!androidData.serviceAccountKey && !androidData.serverKey) {
        errors.push("Android service account key or server key is required");
      }
      if (!androidData.packageName) {
        errors.push("Package name is required for Android certificates");
      }
    }

    // Check environment consistency
    if (
      this.environment === CertificateEnvironment.PRODUCTION &&
      this.status === CertificateStatus.PENDING_VALIDATION
    ) {
      warnings.push("Production certificates should be validated before use");
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  // Get certificate info for display (without sensitive data)
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
