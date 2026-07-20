'use client';

import { Shield, ShieldCheck, User, UserX } from '@/lib/icons';

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
import { useTenant } from '@/contexts/tenant-context';
import { tenantApi } from '@/lib/api/tenant';
import { Invitation, Tenant, TenantMemberRole } from '@/lib/types/tenant';
import { ClockIcon, EnvelopeIcon, EllipsisHorizontalIcon, ArrowPathIcon, ShieldCheckIcon, UserIcon, XMarkIcon, UserMinusIcon } from '@heroicons/react/24/outline'
import { useState } from 'react';
import { toast } from 'sonner';

interface MemberInvitationsProps {
  invitations: Invitation[];
  tenant: Tenant;
}

const roleConfig: Partial<Record<TenantMemberRole, {
  label: string;
  icon: any;
  color: string;
}>> = {
  [TenantMemberRole.OWNER]: {
    label: 'Owner',
    icon: ShieldCheck,
    color: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
  },
  [TenantMemberRole.ADMIN]: {
    label: 'Admin',
    icon: Shield,
    color: 'bg-red-100 text-red-800 hover:bg-red-200',
  },
  [TenantMemberRole.MEMBER]: {
    label: 'Member',
    icon: User,
    color: 'bg-green-100 text-green-800 hover:bg-green-200',
  },
  [TenantMemberRole.VIEWER]: {
    label: 'Viewer',
    icon: UserX,
    color: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
  },
};

export function MemberInvitations({ invitations, tenant }: MemberInvitationsProps) {
  const { refreshTenants } = useTenant();
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});

  const handleResendInvitation = async (memberId: string, email: string) => {
    setLoadingActions(prev => ({ ...prev, [memberId]: true }));

    try {
      // In a real app, this would call a resend invitation API
      await fetch(`/api/tenants/${tenant.id}/invitations/${memberId}/resend`, {
        method: 'POST',
        credentials: 'include',
      });

      toast.success(`Invitation resent to ${email}`);
    } catch (error) {
      toast.error('Failed to resend invitation');
      console.error('Resend invitation error:', error);
    } finally {
      setLoadingActions(prev => ({ ...prev, [memberId]: false }));
    }
  };

  const handleRevokeInvitation = async (memberId: string, email: string) => {
    if (!confirm(`Are you sure you want to revoke the invitation for ${email}?`)) {
      return;
    }

    setLoadingActions(prev => ({ ...prev, [memberId]: true }));

    try {
      // In a real app, this would call the revoke invitation API
      await tenantApi.cancelInvitation(memberId);
      await refreshTenants();
      toast.success(`Invitation revoked for ${email}`);
    } catch (error) {
      toast.error('Failed to revoke invitation');
      console.error('Revoke invitation error:', error);
    } finally {
      setLoadingActions(prev => ({ ...prev, [memberId]: false }));
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  const isExpiringSoon = (dateString: string) => {
    const inviteDate = new Date(dateString);
    const expiryDate = new Date(inviteDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from invite
    const now = new Date();
    const hoursUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60));

    return hoursUntilExpiry < 24 && hoursUntilExpiry > 0;
  };

  if (invitations.length === 0) {
    return (
      <div className="text-center py-8">
        <EnvelopeIcon className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900">No pending invitations</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          All team member invitations have been accepted or expired.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Invited</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invitations.map((invitation) => {
          const roleInfo = roleConfig[invitation.role];
          const RoleIcon = roleInfo?.icon;
          const isLoading = loadingActions[invitation.id];
          const expiringSoon = isExpiringSoon(invitation.createdAt?.toISOString() || new Date().toISOString());

          return (
            <TableRow key={invitation.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <EnvelopeIcon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{invitation.email}</div>
                    <div className="text-sm text-muted-foreground">
                      Invitation pending
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {roleInfo && (
                  <Badge variant="secondary" className={roleInfo.color}>
                    {RoleIcon && <RoleIcon className="mr-1 h-3 w-3" />}
                    {roleInfo.label}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {getTimeAgo(invitation.createdAt?.toISOString() || new Date().toISOString())}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={
                      expiringSoon
                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                    }
                  >
                    <ClockIcon className="mr-1 h-3 w-3" />
                    {expiringSoon ? 'Expiring Soon' : 'Pending'}
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={isLoading}
                    >
                      <EllipsisHorizontalIcon className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => handleResendInvitation(invitation.id, invitation.email)}
                      disabled={isLoading}
                    >
                      <ArrowPathIcon className="mr-2 h-4 w-4" />
                      Resend Invitation
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleRevokeInvitation(invitation.id, invitation.email)}
                      className="text-destructive"
                      disabled={isLoading}
                    >
                      <XMarkIcon className="mr-2 h-4 w-4" />
                      Revoke Invitation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}