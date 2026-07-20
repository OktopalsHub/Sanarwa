'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { BrandingColors } from '@/contexts/branding-context';
import { useThemeCustomization } from '@/hooks/use-theme-customization';
import { cn } from '@/lib/utils';
import { ExclamationTriangleIcon, CheckIcon, ArrowDownTrayIcon, EyeIcon, SwatchIcon, ArrowPathIcon, BookmarkIcon, ArrowUpTrayIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useCallback, useRef, useState } from 'react';

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  accessibilityLevel?: 'AAA' | 'AA' | 'FAIL';
  description?: string;
}

function ColorInput({ label, value, onChange, accessibilityLevel, description }: ColorInputProps) {
  const [inputValue, setInputValue] = useState(value);

  const handleChange = (newValue: string) => {
    setInputValue(newValue);
    onChange(newValue);
  };

  const getAccessibilityIcon = () => {
    switch (accessibilityLevel) {
      case 'AAA':
        return <CheckIcon className="h-4 w-4 text-green-600" />;
      case 'AA':
        return <CheckIcon className="h-4 w-4 text-yellow-600" />;
      case 'FAIL':
        return <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={label} className="text-sm font-medium">
          {label}
        </Label>
        {accessibilityLevel && (
          <div className="flex items-center gap-1">
            {getAccessibilityIcon()}
            <span className="text-xs text-muted-foreground">{accessibilityLevel}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded border border-border flex-shrink-0"
          style={{ backgroundColor: value }}
        />
        <Input
          id={label}
          value={inputValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="oklch(0.65 0.18 45)"
          className="font-mono text-sm"
        />
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

interface ThemeConfiguratorProps {
  className?: string;
}

export function ThemeConfigurator({ className }: ThemeConfiguratorProps) {
  const {
    currentTheme,
    previewMode,
    accessibilityReport,
    isApplying,
    previewTheme,
    commitTheme,
    cancelPreview,
    updateColor,
    resetToDefault,
    exportTheme,
    importTheme,
  } = useThemeCustomization();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customCss, setCustomCss] = useState(currentTheme?.customCss || '');

  const handleColorChange = useCallback(
    (colorKey: keyof BrandingColors, value: string) => {
      updateColor(colorKey, value);
    },
    [updateColor]
  );

  const handlePreview = useCallback(() => {
    if (!currentTheme) return;

    const updatedTheme = {
      ...currentTheme,
      customCss,
    };

    previewTheme(updatedTheme);
  }, [currentTheme, customCss, previewTheme]);

  const handleCommit = useCallback(() => {
    if (!currentTheme) return;

    const updatedTheme = {
      ...currentTheme,
      customCss,
    };

    commitTheme(updatedTheme);
  }, [currentTheme, customCss, commitTheme]);

  const handleExport = useCallback(() => {
    const themeData = exportTheme();
    if (!themeData) return;

    const blob = new Blob([JSON.stringify(themeData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${themeData.name.toLowerCase().replace(/\s+/g, '-')}-theme.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [exportTheme]);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const themeData = JSON.parse(e.target?.result as string);
          importTheme(themeData);
          setCustomCss(themeData.config.customCss || '');
        } catch (error) {
          console.error('Failed to import theme:', error);
        }
      };
      reader.readAsText(file);
    },
    [importTheme]
  );

  if (!currentTheme) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="text-center text-muted-foreground">
          <SwatchIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No theme configuration available</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('p-6', className)}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Theme Configurator</h3>
            <p className="text-sm text-muted-foreground">
              Customize colors and styling for your brand
            </p>
          </div>
          <div className="flex items-center gap-2">
            {previewMode && (
              <div className="flex items-center gap-1 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-1 rounded">
                <EyeIcon className="h-4 w-4" />
                Preview Mode
              </div>
            )}
          </div>
        </div>

        {/* Accessibility Report */}
        {!accessibilityReport.isValid && (
          <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-800 dark:text-red-200">
                Accessibility Issues Found
              </span>
            </div>
            <div className="space-y-1">
              {accessibilityReport.issues
                .filter(issue => issue.level === 'FAIL')
                .map((issue, index) => (
                  <p key={index} className="text-xs text-red-700 dark:text-red-300">
                    {issue.combination}: Contrast ratio {issue.ratio.toFixed(2)} is too low
                  </p>
                ))}
            </div>
          </div>
        )}

        {/* Color Configuration */}
        <div className="space-y-4">
          <h4 className="text-md font-medium">Colors</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ColorInput
              label="Primary"
              value={currentTheme.colors.primary || '#f97316'}
              onChange={(value) => handleColorChange('primary', value)}
              description="Main brand color (NectarHR Orange)"
            />
            <ColorInput
              label="Secondary"
              value={currentTheme.colors.secondary || '#64748b'}
              onChange={(value) => handleColorChange('secondary', value)}
              description="Secondary brand color"
            />
            <ColorInput
              label="Accent"
              value={currentTheme.colors.accent || '#3b82f6'}
              onChange={(value) => handleColorChange('accent', value)}
              description="Accent color for highlights"
            />
            <ColorInput
              label="Background"
              value={currentTheme.colors.background || '#ffffff'}
              onChange={(value) => handleColorChange('background', value)}
              description="Main background color"
            />
            <ColorInput
              label="Foreground"
              value={currentTheme.colors.foreground || '#0f172a'}
              onChange={(value) => handleColorChange('foreground', value)}
              description="Main text color"
            />
            <ColorInput
              label="Muted"
              value={currentTheme.colors.muted || '#f1f5f9'}
              onChange={(value) => handleColorChange('muted', value)}
              description="Muted background color"
            />
            <ColorInput
              label="Muted Foreground"
              value={currentTheme.colors.mutedForeground || '#64748b'}
              onChange={(value) => handleColorChange('mutedForeground', value)}
              description="Muted text color"
            />
            <ColorInput
              label="Border"
              value={currentTheme.colors.border || '#e2e8f0'}
              onChange={(value) => handleColorChange('border', value)}
              description="Border and divider color"
            />
          </div>
        </div>

        <Separator />

        {/* Typography Configuration */}
        <div className="space-y-4">
          <h4 className="text-md font-medium">Typography</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fontFamily">Font Family</Label>
              <Input
                id="fontFamily"
                value={currentTheme.typography.fontFamily}
                onChange={(e) => {
                  // Handle font family change
                }}
                placeholder="var(--font-geist-sans)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="headingFont">Heading Font</Label>
              <Input
                id="headingFont"
                value={currentTheme.typography.headingFont || ''}
                onChange={(e) => {
                  // Handle heading font change
                }}
                placeholder="var(--font-geist-sans)"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Custom CSS */}
        <div className="space-y-4">
          <h4 className="text-md font-medium">Custom CSS</h4>
          <div className="space-y-2">
            <Label htmlFor="customCss">Additional Styles</Label>
            <textarea
              id="customCss"
              value={customCss}
              onChange={(e) => setCustomCss(e.target.value)}
              placeholder="/* Add custom CSS here */"
              className="w-full h-32 px-3 py-2 text-sm border border-border rounded-md bg-background font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
            <p className="text-xs text-muted-foreground">
              Add custom CSS to further customize your theme
            </p>
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {previewMode ? (
            <>
              <Button onClick={handleCommit} disabled={isApplying}>
                <BookmarkIcon className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
              <Button variant="outline" onClick={cancelPreview} disabled={isApplying}>
                <XMarkIcon className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </>
          ) : (
            <Button onClick={handlePreview} disabled={isApplying}>
              <EyeIcon className="h-4 w-4 mr-2" />
              Preview
            </Button>
          )}

          <Button variant="outline" onClick={resetToDefault} disabled={isApplying}>
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>

          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={handleImport}>
              <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
              Import
            </Button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </Card>
  );
}