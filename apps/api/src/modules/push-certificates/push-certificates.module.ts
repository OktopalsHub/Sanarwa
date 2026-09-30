import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MulterModule } from "@nestjs/platform-express";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { PushCertificateController } from "./controllers/push-certificate.controller";
import { PushCertificateService } from "./services/push-certificate.service";
import { PushCertificateCrudService } from "./services/push-certificate-crud.service";
import { PushCertificate } from "./entities/push-certificate.entity";
import { TenantModule } from "../tenant/tenant.module";
import { TenantMemberModule } from "../tenant-member/tenant-member.module";
import { ProjectModule } from "../project/project.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([PushCertificate]),
    MulterModule.register({
      dest: "./uploads/certificates",
    }),
    EventEmitterModule,
    TenantModule,
    TenantMemberModule,
    ProjectModule,
  ],
  controllers: [PushCertificateController],
  providers: [PushCertificateService, PushCertificateCrudService],
  exports: [PushCertificateService, PushCertificateCrudService],
})
export class PushCertificatesModule {}
