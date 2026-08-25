/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConfigDebugPanel,
  ConfigProvider,
  EnvironmentGate,
  FeatureGate,
  useApiConfig,
  useConfig,
  useConfigSection,
  useConfigValidation,
  useEnvironment,
  useFeatureFlag,
  useFeatureFlags,
  withFeatureFlag,
} from "../config-provider";
import { createEnvironmentConfig, type EnvironmentConfig } from "../environment";

// Mock fetch for remote config tests
global.fetch = vi.fn();

const createWrapper = (initialConfig?: Partial<EnvironmentConfig>, enableRemoteConfig = false) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        initialConfig={initialConfig}
        enableRemoteConfig={enableRemoteConfig}
        remoteConfigEndpoint={enableRemoteConfig ? "/api/config" : undefined}
      >
        {children}
      </ConfigProvider>
    </QueryClientProvider>
  );
};

// Helper to create complete config objects
const createCompleteConfig = (overrides: any = {}) => {
  const defaults = {
    app: {
      name: "Test App",
      version: "1.0.0",
      environment: "development" as const,
      buildTime: new Date().toISOString(),
      appUrl: "http://localhost:3000",
    },
    api: {
      baseUrl: "http://localhost:9000",
      timeout: 5000,
      retryAttempts: 3,
      retryDelay: 1000,
      maxRetryDelay: 5000,
      enableRetry: true,
    },
    features: {
      enableAnalytics: true,
      enableErrorReporting: true,
      enablePerformanceMonitoring: true,
      enableWebRTC: true,
      enableRealTimeNotifications: true,
      enableAdvancedTemplating: true,
      enableMultiTenant: true,
      enableBrandingCustomization: true,
      enableWorkflows: true,
      enableAPIPlayground: true,
    },
  };

  return {
    ...defaults,
    ...overrides,
    app: { ...defaults.app, ...overrides.app },
    api: { ...defaults.api, ...overrides.api },
    features: { ...defaults.features, ...overrides.features },
  };
};

