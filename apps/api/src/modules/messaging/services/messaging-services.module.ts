import { Module } from "@nestjs/common";
import { DigestService } from "./digest.service";
import { SchedulingService } from "./scheduling.service";

@Module({
  imports: [],
  providers: [DigestService, SchedulingService],
  exports: [DigestService, SchedulingService],
})
export class MessagingServicesModule {}
