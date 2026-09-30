/**
 * Color contrast utilities for accessibility compliance
 * Implements WCAG 2.1 AA standards for color contrast ratios
 */

/**
 * Convert hex color to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result && result[1] && result[2] && result[3]
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Convert OKLCH color to RGB (simplified approximation)
 */
function oklchToRgb(oklch: string): { r: number; g: number; b: number } | null {
  // Extract values from oklch(L C H) format
  const match = oklch.match(/oklch\(([^)]+)\)/);
  if (!match || !match[1]) return null;

  const values = match[1].split(" ").map((v) => parseFloat(v));
  if (values.length < 3) return null;

  const [l, c, h] = values;

  // Check if values are valid numbers
  if (l === undefined || c === undefined) return null;

  // Simplified conversion (for demonstration - real implementation would be more complex)
  // This is a basic approximation for common cases
  const lightness = l * 255;
  const chroma = c * 100;
  const hue = h || 0;

  // Convert to RGB (simplified)
  const r = Math.max(0, Math.min(255, lightness + chroma * Math.cos((hue * Math.PI) / 180)));
  const g = Math.max(
    0,
    Math.min(255, lightness + chroma * Math.cos(((hue - 120) * Math.PI) / 180)),
  );
  const b = Math.max(
    0,
    Math.min(255, lightness + chroma * Math.cos(((hue - 240) * Math.PI) / 180)),
  );

  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}

/**
 * Parse color string to RGB values
 */
function parseColor(color: string): { r: number; g: number; b: number } | null {
  // Handle hex colors
  if (color.startsWith("#")) {
    return hexToRgb(color);
  }

  // Handle OKLCH colors
  if (color.startsWith("oklch(")) {
    return oklchToRgb(color);
  }

  // Handle RGB colors
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
    };
  }

  return null;
}

/**
 * Calculate relative luminance of a color
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  // Ensure all values are defined (they should be since we're mapping over numbers)
  if (rs === undefined || gs === undefined || bs === undefined) {
    return 0;
  }

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = parseColor(color1);
  const rgb2 = parseColor(color2);

  if (!rgb1 || !rgb2) {
    console.warn("Unable to parse colors for contrast calculation:", { color1, color2 });
    return 1; // Return minimum contrast if parsing fails
  }

  const l1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if color combination meets WCAG AA standards
 */
export function meetsWCAGAA(foreground: string, background: string, isLargeText = false): boolean {
  const ratio = getContrastRatio(foreground, background);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Check if color combination meets WCAG AAA standards
 */
export function meetsWCAGAAA(foreground: string, background: string, isLargeText = false): boolean {
  const ratio = getContrastRatio(foreground, background);
  return isLargeText ? ratio >= 4.5 : ratio >= 7;
}

/**
 * Get accessibility level for color combination
 */
export function getAccessibilityLevel(
  foreground: string,
  background: string,
  isLargeText = false,
): "AAA" | "AA" | "FAIL" {
  if (meetsWCAGAAA(foreground, background, isLargeText)) return "AAA";
  if (meetsWCAGAA(foreground, background, isLargeText)) return "AA";
  return "FAIL";
}

/**
 * Suggest accessible color alternatives
 */
export function suggestAccessibleColor(
  baseColor: string,
  backgroundColor: string,
  targetLevel: "AA" | "AAA" = "AA",
  isLargeText = false,
): string {
  const targetRatio = targetLevel === "AAA" ? (isLargeText ? 4.5 : 7) : isLargeText ? 3 : 4.5;
  const currentRatio = getContrastRatio(baseColor, backgroundColor);

  if (currentRatio >= targetRatio) {
    return baseColor; // Already meets requirements
  }

  const baseRgb = parseColor(baseColor);
  const bgRgb = parseColor(backgroundColor);

  if (!baseRgb || !bgRgb) {
    return baseColor; // Return original if parsing fails
  }

  const bgLuminance = getRelativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b);

  // Determine if we should make the color lighter or darker
  const shouldLighten = bgLuminance < 0.5;

  // Adjust color iteratively
  let adjustedColor = baseColor;
  let iterations = 0;
  const maxIterations = 50;

  while (
    getContrastRatio(adjustedColor, backgroundColor) < targetRatio &&
    iterations < maxIterations
  ) {
    const rgb = parseColor(adjustedColor);
    if (!rgb) break;

    const adjustment = shouldLighten ? 10 : -10;
    const newR = Math.max(0, Math.min(255, rgb.r + adjustment));
    const newG = Math.max(0, Math.min(255, rgb.g + adjustment));
    const newB = Math.max(0, Math.min(255, rgb.b + adjustment));

    adjustedColor = `rgb(${newR}, ${newG}, ${newB})`;
    iterations++;
  }

  return adjustedColor;
}

/**
 * Validate color palette for accessibility
 */
export interface ColorValidationResult {
  isValid: boolean;
  issues: Array<{
    combination: string;
    level: "AAA" | "AA" | "FAIL";
    ratio: number;
    suggestion?: string;
  }>;
}

export function validateColorPalette(colors: {
  primary: string;
  background: string;
  foreground: string;
  secondary: string;
  muted: string;
  mutedForeground: string;
}): ColorValidationResult {
  const combinations = [
    { name: "Primary on Background", fg: colors.primary, bg: colors.background },
    { name: "Foreground on Background", fg: colors.foreground, bg: colors.background },
    { name: "Secondary on Background", fg: colors.secondary, bg: colors.background },
    { name: "Muted Foreground on Background", fg: colors.mutedForeground, bg: colors.background },
    { name: "Foreground on Primary", fg: colors.foreground, bg: colors.primary },
    { name: "Background on Primary", fg: colors.background, bg: colors.primary },
  ];

  const issues = combinations.map((combo) => {
    const ratio = getContrastRatio(combo.fg, combo.bg);
    const level = getAccessibilityLevel(combo.fg, combo.bg);

    return {
      combination: combo.name,
      level,
      ratio,
      suggestion: level === "FAIL" ? suggestAccessibleColor(combo.fg, combo.bg) : undefined,
    };
  });

  const isValid = issues.every((issue) => issue.level !== "FAIL");

  return { isValid, issues };
}

// Additional utility functions for tests
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function getColorLuminance(color: string): number {
  const rgb = parseColor(color);
  if (!rgb) return 0;
  return getRelativeLuminance(rgb.r, rgb.g, rgb.b);
}

export function isAccessibleContrast(
  foreground: string,
  background: string,
  level: "AA" | "AAA",
  isLargeText = false,
): boolean {
  if (level === "AAA") {
    return meetsWCAGAAA(foreground, background, isLargeText);
  }
  return meetsWCAGAA(foreground, background, isLargeText);
}

export function generateAccessibleColor(
  backgroundColor: string,
  level: "AA" | "AAA" = "AA",
): string {
  return suggestAccessibleColor("#000000", backgroundColor, level);
}
