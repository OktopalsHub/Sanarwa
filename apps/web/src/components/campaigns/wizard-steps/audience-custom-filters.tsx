"use client";

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
import type { AudienceFilter } from "@/lib/types/campaign";
import { FunnelIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { FILTER_FIELDS, getAvailableOperators } from "./audience-targeting.constants";

type AudienceCustomFiltersProps = {
  customFilters: AudienceFilter[];
  onAdd: () => void;
  onUpdate: (index: number, updates: Partial<AudienceFilter>) => void;
  onRemove: (index: number) => void;
};

function renderFilterValue(
  filter: AudienceFilter,
  index: number,
  onUpdate: AudienceCustomFiltersProps["onUpdate"],
) {
  const field = FILTER_FIELDS.find((f) => f.value === filter.field);

  if (field?.type === "select" && field.options) {
    return (
      <Select value={filter.value} onValueChange={(value) => onUpdate(index, { value })}>
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
        onChange={(e) => onUpdate(index, { value: e.target.value })}
      />
    );
  }

  if (field?.type === "number") {
    return (
      <Input
        type="number"
        value={filter.value}
        onChange={(e) => onUpdate(index, { value: e.target.value })}
        placeholder="Enter number"
      />
    );
  }

  return (
    <Input
      value={filter.value}
      onChange={(e) => onUpdate(index, { value: e.target.value })}
      placeholder="Enter value"
    />
  );
}

export function AudienceCustomFilters({
  customFilters,
  onAdd,
  onUpdate,
  onRemove,
}: AudienceCustomFiltersProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Custom Filters</Label>
        <Button onClick={onAdd} size="sm">
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Filter
        </Button>
      </div>

      {customFilters.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center">
            <FunnelIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No filters added</p>
            <p className="text-sm text-muted-foreground">Add filters to target specific users</p>
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
                          onUpdate(index, {
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
                          {FILTER_FIELDS.map((fieldOption) => (
                            <SelectItem key={fieldOption.value} value={fieldOption.value}>
                              {fieldOption.label}
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
                          onUpdate(index, {
                            operator: value as AudienceFilter["operator"],
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
                      {renderFilterValue(filter, index, onUpdate)}
                    </div>

                    <Button variant="outline" size="icon" onClick={() => onRemove(index)}>
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
  );
}
