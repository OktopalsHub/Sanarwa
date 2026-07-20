import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from 'src/common/security/security.module';
import { ConfigurationController } from './controllers/configuration.controller';
import { ConfigurationVersion } from './entities/configuration-version.entity';
import { Configuration } from './entities/configuration.entity';
import { ConfigurationCacheService } from './services/configuration-cache.service';
import { ConfigurationValidationService } from './services/configuration-validation.service';
import { ConfigurationWatcherService } from './services/configuration-watcher.service';
import { ConfigurationService } from './services/configuration.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Configuration, ConfigurationVersion]),
    EventEmitterModule,
    SecurityModule,
  ],
  providers: [
    ConfigurationService,
    ConfigurationValidationService,
    ConfigurationWatcherService,
    ConfigurationCacheService,
  ],
  controllers: [ConfigurationController],
  exports: [
    ConfigurationService,
    ConfigurationValidationService,
    ConfigurationWatcherService,
    ConfigurationCacheService,
  ],
})
export class ConfigurationModule {}
