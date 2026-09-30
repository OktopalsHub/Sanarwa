"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { BrandingConfig, useBranding } from "@/contexts/branding-context";
import { useBrandApplication } from "@/hooks/use-brand-application";
import { useThemeCustomization } from "@/hooks/use-theme-customization";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@radix-ui/react-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs";
import {
  ExclamationTriangleIcon,
  CheckIcon,
  DocumentDuplicateIcon,
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  EyeIcon,
  SwatchIcon,
  ArrowPathIcon,
  BookmarkIcon,
  LanguageIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
  CodeBracketIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useState } from "react";
import { ColorPicker } from "./color-picker";
import { FontSelector } from "./font-selector";
import { LogoUploader } from "./logo-uploader";

// NectarHR Orange color presets
const NECTAR_ORANGE_PRESETS = [
  { name: "Primary Orange", value: "oklch(0.65 0.18 45)", description: "Main brand color" },
  { name: "Light Orange", value: "oklch(0.75 0.15 45)", description: "Lighter variant" },
  { name: "Dark Orange", value: "oklch(0.55 0.20 45)", description: "Darker variant" },
  { name: "Vibrant Orange", value: "oklch(0.70 0.22 40)", description: "More vibrant" },
  { name: "Warm Orange", value: "oklch(0.65 0.18 50)", description: "Warmer tone" },
  { name: "Soft Orange", value: "oklch(0.80 0.12 45)", description: "Softer variant" },
];

interface BrandingConfiguratorProps {
  className?: string;
}

