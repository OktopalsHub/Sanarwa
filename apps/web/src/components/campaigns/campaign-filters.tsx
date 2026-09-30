"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconSearch } from "@tabler/icons-react";

interface CampaignFiltersProps {
  searchTerm: string;
  statusFilter: string;
  typeFilter: string;
  sortBy: "name" | "createdAt" | "updatedAt" | "status";
  sortOrder: "asc" | "desc";
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onSortByChange: (value: "name" | "createdAt" | "updatedAt" | "status") => void;
  onSortOrderChange: (value: "asc" | "desc") => void;
}

export function CampaignFilters({
  searchTerm,
  statusFilter,
  typeFilter,
  sortBy,
  sortOrder,
  onSearchChange,
  onStatusChange,
  onTypeChange,
  onSortByChange,
  onSortOrderChange,
}: CampaignFiltersProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="relative flex-1 max-w-sm">
        <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search campaigns..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={onTypeChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="one-time">One-time</SelectItem>
            <SelectItem value="recurring">Recurring</SelectItem>
            <SelectItem value="triggered">Triggered</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sortBy}
          onValueChange={(v) => onSortByChange(v as CampaignFiltersProps["sortBy"])}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updatedAt">Last Updated</SelectItem>
            <SelectItem value="createdAt">Created</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortOrder} onValueChange={(v) => onSortOrderChange(v as "asc" | "desc")}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Descending</SelectItem>
            <SelectItem value="asc">Ascending</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
