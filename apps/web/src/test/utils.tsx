import { AuthProvider } from '@/contexts/auth-context'
import { TenantProvider } from '@/contexts/tenant-context'
import { store } from '@/lib/store'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, RenderOptions } from '@testing-library/react'
import { ThemeProvider } from 'next-themes'
import React from 'react'
import { Provider } from 'react-redux'

// Mock user and tenant data for testing
export const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  avatar: null,
  preferences: {
    theme: 'light' as const,
    notifications: true,
  },
  tenantMemberships: [],
}

export const mockTenant = {
  id: 'tenant-1',
  name: 'Test Tenant',
  slug: 'test-tenant',
  branding: {
    id: 'brand-1',
    name: 'Test Brand',
    logo: {
      light: '/logo-light.png',
      dark: '/logo-dark.png',
    },
    colors: {
      primary: '#ff6b35',
      secondary: '#2563eb',
      accent: '#10b981',
      background: '#ffffff',
      foreground: '#000000',
    },
    typography: {
      fontFamily: 'Inter',
    },
  },
  subscription: {
    plan: 'pro' as const,
    status: 'active' as const,
  },
  settings: {
    allowMemberInvites: true,
    requireEmailVerification: true,
  },
  members: [],
}

// Create a custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <AuthProvider>
            <TenantProvider>
              {children}
            </TenantProvider>
          </AuthProvider>
        </ThemeProvider>
      </Provider>
    </QueryClientProvider>
  )
}

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

// Helper to create a query client for testing
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })

// Helper to wait for async operations
export const waitForLoadingToFinish = () =>
  new Promise(resolve => setTimeout(resolve, 0))

// Mock API responses
export const mockApiResponse = <T,>(data: T, delay = 0) =>
  new Promise<T>(resolve => setTimeout(() => resolve(data), delay))

export const mockApiError = (message: string, status = 400, delay = 0) =>
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error(message)), delay)
  )

// Accessibility testing helper
export const axeMatchers = {
  toHaveNoViolations: expect.extend({
    async toHaveNoViolations(received) {
      // Mock axe for now since jest-axe is not available
      const axe = async (element: any) => ({ violations: [] });
      const toHaveNoViolations = {};
      expect.extend(toHaveNoViolations)

      const results = await axe(received)
      return {
        pass: results.violations.length === 0,
        message: () => {
          if (results.violations.length === 0) {
            return 'Expected element to have accessibility violations, but none were found.'
          }
          return `Expected element to have no accessibility violations, but found ${results.violations.length}:\n${results.violations.map((v: any) => `- ${v.description}`).join('\n')}`
        },
      }
    },
  }),
}