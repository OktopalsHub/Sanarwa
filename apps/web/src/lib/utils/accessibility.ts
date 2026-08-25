/**
 * Accessibility utilities for the Notifi platform
 * Provides comprehensive a11y support including keyboard navigation,
 * screen reader compatibility, and WCAG 2.1 AA compliance
 */

"use client";

import { useEffect, useState } from "react";

// Keyboard navigation constants
export const KEYBOARD_KEYS = {
  ENTER: "Enter",
  SPACE: " ",
  ESCAPE: "Escape",
  TAB: "Tab",
  ARROW_UP: "ArrowUp",
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  HOME: "Home",
  END: "End",
  PAGE_UP: "PageUp",
  PAGE_DOWN: "PageDown",
} as const;

// ARIA live region types
export const LIVE_REGIONS = {
  POLITE: "polite",
  ASSERTIVE: "assertive",
  OFF: "off",
} as const;

// Focus management utilities
export class FocusManager {
  private static focusStack: HTMLElement[] = [];

  static pushFocus(element: HTMLElement) {
    const currentFocus = document.activeElement as HTMLElement;
    if (currentFocus && currentFocus !== document.body) {
      this.focusStack.push(currentFocus);
    }
    element.focus();
  }

  static popFocus() {
    const previousFocus = this.focusStack.pop();
    if (previousFocus) {
      previousFocus.focus();
    }
  }

  static trapFocus(container: HTMLElement, event: KeyboardEvent) {
    const focusableElements = this.getFocusableElements(container);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.key === KEYBOARD_KEYS.TAB) {
      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    }
  }

  static getFocusableElements(container: HTMLElement): HTMLElement[] {
    const focusableSelectors = [
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "a[href]",
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ].join(", ");

    return Array.from(container.querySelectorAll(focusableSelectors));
  }

  static getNextFocusableElement(
    container: HTMLElement,
    currentElement: HTMLElement,
    direction: "next" | "previous" = "next",
  ): HTMLElement | null {
    const focusableElements = this.getFocusableElements(container);
    const currentIndex = focusableElements.indexOf(currentElement);

    if (currentIndex === -1) return null;

    const nextIndex =
      direction === "next"
        ? (currentIndex + 1) % focusableElements.length
        : (currentIndex - 1 + focusableElements.length) % focusableElements.length;

    return focusableElements[nextIndex] || null;
  }
}

// Screen reader utilities
export class ScreenReaderUtils {
  private static liveRegion: HTMLElement | null = null;

  static announce(message: string, priority: keyof typeof LIVE_REGIONS = "POLITE") {
    if (!this.liveRegion) {
      this.createLiveRegion();
    }

    if (this.liveRegion) {
      this.liveRegion.setAttribute("aria-live", LIVE_REGIONS[priority]);
      this.liveRegion.textContent = message;

      // Clear after announcement to allow repeated messages
      setTimeout(() => {
        if (this.liveRegion) {
          this.liveRegion.textContent = "";
        }
      }, 1000);
    }
  }

  private static createLiveRegion() {
    this.liveRegion = document.createElement("div");
    this.liveRegion.setAttribute("aria-live", "polite");
    this.liveRegion.setAttribute("aria-atomic", "true");
    this.liveRegion.className = "sr-only";
    document.body.appendChild(this.liveRegion);
  }

  static describedBy(elementId: string, description: string): string {
    const descriptionId = `${elementId}-description`;

    // Create description element if it doesn't exist
    if (!document.getElementById(descriptionId)) {
      const descElement = document.createElement("div");
      descElement.id = descriptionId;
      descElement.className = "sr-only";
      descElement.textContent = description;
      document.body.appendChild(descElement);
    }

    return descriptionId;
  }
}

// Keyboard navigation hooks
export function useKeyboardNavigation(
  containerRef: React.RefObject<HTMLElement>,
  options: {
    orientation?: "horizontal" | "vertical" | "both";
    wrap?: boolean;
    onEscape?: () => void;
    onEnter?: (element: HTMLElement) => void;
  } = {},
) {
  const { orientation = "both", wrap = true, onEscape, onEnter } = options;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const { key } = event;
      const currentElement = document.activeElement as HTMLElement;

      if (!container.contains(currentElement)) return;

      switch (key) {
        case KEYBOARD_KEYS.ESCAPE:
          event.preventDefault();
          onEscape?.();
          break;

        case KEYBOARD_KEYS.ENTER:
        case KEYBOARD_KEYS.SPACE:
          if (
            currentElement.tagName === "BUTTON" ||
            currentElement.getAttribute("role") === "button"
          ) {
            event.preventDefault();
            onEnter?.(currentElement);
            currentElement.click();
          }
          break;

        case KEYBOARD_KEYS.ARROW_DOWN:
          if (orientation === "vertical" || orientation === "both") {
            event.preventDefault();
            navigateToNext(container, currentElement, "next", wrap);
          }
          break;

        case KEYBOARD_KEYS.ARROW_UP:
          if (orientation === "vertical" || orientation === "both") {
            event.preventDefault();
            navigateToNext(container, currentElement, "previous", wrap);
          }
          break;

        case KEYBOARD_KEYS.ARROW_RIGHT:
          if (orientation === "horizontal" || orientation === "both") {
            event.preventDefault();
            navigateToNext(container, currentElement, "next", wrap);
          }
          break;

        case KEYBOARD_KEYS.ARROW_LEFT:
          if (orientation === "horizontal" || orientation === "both") {
            event.preventDefault();
            navigateToNext(container, currentElement, "previous", wrap);
          }
          break;

        case KEYBOARD_KEYS.HOME:
          event.preventDefault();
          navigateToFirst(container);
          break;

        case KEYBOARD_KEYS.END:
          event.preventDefault();
          navigateToLast(container);
          break;
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [containerRef, orientation, wrap, onEscape, onEnter]);
}

