'use client';

import { Send, Shield, User, UserX } from '@/lib/icons';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTenant } from '@/contexts/tenant-context';
import { InviteMemberRequest, Tenant, TenantMemberRole } from '@/lib/types/tenant';
import { zodResolver } from '@hookform/resolvers/zod';
import { EnvelopeIcon, PaperAirplaneIcon, ShieldCheckIcon, UserIcon, UserMinusIcon } from '@heroicons/react/24/outline'
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const inviteMemberSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.nativeEnum(TenantMemberRole),
  message: z.string().optional(),
});

type InviteMemberForm = z.infer<typeof inviteMemberSchema>;

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant;
  maxMembers: number;
  currentMemberCount: number;
}

const roleOptions = [
  {
    value: TenantMemberRole.ADMIN,
    label: 'Admin',
    icon: Shield,
    description: 'Manage members, settings, and all features',
  },
  {
    value: TenantMemberRole.MEMBER,
    label: 'Member',
    icon: User,
    description: 'Create and edit campaigns',
  },
  {
    value: TenantMemberRole.VIEWER,
    label: 'Viewer',
    icon: UserX,
    description: 'View-only access',
  },
];

export function InviteMemberDialog({
  open,
  onOpenChange,
  tenant,
  maxMembers,
  currentMemberCount,
}: InviteMemberDialogProps) {
  const { inviteMember, isLoading } = useTenant();

  const form = useForm({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: {
      email: '',
      role: TenantMemberRole.MEMBER,
      message: '',
    },
  });

  const handleSubmit = async (data: InviteMemberForm) => {
    if (currentMemberCount >= maxMembers) {
      toast.error('Maximum member limit reached');
      return;
    }

    try {
      const inviteData: InviteMemberRequest = {
        email: data.email,
        role: data.role,
        message: data.message,
      };

      await inviteMember(inviteData);
      toast.success(`Invitation sent to ${data.email}`);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to send invitation');
      console.error('Invite error:', error);
    }
  };

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  const remainingSlots = maxMembers - currentMemberCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EnvelopeIcon className="h-5 w-5" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Send an invitation to join {tenant.name} as a team member.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@company.com"
              {...form.register('email')}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Controller
              name="role"
              control={form.control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => {
                      const RoleIcon = role.icon;
                      return (
                        <SelectItem key={role.value} value={role.value}>
                          <div className="flex items-center gap-2">
                            <RoleIcon className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{role.label}</div>
                              <div className="text-xs text-muted-foreground">
                                {role.description}
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.role && (
              <p className="text-sm text-destructive">
                {form.formState.errors.role.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Personal Message (Optional)</Label>
            <Textarea
              id="message"
              placeholder="Add a personal message to the invitation..."
              rows={3}
              {...form.register('message')}
            />
            <p className="text-xs text-muted-foreground">
              This message will be included in the invitation email.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Available slots:</span>
              <span className="font-medium">
                {remainingSlots} of {maxMembers}
              </span>
            </div>
            {remainingSlots <= 3 && remainingSlots > 0 && (
              <p className="text-xs text-amber-600 mt-1">
                You're approaching your member limit. Consider upgrading your plan.
              </p>
            )}
            {remainingSlots === 0 && (
              <p className="text-xs text-destructive mt-1">
                Member limit reached. Upgrade your plan to invite more members.
              </p>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || remainingSlots === 0}
              className="w-full sm:w-auto"
            >
              <PaperAirplaneIcon className="mr-2 h-4 w-4" />
              {isLoading ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}