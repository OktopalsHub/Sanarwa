import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DigestService } from './digest.service';
import { SchedulingService } from './scheduling.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [DigestService, SchedulingService],
  exports: [DigestService, SchedulingService],
})
export class MessagingServicesModule {}
