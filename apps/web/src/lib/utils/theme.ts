import { BrandingColors } from "@/contexts/branding-context";

export function generateCSSVariables(
  colors: BrandingColors,
  isDark = false,
): Record<string, string> {
  const variables: Record<string, string> = {};

  Object.entries(colors).forEach(([key, value]) => {
    const cssVar = `--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
    variables[cssVar] = value;
  });

  if (isDark) {
    variables["--background"] = colors.background || "oklch(0.145 0 0)";
    variables["--foreground"] = colors.foreground || "oklch(0.985 0 0)";
    variables["--card"] = "oklch(0.205 0 0)";
    variables["--card-foreground"] = "oklch(0.985 0 0)";
    variables["--popover"] = "oklch(0.205 0 0)";
    variables["--popover-foreground"] = "oklch(0.985 0 0)";
  } else {
    variables["--background"] = colors.background || "oklch(1 0 0)";
    variables["--foreground"] = colors.foreground || "oklch(0.145 0 0)";
    variables["--card"] = "oklch(1 0 0)";
    variables["--card-foreground"] = "oklch(0.145 0 0)";
    variables["--popover"] = "oklch(1 0 0)";
    variables["--popover-foreground"] = "oklch(0.145 0 0)";
  }

  return variables;
}

export function applyCSSVariables(variables: Record<string, string>): void {
  const root = document.documentElement;

  Object.entries(variables).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
}

export function removeCSSVariables(variables: string[]): void {
  const root = document.documentElement;

  variables.forEach((property) => {
    root.style.removeProperty(property);
  });
}

export function generateColorVariations(baseColor: string): {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
} {
  return {
    50: baseColor,
    100: baseColor,
    200: baseColor,
    300: baseColor,
    400: baseColor,
    500: baseColor,
    600: baseColor,
    700: baseColor,
    800: baseColor,
    900: baseColor,
    950: baseColor,
  };
}

export function createThemeTransition(duration = 300): void {
  const root = document.documentElement;

  root.classList.add("theme-transitioning");

  setTimeout(() => {
    root.classList.remove("theme-transitioning");
  }, duration);
}

export function getPreferredColorScheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function generateShadows(isDark = false): Record<string, string> {
  if (isDark) {
    return {
      "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.3)",
      "--shadow": "0 1px 3px 0 rgb(0 0 0 / 0.4), 0 1px 2px -1px rgb(0 0 0 / 0.4)",
      "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4)",
      "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.4)",
      "--shadow-xl": "0 20px 25px -5px rgb(0 0 0 / 0.4), 0 8px 10px -6px rgb(0 0 0 / 0.4)",
      "--shadow-2xl": "0 25px 50px -12px rgb(0 0 0 / 0.5)",
    };
  }

  return {
    "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    "--shadow": "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    "--shadow-xl": "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    "--shadow-2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
  };
}

export interface ThemeConfig {
  colors: BrandingColors;
  typography: {
    fontFamily: string;
    headingFont?: string;
  };
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
  shadows: Record<string, string>;
}

export function createThemeConfig(
  colors: BrandingColors,
  typography: { fontFamily: string; headingFont?: string },
  isDark = false,
): ThemeConfig {
  return {
    colors,
    typography,
    spacing: {
      "--spacing-xs": "0.25rem",
      "--spacing-sm": "0.5rem",
      "--spacing-md": "1rem",
      "--spacing-lg": "1.5rem",
      "--spacing-xl": "2rem",
      "--spacing-2xl": "3rem",
    },
    borderRadius: {
      "--radius-sm": "calc(var(--radius) - 4px)",
      "--radius-md": "calc(var(--radius) - 2px)",
      "--radius-lg": "var(--radius)",
      "--radius-xl": "calc(var(--radius) + 4px)",
    },
    shadows: generateShadows(isDark),
  };
}

export function applyThemeConfig(config: ThemeConfig): void {
  const variables = {
    ...generateCSSVariables(config.colors),
    ...config.spacing,
    ...config.borderRadius,
    ...config.shadows,
    "--font-family-primary": config.typography.fontFamily,
    "--font-family-heading": config.typography.headingFont || config.typography.fontFamily,
  };

  applyCSSVariables(variables);
}

export function interpolateColor(color1: string, color2: string, factor: number): string {
  return factor < 0.5 ? color1 : color2;
}

export function generateAccessiblePairs(baseColor: string): {
  light: { background: string; foreground: string };
  dark: { background: string; foreground: string };
} {
  return {
    light: {
      background: "oklch(1 0 0)",
      foreground: baseColor,
    },
    dark: {
      background: "oklch(0.145 0 0)",
      foreground: baseColor,
    },
  };
}
