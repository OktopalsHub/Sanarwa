"use client";

import { cn } from '@/lib/utils';
import { FocusManager, KEYBOARD_KEYS, useKeyboardNavigation } from '@/lib/utils/accessibility';
import React, { forwardRef, useEffect, useRef } from 'react';

interface KeyboardNavigationProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical' | 'both';
  wrap?: boolean;
  autoFocus?: boolean;
  onEscape?: () => void;
  onEnter?: (element: HTMLElement) => void;
  children: React.ReactNode;
}

export const KeyboardNavigation = forwardRef<HTMLDivElement, KeyboardNavigationProps>(
  ({
    orientation = 'both',
    wrap = true,
    autoFocus = false,
    onEscape,
    onEnter,
    children,
    className,
    ...props
  }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mergedRef = ref || containerRef;

    useKeyboardNavigation(containerRef as React.RefObject<HTMLElement>, {
      orientation,
      wrap,
      onEscape,
      onEnter,
    });

    useEffect(() => {
      if (autoFocus && containerRef.current) {
        const firstFocusable = FocusManager.getFocusableElements(containerRef.current)[0];
        firstFocusable?.focus();
      }
    }, [autoFocus]);

    return (
      <div
        ref={mergedRef}
        className={cn("focus-within:outline-none", className)}
        role="group"
        {...props}
      >
        {children}
      </div>
    );
  }
);

KeyboardNavigation.displayName = 'KeyboardNavigation';

// Roving tabindex implementation for complex navigation patterns
interface RovingTabindexProps {
  children: React.ReactNode;
  orientation?: 'horizontal' | 'vertical';
  loop?: boolean;
  className?: string;
}

export function RovingTabindex({
  children,
  orientation = 'horizontal',
  loop = true,
  className
}: RovingTabindexProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let currentIndex = 0;
    const items = FocusManager.getFocusableElements(container);

    // Set initial tabindex values
    items.forEach((item, index) => {
      item.setAttribute('tabindex', index === 0 ? '0' : '-1');
    });

    const updateTabindex = (newIndex: number) => {
      items.forEach((item, index) => {
        item.setAttribute('tabindex', index === newIndex ? '0' : '-1');
      });
      currentIndex = newIndex;
      items[currentIndex]?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const { key } = event;
      let newIndex = currentIndex;

      switch (key) {
        case KEYBOARD_KEYS.ARROW_RIGHT:
          if (orientation === 'horizontal') {
            event.preventDefault();
            newIndex = loop
              ? (currentIndex + 1) % items.length
              : Math.min(currentIndex + 1, items.length - 1);
          }
          break;

        case KEYBOARD_KEYS.ARROW_LEFT:
          if (orientation === 'horizontal') {
            event.preventDefault();
            newIndex = loop
              ? (currentIndex - 1 + items.length) % items.length
              : Math.max(currentIndex - 1, 0);
          }
          break;

        case KEYBOARD_KEYS.ARROW_DOWN:
          if (orientation === 'vertical') {
            event.preventDefault();
            newIndex = loop
              ? (currentIndex + 1) % items.length
              : Math.min(currentIndex + 1, items.length - 1);
          }
          break;

        case KEYBOARD_KEYS.ARROW_UP:
          if (orientation === 'vertical') {
            event.preventDefault();
            newIndex = loop
              ? (currentIndex - 1 + items.length) % items.length
              : Math.max(currentIndex - 1, 0);
          }
          break;

        case KEYBOARD_KEYS.HOME:
          event.preventDefault();
          newIndex = 0;
          break;

        case KEYBOARD_KEYS.END:
          event.preventDefault();
          newIndex = items.length - 1;
          break;
      }

      if (newIndex !== currentIndex) {
        updateTabindex(newIndex);
      }
    };

    const handleFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      const index = items.indexOf(target);
      if (index !== -1) {
        currentIndex = index;
        updateTabindex(index);
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    container.addEventListener('focus', handleFocus, true);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('focus', handleFocus, true);
    };
  }, [orientation, loop]);

  return (
    <div
      ref={containerRef}
      className={cn("focus-within:outline-none", className)}
      role="group"
    >
      {children}
    </div>
  );
}

// Focus trap component for modals and dialogs
interface FocusTrapProps {
  children: React.ReactNode;
  active?: boolean;
  restoreFocus?: boolean;
  className?: string;
}

export function FocusTrap({
  children,
  active = true,
  restoreFocus = true,
  className
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    // Store the previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus the first focusable element in the trap
    const focusableElements = FocusManager.getFocusableElements(container);
    if (focusableElements.length > 0) {
      focusableElements[0]?.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === KEYBOARD_KEYS.TAB) {
        FocusManager.trapFocus(container, event);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      // Restore focus to the previously focused element
      if (restoreFocus && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [active, restoreFocus]);

  return (
    <div
      ref={containerRef}
      className={cn("focus-within:outline-none", className)}
    >
      {children}
    </div>
  );
}

// Announcement component for screen readers
interface AnnouncementProps {
  message: string;
  priority?: 'polite' | 'assertive';
  clearDelay?: number;
}

export function Announcement({
  message,
  priority = 'polite',
  clearDelay = 1000
}: AnnouncementProps) {
  const announcementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = announcementRef.current;
    if (!element) return;

    element.textContent = message;

    const timer = setTimeout(() => {
      element.textContent = '';
    }, clearDelay);

    return () => clearTimeout(timer);
  }, [message, clearDelay]);

  return (
    <div
      ref={announcementRef}
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    />
  );
}