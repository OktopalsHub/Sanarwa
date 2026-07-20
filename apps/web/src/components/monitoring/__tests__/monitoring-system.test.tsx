import { alertManager } from '@/lib/services/alert-manager';
import { analyticsTracker } from '@/lib/services/analytics-tracker';
import { monitoringService } from '@/lib/services/monitoring';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MonitoringDashboard from '../monitoring-dashboard';
import RealTimeAlerts from '../real-time-alerts';
import UserBehaviorTracker from '../user-behavior-tracker';

// Mock the monitoring services
vi.mock('@/lib/services/monitoring');
vi.mock('@/lib/services/analytics-tracker');
vi.mock('@/lib/services/alert-manager');

// Mock Next.js router
vi.mock('next/navigation', () => ({
  usePathname: () => '/test',
}));

// Mock auth and tenant contexts
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
  }),
}));

vi.mock('@/contexts/tenant-context', () => ({
  useTenant: () => ({
    selectedTenant: { id: 'test-tenant', name: 'Test Tenant' },
  }),
}));

describe('Monitoring System', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetch for API calls
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    ) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('MonitoringDashboard', () => {
    it('renders monitoring dashboard with key metrics', async () => {
      render(<MonitoringDashboard />);

      expect(screen.getByText('System Monitoring')).toBeInTheDocument();
      expect(screen.getByText('Real-time monitoring and alerting dashboard')).toBeInTheDocument();

      // Check for metric cards
      await waitFor(() => {
        expect(screen.getByText('Error Rate')).toBeInTheDocument();
        expect(screen.getByText('Avg Response Time')).toBeInTheDocument();
        expect(screen.getByText('Active Users')).toBeInTheDocument();
        expect(screen.getByText('Uptime')).toBeInTheDocument();
      });
    });

    it('displays tabs for different monitoring views', async () => {
      render(<MonitoringDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Active Alerts')).toBeInTheDocument();
        expect(screen.getByText('Performance')).toBeInTheDocument();
        expect(screen.getByText('Error Tracking')).toBeInTheDocument();
        expect(screen.getByText('User Analytics')).toBeInTheDocument();
      });
    });

    it('refreshes data when refresh button is clicked', async () => {
      render(<MonitoringDashboard />);

      const refreshButton = await screen.findByText('Refresh');
      fireEvent.click(refreshButton);

      // Verify that the component attempts to reload data
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
    });
  });

  describe('RealTimeAlerts', () => {
    it('renders real-time alerts component', () => {
      render(<RealTimeAlerts />);

      expect(screen.getByText('Real-time Alerts')).toBeInTheDocument();
      expect(screen.getByText('Live monitoring alerts and system notifications')).toBeInTheDocument();
    });

    it('shows no alerts message when there are no alerts', () => {
      render(<RealTimeAlerts />);

      expect(screen.getByText('No alerts at this time')).toBeInTheDocument();
    });

    it('allows enabling and disabling alerts', () => {
      render(<RealTimeAlerts />);

      const toggleButton = screen.getByText('Disable');
      fireEvent.click(toggleButton);

      expect(screen.getByText('Enable')).toBeInTheDocument();
    });

    it('can clear all alerts', async () => {
      render(<RealTimeAlerts />);

      // Wait for potential alerts to load
      await waitFor(() => {
        const clearButton = screen.queryByText('Clear All');
        if (clearButton) {
          fireEvent.click(clearButton);
        }
      });
    });
  });

  describe('UserBehaviorTracker', () => {
    it('tracks user interactions', () => {
      const TestComponent = () => (
        <UserBehaviorTracker>
          <button>Test Button</button>
        </UserBehaviorTracker>
      );

      render(<TestComponent />);

      const button = screen.getByText('Test Button');
      fireEvent.click(button);

      // Verify that analytics tracker was called
      expect(analyticsTracker.trackEvent).toHaveBeenCalledWith(
        'user_interaction',
        expect.objectContaining({
          type: 'click',
        })
      );
    });

    it('tracks form submissions', () => {
      const TestComponent = () => (
        <UserBehaviorTracker>
          <form onSubmit={(e) => e.preventDefault()}>
            <input name="test" />
            <button type="submit">Submit</button>
          </form>
        </UserBehaviorTracker>
      );

      render(<TestComponent />);

      const form = screen.getByRole('button', { name: 'Submit' }).closest('form');
      fireEvent.submit(form!);

      expect(analyticsTracker.trackEvent).toHaveBeenCalledWith(
        'form_submission',
        expect.objectContaining({
          formMethod: 'get',
        })
      );
    });

    it('tracks keyboard shortcuts', () => {
      const TestComponent = () => (
        <UserBehaviorTracker>
          <div>Test Content</div>
        </UserBehaviorTracker>
      );

      render(<TestComponent />);

      fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });

      expect(analyticsTracker.trackEvent).toHaveBeenCalledWith(
        'keyboard_shortcut',
        expect.objectContaining({
          key: 'Enter',
          ctrlKey: true,
        })
      );
    });
  });

  describe('Error Reporting', () => {
    it('reports JavaScript errors', () => {
      const TestComponent = () => {
        throw new Error('Test error');
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        render(<TestComponent />);
      }).toThrow('Test error');

      consoleSpy.mockRestore();
    });

    it('handles API errors gracefully', async () => {
      // Mock a failed API call
      global.fetch = jest.fn(() =>
        Promise.reject(new Error('API Error'))
      ) as jest.Mock;

      render(<MonitoringDashboard />);

      // The component should handle the error gracefully
      await waitFor(() => {
        expect(screen.getByText('System Monitoring')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Monitoring', () => {
    it('tracks performance metrics', () => {
      const TestComponent = () => (
        <UserBehaviorTracker>
          <div>Performance Test</div>
        </UserBehaviorTracker>
      );

      render(<TestComponent />);

      // Verify that performance monitoring is initialized
      expect(monitoringService.initialize).toHaveBeenCalled();
    });

    it('measures component render times', async () => {
      const TestComponent = () => {
        // Simulate a slow component
        const start = performance.now();
        while (performance.now() - start < 20) {
          // Busy wait for 20ms
        }
        return <div>Slow Component</div>;
      };

      render(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByText('Slow Component')).toBeInTheDocument();
      });
    });
  });

  describe('Alert Management', () => {
    it('creates alerts for critical errors', () => {
      const criticalError = new Error('Critical system failure');

      // Simulate a critical error
      monitoringService.reportError(criticalError, { severity: 'critical' });

      expect(alertManager.createCustomAlert).toHaveBeenCalledWith(
        'error',
        'critical',
        expect.stringContaining('Critical error'),
        expect.any(Object)
      );
    });

    it('creates alerts for performance issues', () => {
      // Simulate a slow API call
      monitoringService.trackPerformance('api_call', 5000, {
        endpoint: '/api/test',
        threshold: 3000,
      });

      expect(alertManager.createCustomAlert).toHaveBeenCalledWith(
        'performance',
        expect.any(String),
        expect.stringContaining('Performance'),
        expect.any(Object)
      );
    });
  });

  describe('Integration Tests', () => {
    it('integrates all monitoring components together', async () => {
      const IntegratedApp = () => (
        <UserBehaviorTracker>
          <div>
            <MonitoringDashboard />
            <RealTimeAlerts />
          </div>
        </UserBehaviorTracker>
      );

      render(<IntegratedApp />);

      // Verify all components render
      await waitFor(() => {
        expect(screen.getByText('System Monitoring')).toBeInTheDocument();
        expect(screen.getByText('Real-time Alerts')).toBeInTheDocument();
      });

      // Simulate user interaction
      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      // Verify tracking
      expect(analyticsTracker.trackEvent).toHaveBeenCalled();
    });

    it('handles monitoring service failures gracefully', async () => {
      // Mock monitoring service to throw errors
      (monitoringService.initialize as any).mockImplementation(() => {
        throw new Error('Monitoring service failed');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      render(<MonitoringDashboard />);

      // Component should still render despite monitoring failure
      await waitFor(() => {
        expect(screen.getByText('System Monitoring')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });
});