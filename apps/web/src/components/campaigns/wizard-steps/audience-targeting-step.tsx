"use client";

import { Filter, Send, Target, User, Users } from "@/lib/icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { campaignApi } from "@/lib/api/campaigns";
import type { AudienceConfig, AudienceFilter } from "@/lib/types/campaign";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  FunnelIcon,
  InformationCircleIcon,
  PlusIcon,
  CursorArrowRaysIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

interface AudienceTargetingStepProps {
  data?: AudienceConfig;
  onUpdate: (data: AudienceConfig) => void;
}

const AUDIENCE_TYPES = [
  {
    value: "all" as const,
    label: "All Users",
    description: "Send to your entire audience",
    icon: Users,
  },
  {
    value: "segment" as const,
    label: "Saved Segments",
    description: "Use pre-defined audience segments",
    icon: Target,
  },
  {
    value: "custom" as const,
    label: "Custom Filters",
    description: "Create custom audience filters",
    icon: Filter,
  },
];

const FILTER_FIELDS = [
  { value: "email", label: "Email", type: "text" },
  { value: "name", label: "Name", type: "text" },
  { value: "country", label: "Country", type: "text" },
  { value: "city", label: "City", type: "text" },
  { value: "age", label: "Age", type: "number" },
  { value: "signup_date", label: "Signup Date", type: "date" },
  { value: "last_active", label: "Last Active", type: "date" },
  {
    value: "subscription_status",
    label: "Subscription Status",
    type: "select",
    options: ["active", "inactive", "trial"],
  },
  {
    value: "user_type",
    label: "User Type",
    type: "select",
    options: ["free", "premium", "enterprise"],
  },
];

const OPERATORS = [
  { value: "equals", label: "Equals", types: ["text", "number", "select"] },
  { value: "not_equals", label: "Not Equals", types: ["text", "number", "select"] },
  { value: "contains", label: "Contains", types: ["text"] },
  { value: "not_contains", label: "Does Not Contain", types: ["text"] },
  { value: "greater_than", label: "Greater Than", types: ["number", "date"] },
  { value: "less_than", label: "Less Than", types: ["number", "date"] },
  { value: "in", label: "In List", types: ["text", "select"] },
  { value: "not_in", label: "Not In List", types: ["text", "select"] },
];

