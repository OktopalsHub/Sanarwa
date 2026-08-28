import { ProviderConfig } from "./provider-config.entity";
import { ProviderEncryptionService } from "./provider-encryption.service";

export async function decryptProviderConfig(
  encryptionService: ProviderEncryptionService,
  config: ProviderConfig,
): Promise<ProviderConfig> {
  const decryptedConfig = await encryptionService.decrypt(config.config);
  return {
    ...config,
    config: decryptedConfig,
  } as ProviderConfig;
}

export async function decryptProviderConfigs(
  encryptionService: ProviderEncryptionService,
  configs: ProviderConfig[],
): Promise<ProviderConfig[]> {
  return Promise.all(configs.map((config) => decryptProviderConfig(encryptionService, config)));
}

export function getProviderCacheKey(config: ProviderConfig): string {
  return `${config.tenantId}:${config.providerId}:${config.channel}`;
}
