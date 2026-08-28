import { campaignApi } from "@/lib/api/campaigns";
import type { AudienceConfig, AudienceFilter } from "@/lib/types/campaign";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { AudienceType } from "./audience-targeting.constants";

export function useAudienceTargeting(
  data: AudienceConfig | undefined,
  onUpdate: (data: AudienceConfig) => void,
) {
  const [audienceType, setAudienceType] = useState<AudienceType>(data?.type || "all");
  const [selectedSegments, setSelectedSegments] = useState<string[]>(data?.segmentIds || []);
  const [customFilters, setCustomFilters] = useState<AudienceFilter[]>(data?.customFilters || []);
  const [estimatedSize, setEstimatedSize] = useState<number | undefined>(data?.estimatedSize);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data: segments, isLoading: segmentsLoading } = useQuery({
    queryKey: ["audience-segments"],
    queryFn: campaignApi.getAudienceSegments,
    enabled: audienceType === "segment",
  });

  const { data: sizeEstimate } = useQuery({
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

  const handleAudienceTypeChange = (type: AudienceType) => {
    setAudienceType(type);
    setSelectedSegments([]);
    setCustomFilters([]);
    setEstimatedSize(undefined);
  };

  const handleSegmentToggle = (segmentId: string) => {
    setSelectedSegments((current) =>
      current.includes(segmentId)
        ? current.filter((id) => id !== segmentId)
        : [...current, segmentId],
    );
  };

  const addCustomFilter = () => {
    setCustomFilters((current) => [
      ...current,
      { field: "email", operator: "equals", value: "" },
    ]);
  };

  const updateCustomFilter = (index: number, updates: Partial<AudienceFilter>) => {
    setCustomFilters((current) => {
      const next = [...current];
      next[index] = { ...next[index], ...updates } as AudienceFilter;
      return next;
    });
  };

  const removeCustomFilter = (index: number) => {
    setCustomFilters((current) => current.filter((_, i) => i !== index));
  };

  return {
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
  };
}
