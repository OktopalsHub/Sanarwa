"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CursorArrowRaysIcon, PlusIcon } from "@heroicons/react/24/outline";
import { AUDIENCE_TYPES, type AudienceType } from "./audience-targeting.constants";

type AudienceTypeSelectorProps = {
  audienceType: AudienceType;
  onChange: (type: AudienceType) => void;
};

export function AudienceTypeSelector({ audienceType, onChange }: AudienceTypeSelectorProps) {
  return (
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
              onClick={() => onChange(type.value)}
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
  );
}

type AudienceSegmentPickerProps = {
  segments: Array<{ id: string; name: string; description?: string; size: number }> | undefined;
  isLoading: boolean;
  selectedSegments: string[];
  onToggle: (segmentId: string) => void;
};

export function AudienceSegmentPicker({
  segments,
  isLoading,
  selectedSegments,
  onToggle,
}: AudienceSegmentPickerProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Select Segments</Label>
        <Button variant="outline" size="sm">
          <PlusIcon className="w-4 h-4 mr-2" />
          Create Segment
        </Button>
      </div>

      {isLoading ? (
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
              onClick={() => onToggle(segment.id)}
            >
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{segment.name}</h4>
                    {segment.description && (
                      <p className="text-sm text-muted-foreground mt-1">{segment.description}</p>
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
  );
}
