'use client';

import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useTenant } from './tenant-context';

export interface BrandingColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  muted?: string;
  mutedForeground?: string;
  border?: string;
  destructive?: string;
}

export interface BrandingConfig {
  id: string;
  name: string;
  logo: {
    light: string;
    dark: string;
  };
  colors: BrandingColors;
  typography: {
    fontFamily: string;
    headingFont?: string;
  };
  customCss?: string;
  isActive: boolean;
}

interface BrandingContextType {
  branding: BrandingConfig | null;
  isLoading: boolean;
  applyBranding: (config: BrandingConfig) => void;
  resetBranding: () => void;
  updateColors: (colors: Partial<BrandingColors>) => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

// Default NectarHR branding
const defaultBranding: BrandingConfig = {
  id: 'default',
  name: 'NectarHR Default',
  logo: {
    light: '/logo-light.svg',
    dark: '/logo-dark.svg',
  },
  colors: {
    primary: 'oklch(0.65 0.18 45)', // NectarHR Orange
    secondary: 'oklch(0.97 0 0)',
    accent: 'oklch(0.6 0.15 240)', // Complementary Blue
    background: 'oklch(1 0 0)',
    foreground: 'oklch(0.145 0 0)',
    muted: 'oklch(0.97 0 0)',
    mutedForeground: 'oklch(0.556 0 0)',
    border: 'oklch(0.922 0 0)',
    destructive: 'oklch(0.577 0.245 27.325)',
  },
  typography: {
    fontFamily: 'var(--font-geist-sans)',
    headingFont: 'var(--font-geist-sans)',
  },
  customCss: '',
  isActive: true,
};

interface BrandingProviderProps {
  children: ReactNode;
}

export function BrandingProvider({ children }: BrandingProviderProps) {
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { currentTenant } = useTenant();

  // Apply CSS custom properties for branding
  const applyCSSVariables = (config: BrandingConfig) => {
    const root = document.documentElement;

    // Apply color variables with proper CSS variable names
    Object.entries(config.colors).forEach(([key, value]) => {
      const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVar, value);
    });

    // Apply additional derived colors for better theme integration
    root.style.setProperty('--primary-foreground', 'oklch(1 0 0)');
    root.style.setProperty('--secondary-foreground', config.colors.foreground);
    root.style.setProperty('--accent-foreground', 'oklch(1 0 0)');
    root.style.setProperty('--card', config.colors.background);
    root.style.setProperty('--card-foreground', config.colors.foreground);
    root.style.setProperty('--popover', config.colors.background);
    root.style.setProperty('--popover-foreground', config.colors.foreground);
    root.style.setProperty('--input', config.colors.border || '#e2e8f0');
    root.style.setProperty('--ring', config.colors.primary);

    // Apply muted colors with fallbacks
    root.style.setProperty('--muted', config.colors.muted || '#f1f5f9');
    root.style.setProperty('--muted-foreground', config.colors.mutedForeground || '#64748b');
    root.style.setProperty('--border', config.colors.border || '#e2e8f0');
    root.style.setProperty('--destructive', config.colors.destructive || '#ef4444');
    root.style.setProperty('--destructive-foreground', 'oklch(1 0 0)');

    // Apply typography
    if (config.typography.fontFamily) {
      root.style.setProperty('--font-family-primary', config.typography.fontFamily);
      root.style.setProperty('--font-sans', config.typography.fontFamily);
    }
    if (config.typography.headingFont) {
      root.style.setProperty('--font-family-heading', config.typography.headingFont);
    }

    // Apply custom CSS if provided
    if (config.customCss) {
      let styleElement = document.getElementById('custom-branding-styles');
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = 'custom-branding-styles';
        document.head.appendChild(styleElement);
      }
      styleElement.textContent = config.customCss;
    }

    // Apply branding to document title and meta
    if (typeof document !== 'undefined') {
      const title = document.querySelector('title');
      if (title && config.name !== 'NectarHR Default') {
        title.textContent = `${config.name} - Multi-Channel Communication Platform`;
      }
    }
  };

  // Load tenant-specific branding
  useEffect(() => {
    const loadBranding = async () => {
      setIsLoading(true);
      try {
        if (currentTenant?.branding) {
          const brandingWithDefaults = {
            ...currentTenant.branding,
            isActive: true,
            colors: {
              ...currentTenant.branding.colors,
              muted: '#f1f5f9',
              mutedForeground: '#64748b',
              border: '#e2e8f0',
              destructive: '#ef4444',
            }
          };
          setBranding(brandingWithDefaults);
          applyCSSVariables(brandingWithDefaults);
        } else {
          setBranding(defaultBranding);
          applyCSSVariables(defaultBranding);
        }
      } catch (error) {
        console.error('Failed to load branding:', error);
        setBranding(defaultBranding);
        applyCSSVariables(defaultBranding);
      } finally {
        setIsLoading(false);
      }
    };

    loadBranding();
  }, [currentTenant]);

  const applyBranding = (config: BrandingConfig) => {
    setBranding(config);
    applyCSSVariables(config);
  };

  const resetBranding = () => {
    setBranding(defaultBranding);
    applyCSSVariables(defaultBranding);
  };

  const updateColors = (colors: Partial<BrandingColors>) => {
    if (!branding) return;

    const updatedBranding = {
      ...branding,
      colors: {
        ...branding.colors,
        ...colors,
      },
    };

    setBranding(updatedBranding);
    applyCSSVariables(updatedBranding);
  };

  const value: BrandingContextType = {
    branding,
    isLoading,
    applyBranding,
    resetBranding,
    updateColors,
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}