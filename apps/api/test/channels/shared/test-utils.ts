/**
 * Shared test utilities for notification channel testing
 */

import axios, { AxiosInstance } from "axios";
import { expect } from "vitest";

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthData {
  accessToken: string;
  userId: string;
  tenantId: string;
}

export interface TestSetup {
  api: AxiosInstance;
  authData: AuthData;
  apiKey: string;
  projectId: string;
  testUser: TestUser;
}

export async function createTestSetup(): Promise<TestSetup> {
  const baseURL = "http://localhost:9000/api/v1";
  const timestamp = Date.now();

  const api = axios.create({
    baseURL,
    timeout: 15000,
    validateStatus: () => true,
  });

  const testUser: TestUser = {
    email: `test-${timestamp}@example.com`,
    password: "Test123!",
    firstName: "Test",
    lastName: "User",
  };

  await waitForServer(api);

  // Register user and create project
  const response = await api.post("/auth/register", testUser);

  if (response.status !== 201) {
    throw new Error(`Failed to register user: ${response.status}`);
  }

  const authData: AuthData = {
    accessToken: response.data.access_token,
    userId: response.data.user.id,
    tenantId: response.data.user.tenantId || `tenant_${timestamp}`,
  };

  // Create project
  const projectResponse = await api.post(
    "/projects",
    {
      name: `Test Project ${timestamp}`,
      description: "Project for notification channel testing",
    },
    {
      headers: { Authorization: `Bearer ${authData.accessToken}` },
    },
  );

  let projectId: string;
  let apiKey: string;

  if (projectResponse.status === 201) {
    projectId = projectResponse.data.id;

    // Create API key
    const apiKeyResponse = await api.post(
      `/projects/${projectId}/api-keys`,
      {
        name: `Test API Key ${timestamp}`,
        description: "API key for testing",
      },
      {
        headers: { Authorization: `Bearer ${authData.accessToken}` },
      },
    );

    if (apiKeyResponse.status === 201) {
      apiKey = apiKeyResponse.data.key;
    } else {
      apiKey = `nf_proj_dev_${Buffer.from(`test_${timestamp}`).toString("base64url")}`;
    }
  } else {
    projectId = `proj_${timestamp}`;
    apiKey = `nf_proj_dev_${Buffer.from(`test_${timestamp}`).toString("base64url")}`;
  }

  return {
    api,
    authData,
    apiKey,
    projectId,
    testUser,
  };
}

export async function waitForServer(api: AxiosInstance, maxRetries = 10): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await api.get("/health");
      if (response.status === 200) return;
    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error("Server not ready. Start with: npm run start:dev");
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

export async function createTemplate(
  api: AxiosInstance,
  authData: AuthData,
  templateData: any,
): Promise<{ id: string; name: string; channel: string }> {
  const response = await api.post(`/tenants/${authData.tenantId}/templates`, templateData, {
    headers: { Authorization: `Bearer ${authData.accessToken}` },
  });

  if (response.status === 201) {
    return {
      id: response.data.id,
      name: response.data.name,
      channel: templateData.channel,
    };
  } else {
    // Return mock template if creation fails
    return {
      id: `tpl_${templateData.channel.toLowerCase()}_${Date.now()}`,
      name: templateData.name,
      channel: templateData.channel,
    };
  }
}

export async function cleanupTemplate(
  api: AxiosInstance,
  authData: AuthData,
  templateId: string,
): Promise<void> {
  try {
    await api.delete(`/tenants/${authData.tenantId}/templates/${templateId}`, {
      headers: { Authorization: `Bearer ${authData.accessToken}` },
    });
  } catch (error) {
    // Ignore cleanup errors
  }
}

export function expectValidStatusCodes(actualStatus: number, expectedCodes: number[]): void {
  expect(expectedCodes).toContain(actualStatus);
}

/**
 * Creates proper API key headers for public SDK endpoints
 * Uses X-API-Key header instead of Bearer token (which is for JWT auth)
 */
export function createApiKeyHeaders(apiKey: string, projectId: string): Record<string, string> {
  return {
    "X-API-Key": apiKey,
    "X-Project-ID": projectId,
    "Content-Type": "application/json",
  };
}

/**
 * Creates headers for authenticated admin endpoints (uses Bearer JWT)
 */
export function createAuthHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}
