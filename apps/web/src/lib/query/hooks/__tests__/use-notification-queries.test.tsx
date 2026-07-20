import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useNotifications, useInAppNotifications } from '../use-notification-queries';

// Mock the notification API
jest.mock('@/lib/api/notification', () => ({
  notificationApi: {
    getNotifications: jest.fn(),
    getInAppNotifications: jest.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Notification Query Hooks', () => {
  it('should create useNotifications hook without errors', () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBeDefined();
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });

  it('should create useInAppNotifications hook without errors', () => {
    const { result } = renderHook(() => useInAppNotifications(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBeDefined();
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });
});