describe("ConfigProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic functionality", () => {
    it("should provide configuration context", () => {
      const { result } = renderHook(() => useConfig(), {
        wrapper: createWrapper(),
      });

      expect(result.current.config).toBeDefined();
      expect(result.current.isFeatureEnabled).toBeInstanceOf(Function);
      expect(result.current.updateFeatureFlag).toBeInstanceOf(Function);
      expect(result.current.updateApiConfig).toBeInstanceOf(Function);
      expect(typeof result.current.isLoading).toBe("boolean");
      expect(Array.isArray(result.current.errors)).toBe(true);
    });

    it("should merge initial config with defaults", () => {
      const initialConfig = {
        app: {
          name: "Custom App",
          version: "1.0.0",
          environment: "development" as const,
          buildTime: new Date().toISOString(),
          appUrl: "http://localhost:3000",
        },
        api: {
          timeout: 15000,
          baseUrl: "http://localhost:9000",
          retryAttempts: 3,
          retryDelay: 1000,
          maxRetryDelay: 5000,
          enableRetry: true,
        },
      };

      const { result } = renderHook(() => useConfig(), {
        wrapper: createWrapper(initialConfig),
      });

      expect(result.current.config.app.name).toBe("Custom App");
      expect(result.current.config.api.timeout).toBe(15000);
      expect(result.current.config.api.baseUrl).toBeDefined(); // Should have default
    });

    it("should throw error when used outside provider", () => {
      expect(() => {
        renderHook(() => useConfig());
      }).toThrow("useConfig must be used within a ConfigProvider");
    });
  });

  describe("Feature flags", () => {
    it("should check feature flags", () => {
      const { result } = renderHook(() => useFeatureFlag("enableAnalytics"), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current).toBe("boolean");
    });

    it("should update feature flags", () => {
      const { result } = renderHook(() => useConfig(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updateFeatureFlag("enableAnalytics", true);
      });

      expect(result.current.isFeatureEnabled("enableAnalytics")).toBe(true);

      act(() => {
        result.current.updateFeatureFlag("enableAnalytics", false);
      });

      expect(result.current.isFeatureEnabled("enableAnalytics")).toBe(false);
    });

    it("should provide feature flags with update capability", () => {
      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.enableAnalytics).toBe("boolean");
      expect(typeof result.current.enableWebRTC).toBe("boolean");
      expect(result.current.updateFlag).toBeInstanceOf(Function);
      expect(result.current.isEnabled).toBeInstanceOf(Function);

      act(() => {
        result.current.updateFlag("enableAnalytics", true);
      });

      expect(result.current.isEnabled("enableAnalytics")).toBe(true);
    });
  });

  describe("API configuration", () => {
    it("should provide API config with update capability", () => {
      const { result } = renderHook(() => useApiConfig(), {
        wrapper: createWrapper(),
      });

      expect(result.current.baseUrl).toBeDefined();
      expect(result.current.timeout).toBeGreaterThan(0);
      expect(result.current.updateConfig).toBeInstanceOf(Function);
    });

    it("should update API configuration", () => {
      const { result } = renderHook(() => useApiConfig(), {
        wrapper: createWrapper(),
      });

      const originalTimeout = result.current.timeout;

      act(() => {
        result.current.updateConfig({ timeout: 20000 });
      });

      expect(result.current.timeout).toBe(20000);
      expect(result.current.timeout).not.toBe(originalTimeout);
    });
  });

  describe("Configuration sections", () => {
    it("should provide specific config sections", () => {
      const { result } = renderHook(() => useConfigSection("api"), {
        wrapper: createWrapper(),
      });

      expect(result.current.baseUrl).toBeDefined();
      expect(result.current.timeout).toBeGreaterThan(0);
      expect(result.current.retryAttempts).toBeGreaterThanOrEqual(0);
    });

    it("should provide environment information", () => {
      const { result } = renderHook(() => useEnvironment(), {
        wrapper: createWrapper(),
      });

      expect(["development", "staging", "production", "test"]).toContain(
        result.current.environment,
      );
      expect(typeof result.current.isDevelopment).toBe("boolean");
      expect(typeof result.current.isProduction).toBe("boolean");
      expect(typeof result.current.isStaging).toBe("boolean");
      expect(typeof result.current.isTest).toBe("boolean");
      expect(result.current.version).toBeDefined();
    });

    it("should provide validation information", () => {
      const { result } = renderHook(() => useConfigValidation(), {
        wrapper: createWrapper(),
      });

      expect(Array.isArray(result.current.errors)).toBe(true);
      expect(typeof result.current.isValid).toBe("boolean");
      expect(typeof result.current.isLoading).toBe("boolean");
      expect(typeof result.current.hasErrors).toBe("boolean");
    });
  });

  describe("Remote configuration", () => {
    it("should load remote configuration successfully", async () => {
      const remoteConfig = {
        features: { enableAnalytics: true },
        api: {
          timeout: 25000,
          baseUrl: "http://localhost:9000", // Add required field
        },
        app: {
          appUrl: "http://localhost:3000", // Add required field
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => remoteConfig,
      });

      const { result } = renderHook(() => useConfig(), {
        wrapper: createWrapper(undefined, true),
      });

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.config.features.enableAnalytics).toBe(true);
      expect(result.current.config.api.timeout).toBe(25000);
      expect(result.current.errors).toHaveLength(0);
    });

    it("should handle remote configuration failure", async () => {
      (fetch as any).mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useConfig(), {
        wrapper: createWrapper(undefined, true),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.errors.length).toBeGreaterThan(0);
      expect(result.current.errors[0]).toContain("Network error");
    });

    it("should handle invalid remote configuration", async () => {
      const invalidConfig = {
        api: { baseUrl: "invalid-url" },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => invalidConfig,
      });

      const { result } = renderHook(() => useConfig(), {
        wrapper: createWrapper(undefined, true),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.errors.length).toBeGreaterThan(0);
    });

    it("should handle HTTP error responses", async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: "Not Found",
      });

      const { result } = renderHook(() => useConfig(), {
        wrapper: createWrapper(undefined, true),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.errors.length).toBeGreaterThan(0);
      expect(result.current.errors[0]).toContain("Not Found");
    });
  });

  describe("Configuration validation", () => {
    it("should validate configuration and show errors", () => {
      const invalidConfig = createCompleteConfig({
        api: { baseUrl: "invalid-url", timeout: -1 },
      });

      const { result } = renderHook(() => useConfig(), {
        wrapper: createWrapper(invalidConfig),
      });

      expect(result.current.errors.length).toBeGreaterThan(0);
    });

    it("should show no errors for valid configuration", () => {
      const validConfig = createEnvironmentConfig();

      const { result } = renderHook(() => useConfig(), {
        wrapper: createWrapper(validConfig),
      });

      expect(result.current.errors).toHaveLength(0);
    });
  });
});

