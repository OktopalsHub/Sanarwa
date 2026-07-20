'use client';

import { TeamManagement } from '@/components/tenant/team-management';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenant } from '@/contexts/tenant-context';
import { ArrowPathIcon } from '@heroicons/react/24/outline'


export default function TeamManagementPage() {
  const { currentTenant, isLoading } = useTenant();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <ArrowPathIcon className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!currentTenant) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Tenant Selected</CardTitle>
          <CardDescription>
            Please select a tenant to manage team members.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
        <p className="text-muted-foreground">
          Manage team members, roles, and permissions for your organization.
        </p>
      </div>

      <TeamManagement tenant={currentTenant} />
    </div>
  );
}