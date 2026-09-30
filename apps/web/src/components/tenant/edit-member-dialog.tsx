"use client";

import { Shield, ShieldCheck, User, UserCheck, UserX } from "@/lib/icons";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tenant, TenantMember, TenantRole } from "@/lib/types/tenant";
import {
  BookmarkIcon,
  ShieldCheckIcon,
  UserIcon,
  UserMinusIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

interface EditMemberDialogProps {
  member: TenantMember;
  tenant: Tenant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRoleChange: (memberId: string, newRole: TenantRole) => Promise<void>;
}

const roleOptions = [
  {
    value: "owner" as const,
    label: "Owner",
    icon: ShieldCheck,
    description: "Full access to all features and settings",
    disabled: true, // Can't assign owner role
  },
  {
    value: "admin" as const,
    label: "Admin",
    icon: Shield,
    description: "Manage members, settings, and all features",
  },
  {
    value: "manager" as const,
    label: "Manager",
    icon: UserCheck,
    description: "Manage campaigns and workflows",
  },
  {
    value: "member" as const,
    label: "Member",
    icon: User,
    description: "Create and edit campaigns",
  },
  {
    value: "viewer" as const,
    label: "Viewer",
    icon: UserX,
    description: "View-only access",
  },
];

export function EditMemberDialog({
  member,
  tenant,
  open,
  onOpenChange,
  onRoleChange,
}: EditMemberDialogProps) {
  const [selectedRole, setSelectedRole] = useState<TenantRole>(member.role);
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (selectedRole === member.role) {
      onOpenChange(false);
      return;
    }

    setIsLoading(true);
    try {
      await onRoleChange(member.id, selectedRole);
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the parent component
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedRole(member.role);
    onOpenChange(false);
  };

  const hasChanges = selectedRole !== member.role;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Member Role</DialogTitle>
          <DialogDescription>
            Change the role and permissions for {member.userId}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={selectedRole}
              onValueChange={(value) => setSelectedRole(value as TenantRole)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((role) => {
                  const RoleIcon = role.icon;
                  const isDisabled =
                    role.disabled || (role.value === "owner" && member.role !== "owner");

                  return (
                    <SelectItem key={role.value} value={role.value} disabled={isDisabled}>
                      <div className="flex items-center gap-2">
                        <RoleIcon className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{role.label}</div>
                          <div className="text-xs text-muted-foreground">{role.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-muted/50 rounded-lg p-3">
            <h4 className="font-medium text-sm mb-2">Role Permissions</h4>
            <div className="text-xs text-muted-foreground space-y-1">
              {selectedRole === "admin" && (
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Manage team members and roles</li>
                  <li>Access all campaigns and workflows</li>
                  <li>Modify organization settings</li>
                  <li>Access billing and subscription</li>
                </ul>
              )}
              {selectedRole === "admin" && (
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Create and manage campaigns</li>
                  <li>Build and edit workflows</li>
                  <li>Access analytics and reports</li>
                  <li>Manage templates and branding</li>
                </ul>
              )}
              {selectedRole === "member" && (
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Create and edit own campaigns</li>
                  <li>Use existing templates</li>
                  <li>View basic analytics</li>
                  <li>Collaborate on shared projects</li>
                </ul>
              )}
              {selectedRole === "viewer" && (
                <ul className="list-disc list-inside space-y-0.5">
                  <li>View campaigns and workflows</li>
                  <li>Access read-only analytics</li>
                  <li>Browse template library</li>
                  <li>No editing permissions</li>
                </ul>
              )}
            </div>
          </div>

          {member.role === "owner" && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> This member is the organization owner. To change their role,
                ownership must first be transferred to another member.
              </p>
            </div>
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
            onClick={handleSave}
            disabled={isLoading || !hasChanges || member.role === "owner"}
            className="w-full sm:w-auto"
          >
            <BookmarkIcon className="mr-2 h-4 w-4" />
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
