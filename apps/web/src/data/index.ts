// Demo data exports - only export what exists
export * from './demo-dashboard';
export * from './demo-notifications';

// Mock data exports
export * from './mock-dashboard';
export * from './mock-notifications';
export * from './mock-campaigns';

// Demo API simulation utilities
export const simulateApiDelay = (ms: number = 500): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const simulateApiError = (errorRate: number = 0.1): boolean => {
  return Math.random() < errorRate;
};

export const createMockApiResponse = <T>(data: T, success: boolean = true) => {
  return {
    data,
    success,
    message: success ? 'Operation successful' : 'Operation failed',
    timestamp: new Date().toISOString(),
  };
};