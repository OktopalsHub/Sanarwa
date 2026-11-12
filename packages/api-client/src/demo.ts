import { ApiClient, createApiClient } from "./client";
import { getApiConfig } from "./config";
import { ApiErrorHandler } from "./error-handler";

export function demoApiClientSetup() {
  console.log("=== API Client Infrastructure Demo ===");

  const config = getApiConfig();
  console.log("API Configuration:", {
    baseUrl: config.baseUrl,
    timeout: config.timeout,
    retryAttempts: config.retryAttempts,
  });

  const apiClient = createApiClient({
    timeout: 15000,
    retryAttempts: 2,
  });

  console.log("API Client created with custom configuration");

  apiClient.setAuthToken("demo-access-token");
  apiClient.setRefreshToken("demo-refresh-token");
  console.log("JWT tokens set for authentication");

  apiClient.setTenant("demo-tenant-id");
  console.log("Tenant context set:", apiClient.getTenant());

  const demoError = new Error("Demo API error") as any;
  demoError.status = 401;
  demoError.code = "UNAUTHORIZED";
  demoError.isAxiosError = true;

  console.log("Error handling demo:");
  ApiErrorHandler.handle(demoError, { showToast: false, logError: true });

  console.log("WebSocket connection capability available");

  console.log("=== Demo Complete ===");

  return {
    apiClient,
    config,
    features: {
      axiosIntegration: true,
      jwtTokenManagement: true,
      automaticRefresh: true,
      requestResponseInterceptors: true,
      environmentConfiguration: true,
      errorHandling: true,
      retryLogic: true,
      tenantScoping: true,
      webSocketSupport: true,
    },
  };
}

export const exampleUsage = {
  async makeApiCalls(client: ApiClient) {
    try {
      const users = await client.get("/users", { page: 1, limit: 10 });

      const newUser = await client.post("/users", {
        name: "John Doe",
        email: "john@example.com",
      });

      const updatedUser = await client.put("/users/123", {
        name: "John Smith",
      });

      await client.delete("/users/123");

      return { users, newUser, updatedUser };
    } catch (error) {
      ApiErrorHandler.handle(error as any);
      throw error;
    }
  },

  async tenantOperations(client: ApiClient) {
    client.setTenant("tenant-123");

    const tenantData = await client.get("/tenant/dashboard");
    const notifications = await client.get("/notifications");

    return { tenantData, notifications };
  },

  async authenticationFlow(client: ApiClient) {
    const authResponse = await client.post(
      "/auth/login",
      {
        email: "user@example.com",
        password: "password",
      },
      { tenantScoped: false },
    );

    client.setAuthToken((authResponse as any).accessToken);
    client.setRefreshToken((authResponse as any).refreshToken);

    const user = await client.get("/auth/me", {}, { tenantScoped: false });

    return { authResponse, user };
  },
};

export const environmentExamples = {
  development: {
    baseUrl: "http://localhost:8000",
    timeout: 30000,
    retryAttempts: 1,
    enableLogging: true,
  },

  staging: {
    baseUrl: "https://staging-api.sanarwa.com",
    timeout: 15000,
    retryAttempts: 2,
    enableLogging: true,
  },

  production: {
    baseUrl: "https://api.sanarwa.com",
    timeout: 10000,
    retryAttempts: 3,
    enableLogging: false,
  },
};
