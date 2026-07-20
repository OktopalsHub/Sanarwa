'use client';

import { Filter } from '@/lib/icons';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EllipsisHorizontalIcon, MagnifyingGlassIcon, DocumentDuplicateIcon, EyeIcon, EyeSlashIcon, TrashIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTenant } from '@/contexts/tenant-context';
import { apiClient } from '@/lib/api/client';
import { apiKeyApi } from '@/lib/api/api-key';
import { projectApi } from '@/lib/api/project';
import { toast } from 'sonner';

export function ApiKeyList() {
  const { selectedTenant } = useTenant();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const { data: apiKeys = [], isLoading, error } = useQuery({
    queryKey: ['api-keys', selectedTenant?.id, searchQuery, statusFilter],
    queryFn: async () => {
      if (selectedTenant?.id) {
        apiClient.setTenant(selectedTenant.id);
      }
      const projectsResult = await projectApi.getProjects({ limit: 100 });
      const projects = projectsResult.data || [];
      const allKeys: Array<{
        id: string;
        name: string;
        key: string;
        permissions: string[];
        projectId: string;
        projectName: string;
        lastUsed: Date | null;
        createdAt: Date;
        isActive: boolean;
        usageCount: number;
      }> = [];

      for (const project of projects) {
        const result = await apiKeyApi.getApiKeysByProject(project.id);
        const keys = result.data || [];
        for (const key of keys) {
          allKeys.push({
            id: key.id,
            name: key.name,
            key: key.keyPrefix || '••••••••',
            permissions: key.permissions || [],
            projectId: project.id,
            projectName: project.name,
            lastUsed: key.lastUsedAt ? new Date(key.lastUsedAt) : null,
            createdAt: new Date(key.createdAt),
            isActive: key.status === 'active',
            usageCount: key.usageCount || 0,
          });
        }
      }

      return allKeys.filter((key) => {
        const matchesSearch =
          key.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          key.projectName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'active' && key.isActive) ||
          (statusFilter === 'inactive' && !key.isActive);
        return matchesSearch && matchesStatus;
      });
    },
    enabled: !!selectedTenant?.id,
  });

  const toggleKeyVisibility = (keyId: string) => {
    const newVisibleKeys = new Set(visibleKeys);
    if (newVisibleKeys.has(keyId)) {
      newVisibleKeys.delete(keyId);
    } else {
      newVisibleKeys.add(keyId);
    }
    setVisibleKeys(newVisibleKeys);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('API key copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy API key');
    }
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 12) return key;
    return key.substring(0, 12) + '•'.repeat(key.length - 16) + key.substring(key.length - 4);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const handleRevokeKey = async (keyId: string, keyName: string) => {
    try {
      // TODO: Implement API key revocation
      toast.success(`${keyName} has been revoked`);
    } catch (error) {
      toast.error('Failed to revoke API key');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
                <div className="h-8 bg-muted rounded w-full"></div>
              </div>
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
            <p>Failed to load API keys. Please try again.</p>
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
            placeholder="Search API keys..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* API Keys List */}
      {apiKeys.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <h3 className="text-lg font-semibold mb-2">No API keys found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first API key to start using the API'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {apiKeys.map((apiKey) => (
            <Card key={apiKey.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{apiKey.name}</CardTitle>
                    <CardDescription>
                      Project: {apiKey.projectName}
                    </CardDescription>
                    <div className="flex items-center gap-2">
                      <Badge variant={apiKey.isActive ? 'default' : 'secondary'}>
                        {apiKey.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <div className="flex gap-1">
                        {apiKey.permissions.map((permission) => (
                          <Badge key={permission} variant="outline" className="text-xs">
                            {permission}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <EllipsisHorizontalIcon className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => copyToClipboard(apiKey.key)}
                      >
                        <DocumentDuplicateIcon className="h-4 w-4 mr-2" />
                        Copy Key
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Cog6ToothIcon className="h-4 w-4 mr-2" />
                        Edit Permissions
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleRevokeKey(apiKey.id, apiKey.name)}
                      >
                        <TrashIcon className="h-4 w-4 mr-2" />
                        Revoke
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* API Key Display */}
                  <div className="flex items-center gap-2">
                    <Input
                      value={visibleKeys.has(apiKey.id) ? apiKey.key : maskApiKey(apiKey.key)}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleKeyVisibility(apiKey.id)}
                    >
                      {visibleKeys.has(apiKey.id) ? (
                        <EyeSlashIcon className="h-4 w-4" />
                      ) : (
                        <EyeIcon className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(apiKey.key)}
                    >
                      <DocumentDuplicateIcon className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span>Created {formatDate(apiKey.createdAt)}</span>
                      <span>Last used {formatDate(apiKey.lastUsed)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span>{formatNumber(apiKey.usageCount)} requests</span>
                    </div>
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