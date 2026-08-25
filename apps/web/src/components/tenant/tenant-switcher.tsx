"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTenant } from "@/contexts/tenant-context";
import { cn } from "@/lib/utils";
import {
  BuildingOfficeIcon,
  CheckIcon,
  PlusIcon,
  ChevronUpDownIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

interface TenantSwitcherProps {
  className?: string;
}

export function TenantSwitcher({ className }: TenantSwitcherProps) {
  const { currentTenant, tenants, switchTenant, isLoading } = useTenant();
  const [isOpen, setIsOpen] = useState(false);

  const handleTenantSwitch = async (tenantId: string) => {
    if (tenantId === currentTenant?.id) {
      setIsOpen(false);
      return;
    }

    try {
      await switchTenant(tenantId);
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to switch tenant:", error);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        aria-label="Select tenant"
        className="w-full justify-between"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
      >
        <div className="flex items-center space-x-2">
          <BuildingOfficeIcon className="h-4 w-4" />
          <span className="truncate">{currentTenant?.name || "Select tenant"}</span>
        </div>
        <ChevronUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <Card className="absolute top-full left-0 right-0 z-50 mt-1 p-1">
            <div className="max-h-64 overflow-auto">
              {tenants.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground text-center">
                  No tenants available
                </div>
              ) : (
                tenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    onClick={() => handleTenantSwitch(tenant.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors",
                      currentTenant?.id === tenant.id && "bg-accent text-accent-foreground",
                    )}
                  >
                    <div className="flex items-center space-x-2">
                      <BuildingOfficeIcon className="h-4 w-4" />
                      <div className="text-left">
                        <div className="font-medium">{tenant.name}</div>
                        <div className="text-xs text-muted-foreground">{tenant.slug}</div>
                      </div>
                    </div>
                    {currentTenant?.id === tenant.id && <CheckIcon className="h-4 w-4" />}
                  </button>
                ))
              )}

              <div className="border-t mt-1 pt-1">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    // TODO: Open create tenant modal
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>Create new tenant</span>
                </button>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