export function BrandingConfigurator({ className }: BrandingConfiguratorProps) {
  const { branding, applyBranding, isLoading } = useBranding();
  const { accessibilityReport, isDark } = useThemeCustomization();
  const { accessibilityReport: brandAccessibilityReport } = useBrandApplication();
  const [localBranding, setLocalBranding] = useState<BrandingConfig | null>(branding);
  const [previewMode, setPreviewMode] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const handleBrandingChange = useCallback(
    (updates: Partial<BrandingConfig>) => {
      if (!localBranding) return;

      const updatedBranding = {
        ...localBranding,
        ...updates,
      };

      setLocalBranding(updatedBranding);

      if (previewMode) {
        applyBranding(updatedBranding);
      }
    },
    [localBranding, previewMode, applyBranding],
  );

  const handleColorChange = useCallback(
    (colorKey: string, value: string) => {
      if (!localBranding) return;

      const updatedColors = {
        ...localBranding.colors,
        [colorKey]: value,
      };

      handleBrandingChange({ colors: updatedColors });
    },
    [localBranding, handleBrandingChange],
  );

  const handlePreview = useCallback(() => {
    if (!localBranding) return;

    setPreviewMode(true);
    applyBranding(localBranding);
  }, [localBranding, applyBranding]);

  const handleSave = useCallback(async () => {
    if (!localBranding) return;

    setIsApplying(true);
    try {
      applyBranding(localBranding);
      setPreviewMode(false);
      // In a real application, you would save to the backend here
    } catch (error) {
      console.error("Failed to save branding:", error);
    } finally {
      setIsApplying(false);
    }
  }, [localBranding, applyBranding]);

  const handleCancel = useCallback(() => {
    if (branding) {
      setLocalBranding(branding);
      applyBranding(branding);
    }
    setPreviewMode(false);
  }, [branding, applyBranding]);

  const handleReset = useCallback(() => {
    // Reset to default branding
    const defaultBranding: BrandingConfig = {
      id: "default",
      name: "NectarHR Default",
      logo: {
        light: "/logo-light.svg",
        dark: "/logo-dark.svg",
      },
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
      isActive: true,
    };

    setLocalBranding(defaultBranding);
    if (previewMode) {
      applyBranding(defaultBranding);
    }
  }, [isDark, previewMode, applyBranding]);

  const handleExport = useCallback(() => {
    if (!localBranding) return;

    const exportData = {
      name: localBranding.name,
      branding: localBranding,
      accessibility: accessibilityReport,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${localBranding.name.toLowerCase().replace(/\s+/g, "-")}-branding.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [localBranding, accessibilityReport]);

  if (isLoading || !localBranding) {
    return (
      <Card className={cn("p-6", className)}>
        <div className="text-center text-muted-foreground">
          <SwatchIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Loading branding configuration...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-6", className)}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Brand Configuration</h3>
            <p className="text-sm text-muted-foreground">
              Customize your brand identity and visual appearance
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
        {(!accessibilityReport.isValid || !brandAccessibilityReport.isValid) && (
          <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-800 dark:text-red-200">
                Accessibility Issues Found
              </span>
            </div>
            <div className="space-y-1">
              {[...accessibilityReport.issues, ...brandAccessibilityReport.issues]
                .filter((issue) => issue.level === "FAIL")
                .map((issue, index) => (
                  <p key={index} className="text-xs text-red-700 dark:text-red-300">
                    {issue.combination}:{" "}
                    {(issue as any).suggestion ||
                      (issue as any).recommendation ||
                      `Contrast ratio ${issue.ratio.toFixed(2)} is too low`}
                  </p>
                ))}
            </div>
          </div>
        )}

        {/* Brand Name */}
        <div className="space-y-2">
          <Label htmlFor="brandName">Brand Name</Label>
          <Input
            id="brandName"
            value={localBranding.name}
            onChange={(e) => handleBrandingChange({ name: e.target.value })}
            placeholder="Enter brand name"
          />
        </div>

        <Separator />

        {/* Tabbed Configuration */}
        <Tabs defaultValue="logos" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="logos" className="flex items-center gap-2">
              <PhotoIcon className="h-4 w-4" />
              Logos
            </TabsTrigger>
            <TabsTrigger value="colors" className="flex items-center gap-2">
              <SwatchIcon className="h-4 w-4" />
              Colors
            </TabsTrigger>
            <TabsTrigger value="typography" className="flex items-center gap-2">
              <LanguageIcon className="h-4 w-4" />
              Typography
            </TabsTrigger>
            <TabsTrigger value="custom-css" className="flex items-center gap-2">
              <CodeBracketIcon className="h-4 w-4" />
              Custom CSS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="logos" className="space-y-4 mt-6">
            <div className="space-y-6">
              <LogoUploader
                label="Light Mode Logo"
                value={localBranding.logo.light}
                onChange={(value) =>
                  handleBrandingChange({
                    logo: { ...localBranding.logo, light: value },
                  })
                }
              />
              <LogoUploader
                label="Dark Mode Logo"
                value={localBranding.logo.dark}
                onChange={(value) =>
                  handleBrandingChange({
                    logo: { ...localBranding.logo, dark: value },
                  })
                }
              />
            </div>
          </TabsContent>

          <TabsContent value="colors" className="space-y-4 mt-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ColorPicker
                  label="Primary Color"
                  value={localBranding.colors.primary}
                  onChange={(value) => handleColorChange("primary", value)}
                  presets={NECTAR_ORANGE_PRESETS}
                  showAccessibility
                  contrastBase={localBranding.colors.background}
                />
                <ColorPicker
                  label="Secondary Color"
                  value={localBranding.colors.secondary}
                  onChange={(value) => handleColorChange("secondary", value)}
                  showAccessibility
                  contrastBase={localBranding.colors.background}
                />
                <ColorPicker
                  label="Accent Color"
                  value={localBranding.colors.accent}
                  onChange={(value) => handleColorChange("accent", value)}
                  showAccessibility
                  contrastBase={localBranding.colors.background}
                />
                <ColorPicker
                  label="Background Color"
                  value={localBranding.colors.background}
                  onChange={(value) => handleColorChange("background", value)}
                />
                <ColorPicker
                  label="Foreground Color"
                  value={localBranding.colors.foreground}
                  onChange={(value) => handleColorChange("foreground", value)}
                  showAccessibility
                  contrastBase={localBranding.colors.background}
                />
                <ColorPicker
                  label="Muted Color"
                  value={localBranding.colors.muted || "#f1f5f9"}
                  onChange={(value) => handleColorChange("muted", value)}
                />
                <ColorPicker
                  label="Muted Foreground"
                  value={localBranding.colors.mutedForeground || "#64748b"}
                  onChange={(value) => handleColorChange("mutedForeground", value)}
                  showAccessibility
                  contrastBase={localBranding.colors.muted || "#f1f5f9"}
                />
                <ColorPicker
                  label="Border Color"
                  value={localBranding.colors.border || "#e2e8f0"}
                  onChange={(value) => handleColorChange("border", value)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="typography" className="space-y-4 mt-6">
            <div className="space-y-6">
              <FontSelector
                label="Primary Font Family"
                value={localBranding.typography.fontFamily}
                onChange={(value) =>
                  handleBrandingChange({
                    typography: { ...localBranding.typography, fontFamily: value },
                  })
                }
              />
              <FontSelector
                label="Heading Font Family"
                value={localBranding.typography.headingFont || localBranding.typography.fontFamily}
                onChange={(value) =>
                  handleBrandingChange({
                    typography: { ...localBranding.typography, headingFont: value },
                  })
                }
              />
            </div>
          </TabsContent>

          <TabsContent value="custom-css" className="space-y-4 mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Custom CSS</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open("https://developer.mozilla.org/en-US/docs/Web/CSS", "_blank")
                  }
                >
                  <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-2" />
                  CSS Reference
                </Button>
              </div>
              <Textarea
                value={localBranding.customCss || ""}
                onChange={(e) => handleBrandingChange({ customCss: e.target.value })}
                placeholder={`/* Add custom CSS here */
:root {
  --custom-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

.custom-button {
  border-radius: 8px;
  box-shadow: var(--custom-shadow);
}`}
                className="font-mono text-sm min-h-[200px]"
              />
              <div className="text-xs text-muted-foreground">
                Custom CSS will be applied globally. Use CSS custom properties for better
                maintainability.
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {previewMode ? (
            <>
              <Button onClick={handleSave} disabled={isApplying}>
                <BookmarkIcon className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={isApplying}>
                <XMarkIcon className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </>
          ) : (
            <Button onClick={handlePreview}>
              <EyeIcon className="h-4 w-4 mr-2" />
              Preview
            </Button>
          )}

          <Button variant="outline" onClick={handleReset} disabled={isApplying}>
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>

          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