describe("FeatureGate", () => {
  it("should render children when feature is enabled", () => {
    const initialConfig = createCompleteConfig({
      features: { enableAnalytics: true },
    });

    render(
      <FeatureGate feature="enableAnalytics">
        <div>Analytics Content</div>
      </FeatureGate>,
      { wrapper: createWrapper(initialConfig) },
    );

    expect(screen.getByText("Analytics Content")).toBeInTheDocument();
  });

  it("should not render children when feature is disabled", () => {
    const initialConfig = createCompleteConfig({
      features: { enableAnalytics: false },
    });

    render(
      <FeatureGate feature="enableAnalytics">
        <div>Analytics Content</div>
      </FeatureGate>,
      { wrapper: createWrapper(initialConfig) },
    );

    expect(screen.queryByText("Analytics Content")).not.toBeInTheDocument();
  });

  it("should render fallback when feature is disabled", () => {
    const initialConfig = createCompleteConfig({
      features: { enableAnalytics: false },
    });

    render(
      <FeatureGate feature="enableAnalytics" fallback={<div>Feature Disabled</div>}>
        <div>Analytics Content</div>
      </FeatureGate>,
      { wrapper: createWrapper(initialConfig) },
    );

    expect(screen.getByText("Feature Disabled")).toBeInTheDocument();
    expect(screen.queryByText("Analytics Content")).not.toBeInTheDocument();
  });
});

describe("EnvironmentGate", () => {
  it("should render children in matching environment", () => {
    const initialConfig = createCompleteConfig({
      app: { environment: "development" as const },
    });

    render(
      <EnvironmentGate environments={["development", "staging"]}>
        <div>Dev/Staging Content</div>
      </EnvironmentGate>,
      { wrapper: createWrapper(initialConfig) },
    );

    expect(screen.getByText("Dev/Staging Content")).toBeInTheDocument();
  });

  it("should not render children in non-matching environment", () => {
    const initialConfig = createCompleteConfig({
      app: { environment: "production" as const },
    });

    render(
      <EnvironmentGate environments={["development", "staging"]}>
        <div>Dev/Staging Content</div>
      </EnvironmentGate>,
      { wrapper: createWrapper(initialConfig) },
    );

    expect(screen.queryByText("Dev/Staging Content")).not.toBeInTheDocument();
  });

  it("should render fallback in non-matching environment", () => {
    const initialConfig = createCompleteConfig({
      app: { environment: "production" as const },
    });

    render(
      <EnvironmentGate environments={["development"]} fallback={<div>Production Content</div>}>
        <div>Dev Content</div>
      </EnvironmentGate>,
      { wrapper: createWrapper(initialConfig) },
    );

    expect(screen.getByText("Production Content")).toBeInTheDocument();
    expect(screen.queryByText("Dev Content")).not.toBeInTheDocument();
  });
});

