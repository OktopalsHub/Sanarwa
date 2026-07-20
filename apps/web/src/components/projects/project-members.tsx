'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { PlusIcon, MagnifyingGlassIcon, EllipsisHorizontalIcon, UserMinusIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useTenant } from '@/contexts/tenant-context';
import { tenantApi } from '@/lib/api/tenant';
import { apiClient } from '@/lib/api/client';

interface ProjectMembersProps {
  projectId: string;
}

export function ProjectMembers({ projectId: _projectId }: ProjectMembersProps) {
  const { selectedTenant } = useTenant();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['project-members', selectedTenant?.id, searchQuery],
    queryFn: async () => {
      if (!selectedTenant?.id) return [];
      apiClient.setTenant(selectedTenant.id);
      const tenantMembers = await tenantApi.getTenantMembers(selectedTenant.id);
      return tenantMembers
        .filter((member) => {
          const name = member.user?.name || '';
          const email = member.user?.email || '';
          const q = searchQuery.toLowerCase();
          return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
        })
        .map((member) => ({
          id: member.id,
          user: {
            id: member.user.id,
            name: member.user.name,
            email: member.user.email,
            avatar: member.user.image || null,
          },
          role: member.role.toLowerCase(),
          permissions: [],
          joinedAt: new Date(member.createdAt || Date.now()),
          lastActive: new Date(member.updatedAt || Date.now()),
        }));
    },
    enabled: !!selectedTenant?.id,
  });

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'developer':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'viewer':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    try {
      // TODO: Implement member removal API call
      toast.success(`${memberName} has been removed from the project`);
    } catch (error) {
      toast.error('Failed to remove member');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <div className="h-10 w-10 bg-muted rounded-full"></div>
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-1/4"></div>
                  <div className="h-3 bg-muted rounded w-1/3"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Project Members</h3>
          <p className="text-sm text-muted-foreground">
            Manage who has access to this project and their permissions
          </p>
        </div>
        <Button>
          <PlusIcon className="h-4 w-4 mr-2" />
          Invite Member
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Members List */}
      {members.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <h4 className="text-lg font-semibold mb-2">No members found</h4>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'Try adjusting your search' : 'Invite members to collaborate on this project'}
              </p>
              {!searchQuery && (
                <Button>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {members.map((member) => (
            <Card key={member.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Avatar>
                      <AvatarImage src={member.user.avatar || undefined} />
                      <AvatarFallback>
                        {getInitials(member.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{member.user.name}</h4>
                        <Badge className={getRoleColor(member.role)}>
                          {member.role}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {member.user.email}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Joined {formatDate(member.joinedAt)}</span>
                        <span>Last active {formatDate(member.lastActive)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {member.permissions.map((permission) => (
                        <Badge key={permission} variant="outline" className="text-xs">
                          {permission}
                        </Badge>
                      ))}
                    </div>

                    {member.role !== 'owner' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <EllipsisHorizontalIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Cog6ToothIcon className="h-4 w-4 mr-2" />
                            Edit Permissions
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleRemoveMember(member.id, member.user.name)}
                          >
                            <UserMinusIcon className="h-4 w-4 mr-2" />
                            Remove Member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
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