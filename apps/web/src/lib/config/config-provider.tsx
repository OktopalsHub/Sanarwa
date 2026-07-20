'use client';

import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import {
  ApiConfig,
  configManager,
  config as defaultConfig,
  EnvironmentConfig,
  FeatureFlags,
  validateConfig
} from './environment';

interface ConfigContextValue {
  config: EnvironmentConfig;
  isFeatureEnabled: (feature: keyof FeatureFlags) => boolean;
  updateFeatureFlag: (flag: keyof FeatureFlags, enabled: boolean) => void;
  updateApiConfig: (updates: Partial<ApiConfig>) => void;
  isLoading: boolean;
  errors: string[];
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined);

interface ConfigProviderProps {
  children: ReactNode;
  initialConfig?: Partial<EnvironmentConfig>;
  enableRemoteConfig?: boolean;
  remoteConfigEndpoint?: string;
}

export function ConfigProvider({
  children,
  initialConfig,
  enableRemoteConfig = false,
  remoteConfigEndpoint
}: ConfigProviderProps) {
  const [config, setConfig] = useState<EnvironmentConfig>(() => ({
    ...defaultConfig,
    ...initialConfig,
  }));
  const [isLoading, setIsLoading] = useState(enableRemoteConfig);
  const [errors, setErrors] = useState<string[]>([]);

  // Load remote configuration if enabled
  useEffect(() => {
    if (!enableRemoteConfig || !remoteConfigEndpoint) {
      setIsLoading(false);
      return;
    }

    const loadRemoteConfig = async () => {
      try {
        const response = await fetch(remoteConfigEndpoint);
        if (!response.ok) {
          throw new Error(`Failed to load remote config: ${response.statusText}`);
        }

        const remoteConfig = await response.json();
        const mergedConfig = {
          ...defaultConfig,
          ...initialConfig,
          ...remoteConfig,
        };

        // Validate merged configuration
        const validationErrors = validateConfig(mergedConfig);
        if (validationErrors.length > 0) {
          setErrors(validationErrors);
          console.warn('Configuration validation errors:', validationErrors);
        } else {
          setErrors([]);
        }

        setConfig(mergedConfig);
      } catch (error) {
        console.error('Failed to load remote configuration:', error);
        setErrors([`Failed to load remote configuration: ${error instanceof Error ? error.message : 'Unknown error'}`]);
      } finally {
        setIsLoading(false);
      }
    };

    loadRemoteConfig();
  }, [enableRemoteConfig, remoteConfigEndpoint, initialConfig]);

  // Sync ConfigManager with provider config
  useEffect(() => {
    // Update ConfigManager with current config
    Object.entries(config.features).forEach(([key, value]) => {
      configManager.updateFeatureFlag(key as keyof FeatureFlags, value);
    });
    configManager.updateApiConfig(config.api);
  }, [config]);

  // Validate initial configuration
  useEffect(() => {
    const validationErrors = validateConfig(config);
    setErrors(validationErrors);

    if (validationErrors.length > 0) {
      console.warn('Configuration validation errors:', validationErrors);
    }
  }, [config]);

  const isFeatureEnabled = (feature: keyof FeatureFlags): boolean => {
    return config.features[feature];
  };

  const updateFeatureFlag = (flag: keyof FeatureFlags, enabled: boolean): void => {
    configManager.updateFeatureFlag(flag, enabled);

    // Trigger re-render by updating config state
    setConfig(prevConfig => ({
      ...prevConfig,
      features: {
        ...prevConfig.features,
        [flag]: enabled,
      },
    }));
  };

  const updateApiConfig = (updates: Partial<ApiConfig>): void => {
    configManager.updateApiConfig(updates);

    // Trigger re-render by updating config state
    setConfig(prevConfig => ({
      ...prevConfig,
      api: {
        ...prevConfig.api,
        ...updates,
      },
    }));
  };

  const contextValue: ConfigContextValue = {
    config,
    isFeatureEnabled,
    updateFeatureFlag,
    updateApiConfig,
    isLoading,
    errors,
  };

  return (
    <ConfigContext.Provider value={contextValue}>
      {children}
    </ConfigContext.Provider>
  );
}

/**
 * Hook to access configuration context
 */
export function useConfig(): ConfigContextValue {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}