describe("withFeatureFlag HOC", () => {
  const TestComponent = ({ message }: { message: string }) => <div>{message}</div>;

  it("should render component when feature is enabled", () => {
    const initialConfig = createCompleteConfig({
      features: { enableAnalytics: true },
    });

    const WrappedComponent = withFeatureFlag<{ message: string }>("enableAnalytics")(TestComponent);

    render(<WrappedComponent message="Test Message" />, { wrapper: createWrapper(initialConfig) });

    expect(screen.getByText("Test Message")).toBeInTheDocument();
  });

  it("should not render component when feature is disabled", () => {
    const initialConfig = createCompleteConfig({
      features: { enableAnalytics: false },
    });

    const WrappedComponent = withFeatureFlag<{ message: string }>("enableAnalytics")(TestComponent);

    render(<WrappedComponent message="Test Message" />, { wrapper: createWrapper(initialConfig) });

    expect(screen.queryByText("Test Message")).not.toBeInTheDocument();
  });

  it("should render fallback component when feature is disabled", () => {
    const initialConfig = createCompleteConfig({
      features: { enableAnalytics: false },
    });

    const FallbackComponent = ({ message }: { message: string }) => <div>Fallback: {message}</div>;

    const WrappedComponent = withFeatureFlag<{ message: string }>(
      "enableAnalytics",
      FallbackComponent,
    )(TestComponent);

    render(<WrappedComponent message="Test Message" />, { wrapper: createWrapper(initialConfig) });

    expect(screen.getByText("Fallback: Test Message")).toBeInTheDocument();
    expect(screen.queryByText("Test Message")).not.toBeInTheDocument();
  });

  it("should render fallback element when feature is disabled", () => {
    const initialConfig = createCompleteConfig({
      features: { enableAnalytics: false },
    });

    const fallbackElement = <div>Feature Not Available</div>;
    const WrappedComponent = withFeatureFlag<{ message: string }>(
      "enableAnalytics",
      fallbackElement,
    )(TestComponent);

    render(<WrappedComponent message="Test Message" />, { wrapper: createWrapper(initialConfig) });

    expect(screen.getByText("Feature Not Available")).toBeInTheDocument();
    expect(screen.queryByText("Test Message")).not.toBeInTheDocument();
  });

  it("should render nothing when feature is disabled and fallback is null", () => {
    const initialConfig = createCompleteConfig({
      features: { enableAnalytics: false },
      app: { appUrl: "http://localhost:3000" },
      api: { baseUrl: "http://localhost:9000" },
    });

    const WrappedComponent = withFeatureFlag<{ message: string }>(
      "enableAnalytics",
      null,
    )(TestComponent);

    const { container } = render(<WrappedComponent message="Test Message" />, {
      wrapper: createWrapper(initialConfig),
    });

    expect(container.firstChild).toBeNull();
  });
});

describe("ConfigDebugPanel", () => {
  it("should render in development environment", () => {
    const initialConfig = createCompleteConfig({
      app: { environment: "development" as const },
    });

    render(<ConfigDebugPanel />, { wrapper: createWrapper(initialConfig) });

    expect(screen.getByText("Configuration Debug")).toBeInTheDocument();
    expect(screen.getByText(/Environment: development/)).toBeInTheDocument();
  });

  it("should not render in production environment", () => {
    const initialConfig = createCompleteConfig({
      app: { environment: "production" as const },
    });

    render(<ConfigDebugPanel />, { wrapper: createWrapper(initialConfig) });

    expect(screen.queryByText("Configuration Debug")).not.toBeInTheDocument();
  });

  it("should show errors when present", () => {
    const initialConfig = createCompleteConfig({
      app: { environment: "development" as const },
      api: { baseUrl: "invalid-url" },
    });

    render(<ConfigDebugPanel />, { wrapper: createWrapper(initialConfig) });

    expect(screen.getByText("Errors:")).toBeInTheDocument();
  });

  it("should show configuration details", () => {
    const initialConfig = createCompleteConfig({
      app: { environment: "development" as const },
    });

    render(<ConfigDebugPanel />, { wrapper: createWrapper(initialConfig) });

    // Should have a details element for configuration
    const details = screen.getByRole("group");
    expect(details).toBeInTheDocument();
  });
});

describe("Integration tests", () => {
  it("should handle complex configuration updates", () => {
    const { result } = renderHook(
      () => {
        const config = useConfig();
        const apiConfig = useApiConfig();
        const featureFlags = useFeatureFlags();

        return { config, apiConfig, featureFlags };
      },
      {
        wrapper: createWrapper(),
      },
    );

    // Update API config
    act(() => {
      result.current.apiConfig.updateConfig({ timeout: 30000 });
    });

    expect(result.current.config.config.api.timeout).toBe(30000);

    // Update feature flag
    act(() => {
      result.current.featureFlags.updateFlag("enableAnalytics", true);
    });

    expect(result.current.config.config.features.enableAnalytics).toBe(true);
    expect(result.current.featureFlags.enableAnalytics).toBe(true);
  });

  it("should maintain consistency across hooks", () => {
    const { result } = renderHook(
      () => {
        const config = useConfig();
        const environment = useEnvironment();
        const validation = useConfigValidation();

        return { config, environment, validation };
      },
      {
        wrapper: createWrapper(),
      },
    );

    expect(result.current.config.config.app.environment).toBe(
      result.current.environment.environment,
    );
    expect(result.current.config.errors).toBe(result.current.validation.errors);
    expect(result.current.config.isLoading).toBe(result.current.validation.isLoading);
  });
});
