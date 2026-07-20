'use client';

import { Shield, ShieldCheck, User, UserCheck, UserX, Users } from '@/lib/icons';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/auth-context';
import { useTenant } from '@/contexts/tenant-context';
import { Tenant, TenantMember, TenantRole } from '@/lib/types/tenant';
import { EllipsisHorizontalIcon, ShieldCheckIcon, UserIcon, UserMinusIcon } from '@heroicons/react/24/outline'
import { useState } from 'react';
import { toast } from 'sonner';
import { EditMemberDialog } from './edit-member-dialog';

interface MemberListProps {
  members: TenantMember[];
  tenant: Tenant;
}

const roleConfig = {
  owner: {
    label: 'Owner',
    icon: ShieldCheck,
    color: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
    description: 'Full access to all features and settings',
  },
  admin: {
    label: 'Admin',
    icon: Shield,
    color: 'bg-red-100 text-red-800 hover:bg-red-200',
    description: 'Manage members, settings, and all features',
  },
  manager: {
    label: 'Manager',
    icon: UserCheck,
    color: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
    description: 'Manage campaigns and workflows',
  },
  member: {
    label: 'Member',
    icon: User,
    color: 'bg-green-100 text-green-800 hover:bg-green-200',
    description: 'Create and edit campaigns',
  },
  viewer: {
    label: 'Viewer',
    icon: UserX,
    color: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
    description: 'View-only access',
  },
};

export function MemberList({ members, tenant }: MemberListProps) {
  const { user } = useAuth();
  const { updateMember, removeMember, isLoading } = useTenant();
  const [editingMember, setEditingMember] = useState<TenantMember | null>(null);

  const handleRoleChange = async (memberId: string, newRole: TenantRole) => {
    try {
      await updateMember(memberId, { role: newRole });
      toast.success('Member role updated successfully');
    } catch (error) {
      toast.error('Failed to update member role');
      console.error('Role update error:', error);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from the organization?`)) {
      return;
    }

    try {
      await removeMember(memberId);
      toast.success('Member removed successfully');
    } catch (error) {
      toast.error('Failed to remove member');
      console.error('Remove member error:', error);
    }
  };

  const canEditMember = (member: TenantMember) => {
    // Users can't edit themselves or owners
    if (member.userId === user?.id || member.role === 'owner') {
      return false;
    }

    // Only owners and admins can edit members
    const currentUserMembership = members.find(m => m.userId === user?.id);
    return currentUserMembership?.role === 'owner' || currentUserMembership?.role === 'admin';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (members.length === 0) {
    return (
      <div className="text-center py-8">
        <UserIcon className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900">No team members</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Get started by inviting your first team member.
        </p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const roleInfo = roleConfig[member.role];
            const RoleIcon = roleInfo.icon;
            const canEdit = canEditMember(member);

            return (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={`https://avatar.vercel.sh/${member.userId}`} />
                      <AvatarFallback>
                        {getInitials(member.userId || 'Unknown')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {member.userId}
                        {member.userId === user?.id && (
                          <span className="ml-2 text-xs text-muted-foreground">(You)</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {/* In a real app, this would show the user's email */}
                        user@example.com
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={roleInfo.color}>
                    <RoleIcon className="mr-1 h-3 w-3" />
                    {roleInfo.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {member.joinedAt ? (
                      new Date(member.joinedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    ) : (
                      'Pending'
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={member.status === 'active' ? 'default' : 'secondary'}
                    className={
                      member.status === 'active'
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                    }
                  >
                    {member.status === 'active' ? 'Active' : 'Invited'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <EllipsisHorizontalIcon className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => setEditingMember(member)}
                        >
                          Edit Role
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleRemoveMember(member.id, member.userId || '')}
                          className="text-destructive"
                        >
                          Remove Member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Edit Member Dialog */}
      {editingMember && (
        <EditMemberDialog
          member={editingMember}
          tenant={tenant}
          open={!!editingMember}
          onOpenChange={(open) => !open && setEditingMember(null)}
          onRoleChange={handleRoleChange}
        />
      )}
    </>
  );
}