"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import * as React from "react";
import { useEffect } from "react";

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  useEffect(() => {
    // Add CSS for theme transitions and enhanced styling
    const style = document.createElement("style");
    style.id = "theme-provider-styles";
    style.textContent = `
      /* Theme transition styles */
      .theme-transitioning * {
        transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, box-shadow !important;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1) !important;
        transition-duration: 300ms !important;
      }
      
      /* Respect user's motion preferences */
      @media (prefers-reduced-motion: reduce) {
        .theme-transitioning * {
          transition-duration: 0ms !important;
        }
      }

      /* Enhanced focus styles for better accessibility */
      *:focus-visible {
        outline: 2px solid hsl(var(--ring)) !important;
        outline-offset: 2px !important;
        border-radius: calc(var(--radius) - 2px) !important;
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        :root {
          --border: oklch(0.5 0 0) !important;
          --ring: oklch(0.3 0 0) !important;
        }

        .dark {
          --border: oklch(0.7 0 0) !important;
          --ring: oklch(0.8 0 0) !important;
        }
      }

      /* Smooth color scheme transitions */
      html {
        color-scheme: light;
        transition: color-scheme 0.3s ease;
      }

      html.dark {
        color-scheme: dark;
      }

      @media (prefers-reduced-motion: reduce) {
        html {
          transition: none;
        }
      }

      /* Enhanced scrollbar styling */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      ::-webkit-scrollbar-track {
        background: hsl(var(--muted));
        border-radius: 4px;
      }

      ::-webkit-scrollbar-thumb {
        background: hsl(var(--muted-foreground) / 0.3);
        border-radius: 4px;
        transition: background-color 0.2s ease;
      }

      ::-webkit-scrollbar-thumb:hover {
        background: hsl(var(--muted-foreground) / 0.5);
      }

      /* Firefox scrollbar styling */
      * {
        scrollbar-width: thin;
        scrollbar-color: hsl(var(--muted-foreground) / 0.3) hsl(var(--muted));
      }

      /* Theme-aware selection colors */
      ::selection {
        background: hsl(var(--primary) / 0.2);
        color: hsl(var(--primary-foreground));
      }

      ::-moz-selection {
        background: hsl(var(--primary) / 0.2);
        color: hsl(var(--primary-foreground));
      }
    `;

    // Check if style already exists to avoid duplicates
    const existingStyle = document.getElementById("theme-provider-styles");
    if (existingStyle) {
      existingStyle.remove();
    }

    document.head.appendChild(style);

    // Listen for theme changes to update color-scheme
    const handleThemeChange = () => {
      const isDark = document.documentElement.classList.contains("dark");
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    };

    // Initial check
    handleThemeChange();

    // Set up observer for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          handleThemeChange();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      const styleElement = document.getElementById("theme-provider-styles");
      if (styleElement) {
        styleElement.remove();
      }
      observer.disconnect();
    };
  }, []);

  return (
    <NextThemesProvider
      {...props}
      attribute="class"
      defaultTheme="system"
      enableSystem={true}
      enableColorScheme={true}
      storageKey="notifi-theme"
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  );
}
