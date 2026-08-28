"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { AudienceConfig } from "@/lib/types/campaign";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { AudienceCustomFilters } from "./audience-custom-filters";
import { AudienceSegmentPicker, AudienceTypeSelector } from "./audience-segment-picker";
import { useAudienceTargeting } from "./use-audience-targeting";

interface AudienceTargetingStepProps {
  data?: AudienceConfig;
  onUpdate: (data: AudienceConfig) => void;
}

export function AudienceTargetingStep({ data, onUpdate }: AudienceTargetingStepProps) {
  const {
    audienceType,
    selectedSegments,
    customFilters,
    estimatedSize,
    showAdvanced,
    segments,
    segmentsLoading,
    sizeEstimate,
    setShowAdvanced,
    handleAudienceTypeChange,
    handleSegmentToggle,
    addCustomFilter,
    updateCustomFilter,
    removeCustomFilter,
  } = useAudienceTargeting(data, onUpdate);

  return (
    <div className="space-y-6">
      <AudienceTypeSelector audienceType={audienceType} onChange={handleAudienceTypeChange} />

      {audienceType === "segment" && (
        <AudienceSegmentPicker
          segments={segments}
          isLoading={segmentsLoading}
          selectedSegments={selectedSegments}
          onToggle={handleSegmentToggle}
        />
      )}

      {audienceType === "custom" && (
        <AudienceCustomFilters
          customFilters={customFilters}
          onAdd={addCustomFilter}
          onUpdate={updateCustomFilter}
          onRemove={removeCustomFilter}
        />
      )}

      {(estimatedSize !== undefined || sizeEstimate) && (
        <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <InformationCircleIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-blue-700 dark:text-blue-400">
                Estimated Audience Size
              </span>
            </div>
            <p className="text-2xl font-bold text-blue-800 dark:text-blue-300 mt-1">
              {(estimatedSize || sizeEstimate?.size || 0).toLocaleString()} users
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-500 mt-1">
              This is an approximate count based on your current filters
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full justify-between"
        >
          <span>Advanced Options</span>
          {showAdvanced ? (
            <ChevronUpIcon className="w-4 h-4" />
          ) : (
            <ChevronDownIcon className="w-4 h-4" />
          )}
        </Button>

        {showAdvanced && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>Frequency Capping</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Input placeholder="Max messages" type="number" />
                  </div>
                  <div>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Time period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Per Day</SelectItem>
                        <SelectItem value="week">Per Week</SelectItem>
                        <SelectItem value="month">Per Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Timezone Optimization</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone handling" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User's Timezone</SelectItem>
                    <SelectItem value="company">Company Timezone</SelectItem>
                    <SelectItem value="utc">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
