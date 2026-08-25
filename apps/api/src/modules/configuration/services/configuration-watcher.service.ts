import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Configuration, ConfigurationScope } from "../entities/configuration.entity";
import { ConfigurationCacheService } from "./configuration-cache.service";

export interface ConfigurationChangeEvent {
  key: string;
  scope: ConfigurationScope;
  scopeId?: string;
  environment: string;
  oldValue?: string;
  newValue: string;
  action: "create" | "update" | "delete";
  timestamp: Date;
}

export interface WatchOptions {
  pollInterval?: number; // Polling interval in milliseconds
  enableHotReload?: boolean;
  watchPatterns?: string[]; // Key patterns to watch
}

@Injectable()
export class ConfigurationWatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConfigurationWatcherService.name);
  private watchInterval: NodeJS.Timeout | null = null;
  private lastCheckTimestamp: Date = new Date();
  private isWatching = false;
  private watchedConfigurations = new Map<string, Configuration>();

  private readonly options: WatchOptions;

  constructor(
    @InjectRepository(Configuration)
    private readonly configRepository: Repository<Configuration>,
    private readonly cacheService: ConfigurationCacheService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    this.options = {
      pollInterval: this.configService.get<number>("CONFIG_WATCH_INTERVAL", 30000), // 30 seconds
      enableHotReload: this.configService.get<boolean>("CONFIG_HOT_RELOAD_ENABLED", true),
      watchPatterns: this.configService.get<string>("CONFIG_WATCH_PATTERNS", "*").split(","),
    };
  }

  async onModuleInit(): Promise<void> {
    if (this.options.enableHotReload) {
      await this.startWatching();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.stopWatching();
  }

  /**
   * Start watching for configuration changes
   */
  async startWatching(): Promise<void> {
    if (this.isWatching) {
      this.logger.warn("Configuration watcher is already running");
      return;
    }

    this.logger.log("Starting configuration watcher");
    this.isWatching = true;

    // Load initial configurations
    await this.loadWatchedConfigurations();

    // Start polling for changes
    this.watchInterval = setInterval(() => this.checkForChanges(), this.options.pollInterval);

    this.logger.log(`Configuration watcher started with ${this.options.pollInterval}ms interval`);
  }

  /**
   * Stop watching for configuration changes
   */
  async stopWatching(): Promise<void> {
    if (!this.isWatching) {
      return;
    }

    this.logger.log("Stopping configuration watcher");
    this.isWatching = false;

    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }

    this.watchedConfigurations.clear();
    this.logger.log("Configuration watcher stopped");
  }

  /**
   * Add configuration key to watch list
   */
  async watchConfiguration(
    key: string,
    scope: ConfigurationScope = ConfigurationScope.GLOBAL,
    scopeId?: string,
    environment?: string,
  ): Promise<void> {
    const watchKey = this.buildWatchKey(key, scope, scopeId, environment);

    const whereCondition: any = {
      key,
      isActive: true,
    };

    if (scope === ConfigurationScope.TENANT && scopeId) {
      whereCondition.tenantId = scopeId;
    }

    const configuration = await this.configRepository.findOne({
      where: whereCondition,
    });

    if (configuration) {
      this.watchedConfigurations.set(watchKey, configuration);
      this.logger.debug(`Added configuration to watch list: ${watchKey}`);
    }
  }

  /**
   * Remove configuration from watch list
   */
  unwatchConfiguration(
    key: string,
    scope: ConfigurationScope = ConfigurationScope.GLOBAL,
    scopeId?: string,
    environment?: string,
  ): void {
    const watchKey = this.buildWatchKey(key, scope, scopeId, environment);
    this.watchedConfigurations.delete(watchKey);
    this.logger.debug(`Removed configuration from watch list: ${watchKey}`);
  }

  /**
   * Get list of watched configurations
   */
  getWatchedConfigurations(): string[] {
    return Array.from(this.watchedConfigurations.keys());
  }

  /**
   * Force check for configuration changes
   */
  async forceCheck(): Promise<ConfigurationChangeEvent[]> {
    this.logger.debug("Forcing configuration change check");
    return this.checkForChanges();
  }

  /**
   * Check for configuration changes
   */
  private async checkForChanges(): Promise<ConfigurationChangeEvent[]> {
    try {
      const changes: ConfigurationChangeEvent[] = [];
      const currentTimestamp = new Date();

      // Get all configurations that might have changed since last check
      const recentConfigurations = await this.configRepository
        .createQueryBuilder("config")
        .where("config.updatedAt > :lastCheck", {
          lastCheck: this.lastCheckTimestamp,
        })
        .getMany();

      // Check for changes in watched configurations
      for (const [watchKey, oldConfig] of this.watchedConfigurations.entries()) {
        const currentConfig = recentConfigurations.find(
          (config) =>
            this.buildWatchKey(config.key, config.scope, config.scopeId, config.environment) ===
            watchKey,
        );

        if (currentConfig) {
          // Configuration was updated
          if (
            currentConfig.value !== oldConfig.value ||
            currentConfig.updatedAt > oldConfig.updatedAt
          ) {
            const changeEvent: ConfigurationChangeEvent = {
              key: currentConfig.key,
              scope: currentConfig.scope,
              scopeId: currentConfig.scopeId,
              environment: currentConfig.environment,
              oldValue: oldConfig.value,
              newValue: currentConfig.value,
              action: "update",
              timestamp: currentConfig.updatedAt,
            };

            changes.push(changeEvent);
            this.watchedConfigurations.set(watchKey, currentConfig);

            // Invalidate cache
            await this.cacheService.invalidate(
              currentConfig.key,
              currentConfig.scope,
              currentConfig.scopeId,
              currentConfig.environment,
            );

            // Emit change event
            this.eventEmitter.emit("configuration.changed", changeEvent);
            this.logger.log(`Configuration changed: ${watchKey}`);
          }
        }
      }

      // Check for new configurations matching watch patterns
      for (const config of recentConfigurations) {
        const watchKey = this.buildWatchKey(
          config.key,
          config.scope,
          config.scopeId,
          config.environment,
        );

        if (
          !this.watchedConfigurations.has(watchKey) &&
          this.shouldWatchConfiguration(config.key)
        ) {
          const changeEvent: ConfigurationChangeEvent = {
            key: config.key,
            scope: config.scope,
            scopeId: config.scopeId,
            environment: config.environment,
            newValue: config.value,
            action: "create",
            timestamp: config.createdAt,
          };

          changes.push(changeEvent);
          this.watchedConfigurations.set(watchKey, config);

          // Emit change event
          this.eventEmitter.emit("configuration.created", changeEvent);
          this.logger.log(`New configuration detected: ${watchKey}`);
        }
      }

      this.lastCheckTimestamp = currentTimestamp;
      return changes;
    } catch (error) {
      this.logger.error("Error checking for configuration changes:", error);
      return [];
    }
  }

  /**
   * Load configurations to watch based on patterns
   */
  private async loadWatchedConfigurations(): Promise<void> {
    try {
      const queryBuilder = this.configRepository.createQueryBuilder("config");

      // Build query for watch patterns
      if (this.options.watchPatterns && this.options.watchPatterns.length > 0) {
        const conditions = this.options.watchPatterns
          .filter((pattern) => pattern !== "*")
          .map((pattern, index) => `config.key ILIKE :pattern${index}`)
          .join(" OR ");

        if (conditions) {
          queryBuilder.where(`(${conditions})`);

          // Add parameters for patterns
          this.options.watchPatterns.forEach((pattern, index) => {
            if (pattern !== "*") {
              queryBuilder.setParameter(`pattern${index}`, pattern.replace("*", "%"));
            }
          });
        }
      }

      const configurations = await queryBuilder.getMany();

      this.watchedConfigurations.clear();
      for (const config of configurations) {
        const watchKey = this.buildWatchKey(
          config.key,
          config.scope,
          config.scopeId,
          config.environment,
        );
        this.watchedConfigurations.set(watchKey, config);
      }

      this.logger.log(`Loaded ${configurations.length} configurations to watch`);
    } catch (error) {
      this.logger.error("Error loading watched configurations:", error);
    }
  }

  /**
   * Check if a configuration key should be watched based on patterns
   */
  private shouldWatchConfiguration(key: string): boolean {
    if (!this.options.watchPatterns || this.options.watchPatterns.includes("*")) {
      return true;
    }

    return this.options.watchPatterns.some((pattern) => {
      if (pattern === "*") return true;

      // Convert glob pattern to regex
      const regexPattern = pattern.replace(/\*/g, ".*").replace(/\?/g, ".");

      return new RegExp(`^${regexPattern}$`).test(key);
    });
  }

  /**
   * Build watch key from configuration parameters
   */
  private buildWatchKey(
    key: string,
    scope: ConfigurationScope,
    scopeId?: string,
    environment?: string,
  ): string {
    const parts = [key, scope];

    if (scopeId) {
      parts.push(scopeId);
    }

    if (environment) {
      parts.push(environment);
    }

    return parts.join(":");
  }

  /**
   * Get watcher status and statistics
   */
  getStatus(): {
    isWatching: boolean;
    watchedCount: number;
    lastCheck: Date;
    pollInterval: number;
    watchPatterns: string[];
  } {
    return {
      isWatching: this.isWatching,
      watchedCount: this.watchedConfigurations.size,
      lastCheck: this.lastCheckTimestamp,
      pollInterval: this.options.pollInterval || 0,
      watchPatterns: this.options.watchPatterns || [],
    };
  }

  /**
   * Reload watched configurations
   */
  async reload(): Promise<void> {
    this.logger.log("Reloading watched configurations");
    await this.loadWatchedConfigurations();

    // Clear cache to force fresh reads
    await this.cacheService.clear();

    this.eventEmitter.emit("configuration.reloaded", {
      timestamp: new Date(),
      watchedCount: this.watchedConfigurations.size,
    });
  }
}