export function AudienceTargetingStep({ data, onUpdate }: AudienceTargetingStepProps) {
  const [audienceType, setAudienceType] = useState<"all" | "segment" | "custom">(
    data?.type || "all",
  );
  const [selectedSegments, setSelectedSegments] = useState<string[]>(data?.segmentIds || []);
  const [customFilters, setCustomFilters] = useState<AudienceFilter[]>(data?.customFilters || []);
  const [estimatedSize, setEstimatedSize] = useState<number | undefined>(data?.estimatedSize);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Fetch audience segments
  const { data: segments, isLoading: segmentsLoading } = useQuery({
    queryKey: ["audience-segments"],
    queryFn: campaignApi.getAudienceSegments,
    enabled: audienceType === "segment",
  });

  // Estimate audience size for custom filters
  const { data: sizeEstimate, refetch: refetchEstimate } = useQuery({
    queryKey: ["audience-estimate", customFilters],
    queryFn: () => campaignApi.estimateAudienceSize(customFilters),
    enabled: audienceType === "custom" && customFilters.length > 0,
  });

  useEffect(() => {
    const config: AudienceConfig = {
      type: audienceType,
      ...(audienceType === "segment" && { segmentIds: selectedSegments }),
      ...(audienceType === "custom" && { customFilters }),
      ...(estimatedSize && { estimatedSize }),
    };
    onUpdate(config);
  }, [audienceType, selectedSegments, customFilters, estimatedSize, onUpdate]);

  useEffect(() => {
    if (sizeEstimate) {
      setEstimatedSize(sizeEstimate.size);
    }
  }, [sizeEstimate]);

  const handleAudienceTypeChange = (type: "all" | "segment" | "custom") => {
    setAudienceType(type);
    setSelectedSegments([]);
    setCustomFilters([]);
    setEstimatedSize(undefined);
  };

  const handleSegmentToggle = (segmentId: string) => {
    const newSegments = selectedSegments.includes(segmentId)
      ? selectedSegments.filter((id) => id !== segmentId)
      : [...selectedSegments, segmentId];
    setSelectedSegments(newSegments);
  };

  const addCustomFilter = () => {
    const newFilter: AudienceFilter = {
      field: "email",
      operator: "equals",
      value: "",
    };
    setCustomFilters([...customFilters, newFilter]);
  };

  const updateCustomFilter = (index: number, updates: Partial<AudienceFilter>) => {
    const newFilters = [...customFilters];
    newFilters[index] = { ...newFilters[index], ...updates } as AudienceFilter;
    setCustomFilters(newFilters);
  };

  const removeCustomFilter = (index: number) => {
    setCustomFilters(customFilters.filter((_, i) => i !== index));
  };

  const getAvailableOperators = (fieldType: string) => {
    return OPERATORS.filter((op) => op.types.includes(fieldType));
  };

  const renderFilterValue = (filter: AudienceFilter, index: number) => {
    const field = FILTER_FIELDS.find((f) => f.value === filter.field);

    if (field?.type === "select" && field.options) {
      return (
        <Select
          value={filter.value}
          onValueChange={(value) => updateCustomFilter(index, { value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select value" />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field?.type === "date") {
      return (
        <Input
          type="date"
          value={filter.value}
          onChange={(e) => updateCustomFilter(index, { value: e.target.value })}
        />
      );
    }

    if (field?.type === "number") {
      return (
        <Input
          type="number"
          value={filter.value}
          onChange={(e) => updateCustomFilter(index, { value: e.target.value })}
          placeholder="Enter number"
        />
      );
    }

    return (
      <Input
        value={filter.value}
        onChange={(e) => updateCustomFilter(index, { value: e.target.value })}
        placeholder="Enter value"
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* Audience Type Selection */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Target Audience</Label>
        <div className="grid gap-4">
          {AUDIENCE_TYPES.map((type) => {
            const Icon = type.icon;
            const isSelected = audienceType === type.value;

            return (
              <Card
                key={type.value}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isSelected
                    ? "ring-2 ring-primary border-primary bg-primary/5"
                    : "hover:border-primary/50"
                }`}
                onClick={() => handleAudienceTypeChange(type.value)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{type.label}</CardTitle>
                      <CardDescription>{type.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Segment Selection */}
      {audienceType === "segment" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Select Segments</Label>
            <Button variant="outline" size="sm">
              <PlusIcon className="w-4 h-4 mr-2" />
              Create Segment
            </Button>
          </div>

          {segmentsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading segments...</div>
          ) : segments && segments.length > 0 ? (
            <div className="grid gap-3">
              {segments.map((segment) => (
                <Card
                  key={segment.id}
                  className={`cursor-pointer transition-all ${
                    selectedSegments.includes(segment.id)
                      ? "ring-2 ring-primary border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => handleSegmentToggle(segment.id)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{segment.name}</h4>
                        {segment.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {segment.description}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline">{segment.size.toLocaleString()} users</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="pt-6 text-center">
                <CursorArrowRaysIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No segments found</p>
                <Button variant="outline" size="sm" className="mt-2">
                  Create Your First Segment
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Custom Filters */}
      {audienceType === "custom" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Custom Filters</Label>
            <Button onClick={addCustomFilter} size="sm">
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Filter
            </Button>
          </div>

          {customFilters.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="pt-6 text-center">
                <FunnelIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No filters added</p>
                <p className="text-sm text-muted-foreground">
                  Add filters to target specific users
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {customFilters.map((filter, index) => {
                const field = FILTER_FIELDS.find((f) => f.value === filter.field);
                const availableOperators = getAvailableOperators(field?.type || "text");

                return (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        <div className="space-y-2">
                          <Label className="text-xs">Field</Label>
                          <Select
                            value={filter.field}
                            onValueChange={(value) =>
                              updateCustomFilter(index, {
                                field: value,
                                operator: "equals",
                                value: "",
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FILTER_FIELDS.map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Operator</Label>
                          <Select
                            value={filter.operator}
                            onValueChange={(value) =>
                              updateCustomFilter(index, {
                                operator: value as any,
                                value: "",
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableOperators.map((op) => (
                                <SelectItem key={op.value} value={op.value}>
                                  {op.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Value</Label>
                          {renderFilterValue(filter, index)}
                        </div>

                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => removeCustomFilter(index)}
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Audience Size Estimate */}
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

      {/* Advanced Options */}
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
