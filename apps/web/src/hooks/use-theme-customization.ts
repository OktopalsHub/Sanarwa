"use client";

import { BrandingColors, useBranding } from "@/contexts/branding-context";
import { getAccessibilityLevel, validateColorPalette } from "@/lib/utils/color-contrast";
import {
  applyThemeConfig,
  createThemeConfig,
  createThemeTransition,
  prefersReducedMotion,
} from "@/lib/utils/theme";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface ThemeCustomization {
  colors: BrandingColors;
  typography: {
    fontFamily: string;
    headingFont?: string;
  };
  customCss?: string;
}

export interface AccessibilityReport {
  isValid: boolean;
  issues: Array<{
    combination: string;
    level: "AAA" | "AA" | "FAIL";
    ratio: number;
    suggestion?: string;
  }>;
}

export function useThemeCustomization() {
  const { branding, applyBranding, updateColors, isLoading } = useBranding();
  const { resolvedTheme } = useTheme();
  const [isApplying, setIsApplying] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewConfig, setPreviewConfig] = useState<ThemeCustomization | null>(null);

  const isDark = resolvedTheme === "dark";

  const accessibilityReport = useMemo((): AccessibilityReport => {
    const colors = previewConfig?.colors || branding?.colors;
    if (!colors) {
      return { isValid: true, issues: [] };
    }

    return validateColorPalette({
      primary: colors.primary,
      background: colors.background,
      foreground: colors.foreground,
      secondary: colors.secondary,
      muted: colors.muted || "#f1f5f9",
      mutedForeground: colors.mutedForeground || "#64748b",
    });
  }, [branding?.colors, previewConfig?.colors]);

  const applyTheme = useCallback(
    async (customization: ThemeCustomization, permanent = false) => {
      if (isApplying) return;

      setIsApplying(true);

      try {
        if (!prefersReducedMotion()) {
          createThemeTransition();
        }

        const themeConfig = createThemeConfig(
          customization.colors,
          customization.typography,
          isDark,
        );

        applyThemeConfig(themeConfig);

        if (customization.customCss) {
          let styleElement = document.getElementById("custom-theme-styles");
          if (!styleElement) {
            styleElement = document.createElement("style");
            styleElement.id = "custom-theme-styles";
            document.head.appendChild(styleElement);
          }
          styleElement.textContent = customization.customCss;
        }

        if (permanent && branding) {
          const updatedBranding = {
            ...branding,
            colors: customization.colors,
            typography: customization.typography,
            customCss: customization.customCss,
          };
          applyBranding(updatedBranding);
        }

        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        console.error("Failed to apply theme:", error);
      } finally {
        setIsApplying(false);
      }
    },
    [isApplying, isDark, branding, applyBranding],
  );

  const previewTheme = useCallback(
    (customization: ThemeCustomization) => {
      setPreviewConfig(customization);
      setPreviewMode(true);
      applyTheme(customization, false);
    },
    [applyTheme],
  );

  const commitTheme = useCallback(
    async (customization: ThemeCustomization) => {
      await applyTheme(customization, true);
      setPreviewMode(false);
      setPreviewConfig(null);
    },
    [applyTheme],
  );

  const cancelPreview = useCallback(() => {
    if (branding && previewMode) {
      const originalCustomization: ThemeCustomization = {
        colors: branding.colors,
        typography: branding.typography,
        customCss: branding.customCss,
      };
      applyTheme(originalCustomization, false);
    }
    setPreviewMode(false);
    setPreviewConfig(null);
  }, [branding, previewMode, applyTheme]);

  const updateColor = useCallback(
    (colorKey: keyof BrandingColors, value: string) => {
      const currentColors = previewConfig?.colors || branding?.colors;
      if (!currentColors) return;

      const updatedColors = {
        ...currentColors,
        [colorKey]: value,
      };

      if (previewMode) {
        const updatedCustomization = {
          ...previewConfig!,
          colors: updatedColors,
        };
        setPreviewConfig(updatedCustomization);
        applyTheme(updatedCustomization, false);
      } else {
        updateColors({ [colorKey]: value });
      }
    },
    [branding?.colors, previewConfig, previewMode, updateColors, applyTheme],
  );

  const resetToDefault = useCallback(() => {
    const defaultCustomization: ThemeCustomization = {
      colors: {
        primary: "oklch(0.65 0.18 45)",
        secondary: "oklch(0.97 0 0)",
        accent: "oklch(0.6 0.15 240)",
        background: isDark ? "oklch(0.145 0 0)" : "oklch(1 0 0)",
        foreground: isDark ? "oklch(0.985 0 0)" : "oklch(0.145 0 0)",
        muted: isDark ? "oklch(0.269 0 0)" : "oklch(0.97 0 0)",
        mutedForeground: isDark ? "oklch(0.708 0 0)" : "oklch(0.556 0 0)",
        border: isDark ? "oklch(1 0 0 / 10%)" : "oklch(0.922 0 0)",
        destructive: "oklch(0.577 0.245 27.325)",
      },
      typography: {
        fontFamily: "var(--font-geist-sans)",
        headingFont: "var(--font-geist-sans)",
      },
    };

    if (previewMode) {
      previewTheme(defaultCustomization);
    } else {
      commitTheme(defaultCustomization);
    }
  }, [isDark, previewMode, previewTheme, commitTheme]);

  const getColorAccessibility = useCallback(
    (foreground: string, background: string, isLargeText = false) => {
      return getAccessibilityLevel(foreground, background, isLargeText);
    },
    [],
  );

  const exportTheme = useCallback(() => {
    const currentConfig =
      previewConfig ||
      (branding
        ? {
            colors: branding.colors,
            typography: branding.typography,
            customCss: branding.customCss,
          }
        : null);

    if (!currentConfig) return null;

    return {
      name: branding?.name || "Custom Theme",
      config: currentConfig,
      accessibility: accessibilityReport,
      exportedAt: new Date().toISOString(),
    };
  }, [branding, previewConfig, accessibilityReport]);

  const importTheme = useCallback(
    (themeData: { config: ThemeCustomization }) => {
      previewTheme(themeData.config);
    },
    [previewTheme],
  );

  useEffect(() => {
    if (branding && !previewMode) {
      const customization: ThemeCustomization = {
        colors: branding.colors,
        typography: branding.typography,
        customCss: branding.customCss,
      };
      applyTheme(customization, false);
    }
  }, [branding, isDark, previewMode, applyTheme]);

  return {
    isLoading,
    isApplying,
    previewMode,
    currentTheme:
      previewConfig ||
      (branding
        ? {
            colors: branding.colors,
            typography: branding.typography,
            customCss: branding.customCss,
          }
        : null),
    accessibilityReport,
    isDark,

    previewTheme,
    commitTheme,
    cancelPreview,
    updateColor,
    resetToDefault,
    getColorAccessibility,
    exportTheme,
    importTheme,
  };
}
