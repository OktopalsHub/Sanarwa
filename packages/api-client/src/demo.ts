/**
 * Demo script showing the core API client functionality
 * This demonstrates the implementation of task 1: Set up core API client infrastructure
 */

import { ApiClient, createApiClient } from './client';
import { getApiConfig } from './config';
import { ApiErrorHandler } from './error-handler';

// Demo function to show API client configuration
export function demoApiClientSetup() {
  console.log('=== API Client Infrastructure Demo ===');

  // 1. Environment-based backend URL management
  const config = getApiConfig();
  console.log('API Configuration:', {
    baseUrl: config.baseUrl,
    timeout: config.timeout,
    retryAttempts: config.retryAttempts,
  });

  // 2. Create API client with axios and configuration
  const apiClient = createApiClient({
    timeout: 15000,
    retryAttempts: 2,
  });

  console.log('API Client created with custom configuration');

  // 3. JWT token management
  apiClient.setAuthToken('demo-access-token');
  apiClient.setRefreshToken('demo-refresh-token');
  console.log('JWT tokens set for authentication');

  // 4. Tenant management
  apiClient.setTenant('demo-tenant-id');
  console.log('Tenant context set:', apiClient.getTenant());

  // 5. Error handling demonstration
  const demoError = new Error('Demo API error') as any;
  demoError.status = 401;
  demoError.code = 'UNAUTHORIZED';
  demoError.isAxiosError = true;

  console.log('Error handling demo:');
  ApiErrorHandler.handle(demoError, { showToast: false, logError: true });

  // 6. WebSocket connection (would create connection in browser)
  console.log('WebSocket connection capability available');

  console.log('=== Demo Complete ===');

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
    }
  };
}

// Example usage patterns
export const exampleUsage = {
  // Basic API calls
  async makeApiCalls(client: ApiClient) {
    try {
      // GET request with parameters
      const users = await client.get('/users', { page: 1, limit: 10 });

      // POST request with data
      const newUser = await client.post('/users', {
        name: 'John Doe',
        email: 'john@example.com'
      });

      // PUT request for updates
      const updatedUser = await client.put('/users/123', {
        name: 'John Smith'
      });

      // DELETE request
      await client.delete('/users/123');

      return { users, newUser, updatedUser };
    } catch (error) {
      ApiErrorHandler.handle(error as any);
      throw error;
    }
  },

  // Tenant-scoped operations
  async tenantOperations(client: ApiClient) {
    // Set tenant context
    client.setTenant('tenant-123');

    // All subsequent requests will include tenant header
    const tenantData = await client.get('/tenant/dashboard');
    const notifications = await client.get('/notifications');

    return { tenantData, notifications };
  },

  // Authentication flow
  async authenticationFlow(client: ApiClient) {
    // Login (no tenant scoping required)
    const authResponse = await client.post('/auth/login', {
      email: 'user@example.com',
      password: 'password'
    }, { tenantScoped: false });

    // Store tokens
    client.setAuthToken((authResponse as any).accessToken);
    client.setRefreshToken((authResponse as any).refreshToken);

    // Get current user
    const user = await client.get('/auth/me', {}, { tenantScoped: false });

    return { authResponse, user };
  }
};

// Configuration examples for different environments
export const environmentExamples = {
  development: {
    baseUrl: 'http://localhost:9000',
    timeout: 30000,
    retryAttempts: 1,
    enableLogging: true,
  },

  staging: {
    baseUrl: 'https://staging-api.notifi.com',
    timeout: 15000,
    retryAttempts: 2,
    enableLogging: true,
  },

  production: {
    baseUrl: 'https://api.notifi.com',
    timeout: 10000,
    retryAttempts: 3,
    enableLogging: false,
  }
};