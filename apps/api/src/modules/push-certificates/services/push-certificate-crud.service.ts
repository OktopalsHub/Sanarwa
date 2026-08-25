import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  PushCertificate,
  CertificateType,
  CertificateStatus,
} from "../entities/push-certificate.entity";
import { Project } from "../../project/entities/project.entity";
import { CreatePushCertificateDto, UpdatePushCertificateDto } from "../dto/push-certificate.dto";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { TenantRepository } from "../../tenant/tenant.repository";
import { ProjectRepository } from "../../project/project.repository";

@Injectable()
export class PushCertificateCrudService {
  constructor(
    @InjectRepository(PushCertificate)
    private readonly certificateRepository: Repository<PushCertificate>,
    private readonly tenantRepository: TenantRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createCertificate(
    tenantId: string,
    createDto: CreatePushCertificateDto,
  ): Promise<PushCertificate> {
    // Validate tenant exists
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    // Validate project if provided
    let project: Project | undefined;
    if (createDto.projectId) {
      project =
        (await this.projectRepository.findOne({
          where: { id: createDto.projectId, tenantId },
        })) || undefined;
      if (!project) {
        throw new NotFoundException("Project not found");
      }
    }

    // Validate certificate data
    const certificate = new PushCertificate();
    Object.assign(certificate, createDto);
    certificate.tenantId = tenantId;
    certificate.tenant = tenant;
    if (project) {
      certificate.project = project;
    }
    certificate.projectId = createDto.projectId;

    const validation = certificate.validateCertificate();
    if (!validation.isValid) {
      throw new BadRequestException(`Invalid certificate: ${validation.errors.join(", ")}`);
    }

    const result = await this.certificateRepository.save(certificate);

    // Emit event
    this.eventEmitter.emit("certificate.created", {
      certificateId: result.id,
      tenantId,
      type: createDto.type,
      environment: createDto.environment,
    });

    return result;
  }

  async createCertificateFromFile(
    tenantId: string,
    file: any,
    metadata: any,
  ): Promise<PushCertificate> {
    // Parse certificate file based on type
    let certificateData: any;

    if (metadata.type === "ios") {
      // Parse iOS certificate (.p12 or .pem)
      certificateData = {
        certificateData: file.buffer.toString("base64"),
        certificatePassword: metadata.password,
        bundleId: metadata.bundleId,
        teamId: metadata.teamId,
      };
    } else if (metadata.type === "android") {
      // Parse Android service account key (.json)
      const keyData = JSON.parse(file.buffer.toString());
      certificateData = {
        serviceAccountKey: JSON.stringify(keyData),
        projectId: keyData.project_id,
        packageName: metadata.packageName,
      };
    } else {
      throw new BadRequestException("Unsupported certificate type");
    }

    const createDto: CreatePushCertificateDto = {
      name: metadata.name,
      type: metadata.type,
      environment: metadata.environment,
      certificateData,
      projectId: metadata.projectId,
    };

    return this.createCertificate(tenantId, createDto);
  }

  async getCertificates(
    tenantId: string,
    filters: { projectId?: string; type?: string; status?: string; environment?: string } = {},
  ): Promise<PushCertificate[]> {
    const query = this.certificateRepository
      .createQueryBuilder("certificate")
      .leftJoinAndSelect("certificate.project", "project")
      .leftJoinAndSelect("certificate.createdBy", "createdBy")
      .where("certificate.tenantId = :tenantId", { tenantId });

    if (filters.projectId) {
      query.andWhere("certificate.projectId = :projectId", {
        projectId: filters.projectId,
      });
    }

    if (filters.type) {
      query.andWhere("certificate.type = :type", { type: filters.type });
    }

    if (filters.status) {
      query.andWhere("certificate.status = :status", { status: filters.status });
    }

    if (filters.environment) {
      query.andWhere("certificate.environment = :environment", {
        environment: filters.environment,
      });
    }

    query.orderBy("certificate.createdAt", "DESC");

    return query.getMany();
  }

  async getCertificate(id: string, tenantId: string): Promise<PushCertificate> {
    const certificate = await this.certificateRepository.findOne({
      where: { id, tenantId },
      relations: ["tenant", "project", "createdBy"],
    });

    if (!certificate) {
      throw new NotFoundException("Certificate not found");
    }

    return certificate;
  }

  async updateCertificate(
    id: string,
    tenantId: string,
    updateDto: UpdatePushCertificateDto,
  ): Promise<PushCertificate> {
    const certificate = await this.getCertificate(id, tenantId);

    // Validate updated certificate if critical fields changed
    if (updateDto.certificateData) {
      const tempCertificate = new PushCertificate();
      Object.assign(tempCertificate, certificate);
      tempCertificate.certificateData = updateDto.certificateData;

      const validation = tempCertificate.validateCertificate();
      if (!validation.isValid) {
        throw new BadRequestException(`Invalid certificate: ${validation.errors.join(", ")}`);
      }
    }

    await this.certificateRepository.update({ id, tenantId }, updateDto);

    const updatedCertificate = await this.getCertificate(id, tenantId);

    // Emit event
    this.eventEmitter.emit("certificate.updated", {
      certificateId: id,
      tenantId: certificate.tenantId,
      changes: updateDto,
    });

    return updatedCertificate;
  }

  async deleteCertificate(id: string, tenantId: string): Promise<void> {
    const certificate = await this.getCertificate(id, tenantId);

    await this.certificateRepository.remove(certificate);

    // Emit event
    this.eventEmitter.emit("certificate.deleted", {
      certificateId: id,
      tenantId: certificate.tenantId,
    });
  }

  async duplicateCertificate(
    id: string,
    tenantId: string,
    newName?: string,
  ): Promise<PushCertificate> {
    const originalCertificate = await this.getCertificate(id, tenantId);

    const duplicatedCertificate = this.certificateRepository.create({
      name: newName || `${originalCertificate.name} (Copy)`,
      description: originalCertificate.description,
      type: originalCertificate.type,
      environment: originalCertificate.environment,
      certificateData: originalCertificate.certificateData,
      allowedProjects: originalCertificate.allowedProjects,
      accessControl: originalCertificate.accessControl,
      rotationConfig: originalCertificate.rotationConfig,
      tags: [...(originalCertificate.tags || []), "duplicated"],
      tenantId: originalCertificate.tenantId,
      tenant: originalCertificate.tenant,
      projectId: originalCertificate.projectId,
      project: originalCertificate.project,
      status: CertificateStatus.PENDING_VALIDATION,
    });

    const result = await this.certificateRepository.save(duplicatedCertificate);

    // Emit event
    this.eventEmitter.emit("certificate.duplicated", {
      originalCertificateId: id,
      newCertificateId: result.id,
      tenantId: originalCertificate.tenantId,
    });

    return result;
  }
}