/**
 * Hook to access specific configuration section
 */
export function useConfigSection<K extends keyof EnvironmentConfig>(
  section: K
): EnvironmentConfig[K] {
  const { config } = useConfig();
  return config[section];
}

/**
 * Hook to check if a feature is enabled
 */
export function useFeatureFlag(feature: keyof FeatureFlags): boolean {
  const { isFeatureEnabled } = useConfig();
  return isFeatureEnabled(feature);
}

/**
 * Hook to access API configuration
 */
export function useApiConfig(): ApiConfig & {
  updateConfig: (updates: Partial<ApiConfig>) => void;
} {
  const { config, updateApiConfig } = useConfig();
  return {
    ...config.api,
    updateConfig: updateApiConfig,
  };
}

/**
 * Hook to access feature flags with update capability
 */
export function useFeatureFlags(): FeatureFlags & {
  updateFlag: (flag: keyof FeatureFlags, enabled: boolean) => void;
  isEnabled: (flag: keyof FeatureFlags) => boolean;
} {
  const { config, updateFeatureFlag, isFeatureEnabled } = useConfig();

  return {
    ...config.features,
    updateFlag: updateFeatureFlag,
    isEnabled: isFeatureEnabled,
  };
}

/**
 * Hook for environment-aware behavior
 */
export function useEnvironment() {
  const { config } = useConfig();

  return {
    environment: config.app.environment,
    isDevelopment: config.app.environment === 'development',
    isProduction: config.app.environment === 'production',
    isStaging: config.app.environment === 'staging',
    isTest: config.app.environment === 'test',
    version: config.app.version,
    buildTime: config.app.buildTime,
    buildId: config.app.buildId,
  };
}

/**
 * Hook for configuration validation
 */
export function useConfigValidation() {
  const { errors, isLoading } = useConfig();

  return {
    errors,
    isValid: errors.length === 0,
    isLoading,
    hasErrors: errors.length > 0,
  };
}

/**
 * Higher-order component for feature gating
 */
export function withFeatureFlag<P extends object>(
  feature: keyof FeatureFlags,
  fallback?: React.ComponentType<P> | React.ReactElement | null
) {
  return function FeatureGatedComponent(Component: React.ComponentType<P>) {
    return function WrappedComponent(props: P) {
      const isEnabled = useFeatureFlag(feature);

      if (!isEnabled) {
        if (fallback === null) return null;
        if (React.isValidElement(fallback)) return fallback;
        if (fallback) {
          const FallbackComponent = fallback;
          return <FallbackComponent {...props} />;
        }
        return null;
      }

      return <Component {...props} />;
    };
  };
}

/**
 * Component for conditional rendering based on feature flags
 */
interface FeatureGateProps {
  feature: keyof FeatureFlags;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  const isEnabled = useFeatureFlag(feature);

  if (!isEnabled) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Component for environment-specific rendering
 */
interface EnvironmentGateProps {
  environments: Array<'development' | 'staging' | 'production' | 'test'>;
  children: ReactNode;
  fallback?: ReactNode;
}

export function EnvironmentGate({ environments, children, fallback = null }: EnvironmentGateProps) {
  const { environment } = useEnvironment();

  if (!environments.includes(environment)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Debug component for development
 */
export function ConfigDebugPanel() {
  const { config, errors } = useConfig();
  const { isDevelopment } = useEnvironment();

  if (!isDevelopment) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      right: 0,
      width: '400px',
      maxHeight: '300px',
      overflow: 'auto',
      backgroundColor: '#1a1a1a',
      color: '#fff',
      padding: '16px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 9999,
      border: '1px solid #333',
    }}>
      <h4 style={{ margin: '0 0 8px 0', color: '#4ade80' }}>Configuration Debug</h4>

      {errors.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <strong style={{ color: '#ef4444' }}>Errors:</strong>
          <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
            {errors.map((error, index) => (
              <li key={index} style={{ color: '#ef4444' }}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <details>
        <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>
          Environment: {config.app.environment}
        </summary>
        <pre style={{
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontSize: '10px',
          maxHeight: '200px',
          overflow: 'auto'
        }}>
          {JSON.stringify(config, null, 2)}
        </pre>
      </details>
    </div>
  );
}