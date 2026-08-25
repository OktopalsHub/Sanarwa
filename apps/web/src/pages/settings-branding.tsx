"use client";

import { BrandAssetManager } from "@/components/branding/brand-asset-manager";
import { BrandPreview } from "@/components/branding/brand-preview";
import { BrandTestingTool } from "@/components/branding/brand-testing-tool";
import { BrandingConfigurator } from "@/components/branding/branding-configurator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBranding } from "@/contexts/branding-context";
import { EyeIcon, CubeIcon, SwatchIcon, BeakerIcon } from "@heroicons/react/24/outline";

export default function BrandingSettingsPage() {
  const { branding, applyBranding } = useBranding();

  if (!branding) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <SwatchIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">Loading branding configuration...</p>
        </div>
      </div>
    );
  }

  const handleBrandingChange = (updates: Partial<typeof branding>) => {
    const updatedBranding = { ...branding, ...updates };
    applyBranding(updatedBranding);
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Brand Settings</h1>
        <p className="text-muted-foreground mt-2">
          Customize your brand identity and manage brand assets
        </p>
      </div>

      <Tabs defaultValue="configurator" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="configurator" className="flex items-center gap-2">
            <SwatchIcon className="h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <EyeIcon className="h-4 w-4" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="testing" className="flex items-center gap-2">
            <BeakerIcon className="h-4 w-4" />
            Testing
          </TabsTrigger>
          <TabsTrigger value="assets" className="flex items-center gap-2">
            <CubeIcon className="h-4 w-4" />
            Asset Manager
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configurator" className="mt-6">
          <BrandingConfigurator />
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          <BrandPreview branding={branding} />
        </TabsContent>

        <TabsContent value="testing" className="mt-6">
          <BrandTestingTool branding={branding} />
        </TabsContent>

        <TabsContent value="assets" className="mt-6">
          <BrandAssetManager branding={branding} onBrandingChange={handleBrandingChange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