function navigateToNext(
  container: HTMLElement,
  currentElement: HTMLElement,
  direction: "next" | "previous",
  wrap: boolean,
) {
  const nextElement = FocusManager.getNextFocusableElement(container, currentElement, direction);
  if (nextElement) {
    nextElement.focus();
  } else if (wrap) {
    const focusableElements = FocusManager.getFocusableElements(container);
    const targetElement =
      direction === "next" ? focusableElements[0] : focusableElements[focusableElements.length - 1];
    targetElement?.focus();
  }
}

function navigateToFirst(container: HTMLElement) {
  const focusableElements = FocusManager.getFocusableElements(container);
  focusableElements[0]?.focus();
}

function navigateToLast(container: HTMLElement) {
  const focusableElements = FocusManager.getFocusableElements(container);
  focusableElements[focusableElements.length - 1]?.focus();
}

// Skip link utilities
export function useSkipLinks() {
  useEffect(() => {
    const skipLinks = document.querySelectorAll("[data-skip-link]");

    skipLinks.forEach((link) => {
      const handleClick = (event: Event) => {
        event.preventDefault();
        const target = (event.target as HTMLElement).getAttribute("href");
        if (target) {
          const targetElement = document.querySelector(target);
          if (targetElement) {
            (targetElement as HTMLElement).focus();
            targetElement.scrollIntoView({ behavior: "smooth" });
          }
        }
      };

      link.addEventListener("click", handleClick);
    });

    return () => {
      skipLinks.forEach((link) => {
        link.removeEventListener("click", () => {});
      });
    };
  }, []);
}

// Reduced motion detection
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
}

// High contrast detection
export function useHighContrast() {
  const [prefersHighContrast, setPrefersHighContrast] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-contrast: high)");
    setPrefersHighContrast(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersHighContrast(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersHighContrast;
}

// ARIA utilities
export const AriaUtils = {
  generateId: (prefix: string = "aria") => `${prefix}-${Math.random().toString(36).substr(2, 9)}`,

  setExpanded: (element: HTMLElement, expanded: boolean) => {
    element.setAttribute("aria-expanded", expanded.toString());
  },

  setSelected: (element: HTMLElement, selected: boolean) => {
    element.setAttribute("aria-selected", selected.toString());
  },

  setPressed: (element: HTMLElement, pressed: boolean) => {
    element.setAttribute("aria-pressed", pressed.toString());
  },

  setChecked: (element: HTMLElement, checked: boolean | "mixed") => {
    element.setAttribute("aria-checked", checked.toString());
  },

  setDisabled: (element: HTMLElement, disabled: boolean) => {
    if (disabled) {
      element.setAttribute("aria-disabled", "true");
      element.setAttribute("tabindex", "-1");
    } else {
      element.removeAttribute("aria-disabled");
      element.removeAttribute("tabindex");
    }
  },

  setLabel: (element: HTMLElement, label: string) => {
    element.setAttribute("aria-label", label);
  },

  setLabelledBy: (element: HTMLElement, labelId: string) => {
    element.setAttribute("aria-labelledby", labelId);
  },

  setDescribedBy: (element: HTMLElement, descriptionId: string) => {
    element.setAttribute("aria-describedby", descriptionId);
  },
};

// Color contrast utilities
export function getContrastRatio(color1: string, color2: string): number {
  const getLuminance = (color: string): number => {
    // Convert hex to RGB
    const hex = color.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;

    // Calculate relative luminance
    const sRGB = [r, g, b].map((c) => {
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * (sRGB[0] || 0) + 0.7152 * (sRGB[1] || 0) + 0.0722 * (sRGB[2] || 0);
  };

  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);

  return (brightest + 0.05) / (darkest + 0.05);
}

export function meetsWCAGContrast(
  foreground: string,
  background: string,
  level: "AA" | "AAA" = "AA",
  size: "normal" | "large" = "normal",
): boolean {
  const ratio = getContrastRatio(foreground, background);

  if (level === "AAA") {
    return size === "large" ? ratio >= 4.5 : ratio >= 7;
  } else {
    return size === "large" ? ratio >= 3 : ratio >= 4.5;
  }
}

// Accessibility testing utilities (for development)
export const A11yTesting = {
  checkFocusableElements: (container: HTMLElement) => {
    const focusableElements = FocusManager.getFocusableElements(container);
    console.log("Focusable elements:", focusableElements);
    return focusableElements;
  },

  checkAriaLabels: (container: HTMLElement) => {
    const elementsNeedingLabels = container.querySelectorAll("button, input, select, textarea");
    const unlabeledElements: HTMLElement[] = [];

    elementsNeedingLabels.forEach((element) => {
      const hasLabel =
        element.getAttribute("aria-label") ||
        element.getAttribute("aria-labelledby") ||
        element.querySelector("label");

      if (!hasLabel) {
        unlabeledElements.push(element as HTMLElement);
      }
    });

    if (unlabeledElements.length > 0) {
      console.warn("Elements missing accessibility labels:", unlabeledElements);
    }

    return unlabeledElements;
  },

  checkColorContrast: (element: HTMLElement) => {
    const styles = window.getComputedStyle(element);
    const color = styles.color;
    const backgroundColor = styles.backgroundColor;

    // This is a simplified check - in production, you'd want more robust color parsing
    console.log("Color contrast check:", { color, backgroundColor });
  },
};
