"use client";

import { Filter } from "@/lib/icons";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/contexts/tenant-context";
import { Tenant } from "@/lib/types/tenant";
import { PlusIcon, UsersIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { InviteMemberDialog } from "./invite-member-dialog";
import { MemberInvitations } from "./member-invitations";
import { MemberList } from "./member-list";

interface TeamManagementProps {
  tenant: Tenant;
}

export function TeamManagement({ tenant }: TeamManagementProps) {
  const { memberships, invitations } = useTenant();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // Filter memberships for current tenant
  const tenantMembers = memberships.filter((member) => member.tenantId === tenant.id);
  const activeMembers = tenantMembers.filter((member) => member.status === "active");
  const pendingInvitations = invitations.filter((invitation) => invitation.tenantId === tenant.id);

  return (
    <div className="space-y-6">
      {/* Team Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeMembers.length}</div>
            <p className="text-xs text-muted-foreground">
              {(tenant.settings?.maxMembers || 10) - activeMembers.length} slots remaining
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Invitations</CardTitle>
            <PlusIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingInvitations.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting acceptance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">Owner, Admin, Manager, Member, Viewer</p>
          </CardContent>
        </Card>
      </div>

      {/* Team Management Tabs */}
      <Tabs defaultValue="members" className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="members">Members ({activeMembers.length})</TabsTrigger>
            <TabsTrigger value="invitations">Invitations ({pendingInvitations.length})</TabsTrigger>
          </TabsList>

          <Button
            onClick={() => setInviteDialogOpen(true)}
            disabled={activeMembers.length >= (tenant.settings?.maxMembers || 10)}
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        </div>

        <TabsContent value="members" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Manage roles and permissions for your team members.</CardDescription>
            </CardHeader>
            <CardContent>
              <MemberList members={activeMembers} tenant={tenant} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>
                Manage pending member invitations and resend if needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MemberInvitations invitations={pendingInvitations} tenant={tenant} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite Member Dialog */}
      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        tenant={tenant}
        maxMembers={tenant.settings?.maxMembers || 10}
        currentMemberCount={activeMembers.length}
      />
    </div>
  );
}
