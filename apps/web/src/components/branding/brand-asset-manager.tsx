'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { BrandingConfig } from '@/contexts/branding-context';
import { cn } from '@/lib/utils';
import { CubeIcon, SwatchIcon, PhotoIcon } from '@heroicons/react/24/outline'
import { useCallback, useState } from 'react';

interface BrandAssetManagerProps {
  branding: BrandingConfig;
  onBrandingChange: (updates: Partial<BrandingConfig>) => void;
  className?: string;
}

export function BrandAssetManager({ branding, onBrandingChange, className }: BrandAssetManagerProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportAssets = useCallback(async () => {
    setIsExporting(true);
    try {
      // Create a comprehensive brand package
      const brandPackage = {
        name: branding.name,
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        branding: {
          ...branding,
          // Include asset URLs for reference
          assets: {
            logoLight: branding.logo.light,
            logoDark: branding.logo.dark,
          }
        },
        colorPalette: {
          primary: branding.colors.primary,
          secondary: branding.colors.secondary,
          accent: branding.colors.accent,
          background: branding.colors.background,
          foreground: branding.colors.foreground,
          muted: branding.colors.muted,
          mutedForeground: branding.colors.mutedForeground,
          border: branding.colors.border,
          destructive: branding.colors.destructive,
        },
        typography: branding.typography,
        customCss: branding.customCss,
        // CSS Variables for easy integration
        cssVariables: generateCSSVariables(branding),
        // Tailwind config snippet
        tailwindConfig: generateTailwindConfig(branding),
      };

      // Create and download the brand package
      const blob = new Blob([JSON.stringify(brandPackage, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${branding.name.toLowerCase().replace(/\s+/g, '-')}-brand-package.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export brand assets:', error);
    } finally {
      setIsExporting(false);
    }
  }, [branding]);

  const handleExportCSS = useCallback(() => {
    const cssContent = generateCSSVariables(branding);
    const blob = new Blob([cssContent], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${branding.name.toLowerCase().replace(/\s+/g, '-')}-variables.css`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [branding]);

  const handleExportTailwindConfig = useCallback(() => {
    const configContent = generateTailwindConfig(branding);
    const blob = new Blob([configContent], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${branding.name.toLowerCase().replace(/\s+/g, '-')}-tailwind.config.js`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [branding]);

  return (
    <Card className={cn('p-6', className)}>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Brand Asset Manager</h3>
          <p className="text-sm text-muted-foreground">
            Export and manage your brand assets and configurations
          </p>
        </div>

        <Separator />

        {/* Asset Preview */}
        <div className="space-y-4">
          <h4 className="text-md font-medium">Asset Preview</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Light Mode Logo</Label>
              <div className="w-full h-24 border border-border rounded-lg flex items-center justify-center bg-white overflow-hidden">
                {branding.logo.light ? (
                  <img
                    src={branding.logo.light}
                    alt="Light mode logo"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="text-muted-foreground text-sm">No logo uploaded</div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dark Mode Logo</Label>
              <div className="w-full h-24 border border-border rounded-lg flex items-center justify-center bg-gray-900 overflow-hidden">
                {branding.logo.dark ? (
                  <img
                    src={branding.logo.dark}
                    alt="Dark mode logo"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="text-white text-sm">No logo uploaded</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Color Palette Preview */}
        <div className="space-y-4">
          <h4 className="text-md font-medium">Color Palette</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(branding.colors).map(([key, value]) => (
              <div key={key} className="space-y-2">
                <div
                  className="w-full h-16 rounded-lg border border-border"
                  style={{ backgroundColor: value }}
                />
                <div className="text-xs">
                  <div className="font-medium capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div className="text-muted-foreground font-mono">{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Export Options */}
        <div className="space-y-4">
          <h4 className="text-md font-medium">Export Options</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              variant="outline"
              onClick={handleExportAssets}
              disabled={isExporting}
              className="h-auto p-4 flex-col gap-2"
            >
              <CubeIcon className="h-6 w-6" />
              <div className="text-center">
                <div className="font-medium">Complete Package</div>
                <div className="text-xs text-muted-foreground">
                  JSON with all brand data
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={handleExportCSS}
              className="h-auto p-4 flex-col gap-2"
            >
              <SwatchIcon className="h-6 w-6" />
              <div className="text-center">
                <div className="font-medium">CSS Variables</div>
                <div className="text-xs text-muted-foreground">
                  Ready-to-use CSS file
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={handleExportTailwindConfig}
              className="h-auto p-4 flex-col gap-2"
            >
              <PhotoIcon className="h-6 w-6" />
              <div className="text-center">
                <div className="font-medium">Tailwind Config</div>
                <div className="text-xs text-muted-foreground">
                  Tailwind theme config
                </div>
              </div>
            </Button>
          </div>
        </div>

        <Separator />

        {/* Usage Instructions */}
        <div className="space-y-3">
          <h4 className="text-md font-medium">Usage Instructions</h4>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Complete Package:</strong> Contains all brand data in JSON format for backup or sharing.
            </p>
            <p>
              <strong>CSS Variables:</strong> Import into your project to use the color scheme with CSS custom properties.
            </p>
            <p>
              <strong>Tailwind Config:</strong> Add to your Tailwind configuration to use brand colors as utility classes.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Helper functions
function generateCSSVariables(branding: BrandingConfig): string {
  const variables = Object.entries(branding.colors)
    .map(([key, value]) => {
      const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      return `  ${cssVar}: ${value};`;
    })
    .join('\n');

  return `:root {
${variables}
  
  /* Typography */
  --font-family-primary: ${branding.typography.fontFamily};
  --font-family-heading: ${branding.typography.headingFont || branding.typography.fontFamily};
}

/* Custom CSS */
${branding.customCss || ''}`;
}

function generateTailwindConfig(branding: BrandingConfig): string {
  const colors = Object.entries(branding.colors)
    .map(([key, value]) => `        ${key}: '${value}',`)
    .join('\n');

  return `module.exports = {
  theme: {
    extend: {
      colors: {
${colors}
      },
      fontFamily: {
        sans: ['${branding.typography.fontFamily}', 'sans-serif'],
        heading: ['${branding.typography.headingFont || branding.typography.fontFamily}', 'sans-serif'],
      },
    },
  },
};`;
}