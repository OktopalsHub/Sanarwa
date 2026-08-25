"use client";

import { Filter } from "@/lib/icons";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { providerApi } from "@/lib/api/provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EllipsisHorizontalIcon,
  MagnifyingGlassIcon,
  Cog6ToothIcon,
  TrashIcon,
  PlayIcon,
  PauseIcon,
  StarIcon,
  BeakerIcon,
} from "@heroicons/react/24/outline";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProviderType } from "@/lib/types/provider";
import Link from "@/compat/next-link";
import { useTenant } from "@/contexts/tenant-context";
import { toast } from "sonner";

export function ProviderList() {
  const { selectedTenant } = useTenant();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const {
    data: providersData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["providers", selectedTenant?.id, searchQuery, typeFilter],
    queryFn: () =>
      providerApi.getProviders({
        search: searchQuery || undefined,
        type: typeFilter !== "all" ? (typeFilter as ProviderType) : undefined,
        page: 1,
        limit: 20,
      }),
    enabled: !!selectedTenant?.id,
  });

  const providers = providersData?.data || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "inactive":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
      case "testing":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "error":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case "healthy":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "degraded":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "unhealthy":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const handleTestProvider = async (providerId: string, providerName: string) => {
    try {
      toast.loading(`Testing ${providerName}...`);
      await providerApi.testProvider(providerId);
      toast.success(`${providerName} test successful`);
    } catch (error: any) {
      toast.error(`${providerName} test failed: ${error.message}`);
    }
  };

  const handleToggleProvider = async (
    providerId: string,
    providerName: string,
    isActive: boolean,
  ) => {
    try {
      if (isActive) {
        await providerApi.deactivateProvider(providerId);
        toast.success(`${providerName} deactivated`);
      } else {
        await providerApi.activateProvider(providerId);
        toast.success(`${providerName} activated`);
      }
    } catch (error: any) {
      toast.error(`Failed to ${isActive ? "deactivate" : "activate"} ${providerName}`);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-1/4"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-3 bg-muted rounded w-3/4"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <p>Failed to load providers. Please try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search providers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value={ProviderType.EMAIL}>Email</SelectItem>
            <SelectItem value={ProviderType.SMS}>SMS</SelectItem>
            <SelectItem value={ProviderType.PUSH}>Push</SelectItem>
            <SelectItem value={ProviderType.VOICE}>Voice</SelectItem>
            <SelectItem value={ProviderType.WHATSAPP}>WhatsApp</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Provider List */}
      {providers.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <h3 className="text-lg font-semibold mb-2">No providers found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || typeFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Add your first provider to start sending notifications"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {providers.map((provider) => (
            <Card key={provider.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">
                        <Link
                          href={`/${selectedTenant?.slug || selectedTenant?.id}/providers/${provider.id}`}
                          className="hover:underline"
                        >
                          {provider.name}
                        </Link>
                      </CardTitle>
                      {provider.isDefault && (
                        <StarIcon className="h-4 w-4 text-yellow-500 fill-current" />
                      )}
                    </div>
                    <CardDescription>
                      {provider.type} • {provider.subtype}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(provider.status)}>{provider.status}</Badge>
                    <Badge className={getHealthColor(provider.healthStatus)}>
                      {provider.healthStatus}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <EllipsisHorizontalIcon className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/${selectedTenant?.slug || selectedTenant?.id}/providers/${provider.id}`}
                          >
                            <Cog6ToothIcon className="h-4 w-4 mr-2" />
                            Configure
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleTestProvider(provider.id, provider.name)}
                        >
                          <BeakerIcon className="h-4 w-4 mr-2" />
                          Test
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleToggleProvider(
                              provider.id,
                              provider.name,
                              provider.status === "active",
                            )
                          }
                        >
                          {provider.status === "active" ? (
                            <>
                              <PauseIcon className="h-4 w-4 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <PlayIcon className="h-4 w-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <TrashIcon className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span>Created {formatDate(provider.createdAt)}</span>
                    {provider.lastUsed && <span>Last used {formatDate(provider.lastUsed)}</span>}
                  </div>
                  <div className="flex items-center gap-4">
                    <span>Success rate: {(provider.successRate * 100).toFixed(1)}%</span>
                    <span>Priority: {provider.priority}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
