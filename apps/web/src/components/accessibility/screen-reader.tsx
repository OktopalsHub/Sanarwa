"use client";

import { ScreenReaderUtils } from '@/lib/utils/accessibility';
import React, { useEffect, useRef, useState } from 'react';

// Screen reader only text component
interface ScreenReaderOnlyProps {
  children: React.ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
}

export function ScreenReaderOnly({
  children,
  as: Component = 'span',
  className = ''
}: ScreenReaderOnlyProps) {
  const ElementType = Component as keyof React.JSX.IntrinsicElements;
  return (
    <ElementType className={`sr-only ${className}`}>
      {children}
    </ElementType>
  );
}

// Live region component for announcements
interface LiveRegionProps {
  children?: React.ReactNode;
  priority?: 'polite' | 'assertive' | 'off';
  atomic?: boolean;
  relevant?: 'additions' | 'removals' | 'text' | 'all';
  className?: string;
}

export function LiveRegion({
  children,
  priority = 'polite',
  atomic = true,
  relevant = 'all',
  className = ''
}: LiveRegionProps) {
  return (
    <div
      aria-live={priority}
      aria-atomic={atomic}
      aria-relevant={relevant}
      className={`sr-only ${className}`}
    >
      {children}
    </div>
  );
}

// Status component for form validation and other status updates
interface StatusProps {
  message: string;
  type?: 'error' | 'success' | 'warning' | 'info';
  visible?: boolean;
  className?: string;
}

export function Status({
  message,
  type = 'info',
  visible = true,
  className = ''
}: StatusProps) {
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (visible && message) {
      setAnnouncement(message);
      // Clear announcement after it's been read
      const timer = setTimeout(() => setAnnouncement(''), 1000);
      return () => clearTimeout(timer);
    }

    // Return empty cleanup function for other code paths
    return () => { };
  }, [message, visible]);

  const getAriaRole = () => {
    switch (type) {
      case 'error':
        return 'alert';
      case 'success':
      case 'warning':
      case 'info':
        return 'status';
      default:
        return 'status';
    }
  };

  if (!visible) return null;

  return (
    <>
      {/* Visible status message */}
      <div
        role={getAriaRole()}
        aria-live={type === 'error' ? 'assertive' : 'polite'}
        className={className}
      >
        {message}
      </div>

      {/* Screen reader announcement */}
      <LiveRegion priority={type === 'error' ? 'assertive' : 'polite'}>
        {announcement}
      </LiveRegion>
    </>
  );
}

// Progress announcer for long-running operations
interface ProgressAnnouncerProps {
  value: number;
  max?: number;
  label?: string;
  announceInterval?: number;
  className?: string;
}

export function ProgressAnnouncer({
  value,
  max = 100,
  label = 'Progress',
  announceInterval = 10,
  className = ''
}: ProgressAnnouncerProps) {
  const [lastAnnounced, setLastAnnounced] = useState(0);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const percentage = Math.round((value / max) * 100);

    // Only announce at intervals to avoid overwhelming screen readers
    if (percentage - lastAnnounced >= announceInterval || percentage === 100) {
      const message = `${label}: ${percentage}% complete`;
      setAnnouncement(message);
      setLastAnnounced(percentage);

      // Clear announcement after it's been read
      const timer = setTimeout(() => setAnnouncement(''), 1000);
      return () => clearTimeout(timer);
    }

    // Return empty cleanup function for other code paths
    return () => { };
  }, [value, max, label, announceInterval, lastAnnounced]);

  return (
    <LiveRegion className={className}>
      {announcement}
    </LiveRegion>
  );
}

// Loading announcer for async operations
interface LoadingAnnouncerProps {
  isLoading: boolean;
  loadingMessage?: string;
  completeMessage?: string;
  errorMessage?: string;
  error?: boolean;
  className?: string;
}

export function LoadingAnnouncer({
  isLoading,
  loadingMessage = 'Loading...',
  completeMessage = 'Loading complete',
  errorMessage = 'Loading failed',
  error = false,
  className = ''
}: LoadingAnnouncerProps) {
  const [announcement, setAnnouncement] = useState('');
  const previousLoadingRef = useRef(isLoading);

  useEffect(() => {
    const wasLoading = previousLoadingRef.current;
    previousLoadingRef.current = isLoading;

    if (isLoading && !wasLoading) {
      // Started loading
      setAnnouncement(loadingMessage);
    } else if (!isLoading && wasLoading) {
      // Finished loading
      setAnnouncement(error ? errorMessage : completeMessage);
    }

    if (announcement) {
      const timer = setTimeout(() => setAnnouncement(''), 1000);
      return () => clearTimeout(timer);
    }

    // Return empty cleanup function for other code paths
    return () => { };
  }, [isLoading, error, loadingMessage, completeMessage, errorMessage, announcement]);

  return (
    <LiveRegion
      priority={error ? 'assertive' : 'polite'}
      className={className}
    >
      {announcement}
    </LiveRegion>
  );
}

// Form field description component
interface FieldDescriptionProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export function FieldDescription({ id, children, className = '' }: FieldDescriptionProps) {
  return (
    <div
      id={id}
      className={`text-sm text-muted-foreground ${className}`}
      role="note"
    >
      {children}
    </div>
  );
}

// Error message component for forms
interface ErrorMessageProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export function ErrorMessage({ id, children, className = '' }: ErrorMessageProps) {
  return (
    <div
      id={id}
      role="alert"
      aria-live="assertive"
      className={`text-sm text-destructive ${className}`}
    >
      {children}
    </div>
  );
}

// Breadcrumb component with proper ARIA
interface BreadcrumbProps {
  items: Array<{
    label: string;
    href?: string;
    current?: boolean;
  }>;
  className?: string;
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center space-x-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <span className="mx-2 text-muted-foreground" aria-hidden="true">
                /
              </span>
            )}
            {item.current ? (
              <span
                aria-current="page"
                className="font-medium text-foreground"
              >
                {item.label}
              </span>
            ) : item.href ? (
              <a
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </a>
            ) : (
              <span className="text-muted-foreground">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// Hook for managing announcements
export function useAnnouncement() {
  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    ScreenReaderUtils.announce(message, priority.toUpperCase() as 'POLITE' | 'ASSERTIVE');
  };

  return { announce };
}

// Hook for managing field descriptions
export function useFieldDescription(fieldId: string, description?: string) {
  const descriptionId = `${fieldId}-description`;

  useEffect(() => {
    if (description) {
      ScreenReaderUtils.describedBy(fieldId, description);
    }
    // No cleanup needed for this effect
  }, [fieldId, description]);

  return descriptionId;
}