'use client';

import { ProviderList } from '@/components/providers/provider-list';
import { CreateProviderDialog } from '@/components/providers/create-provider-dialog';
import { AppShell } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { PlusIcon } from '@heroicons/react/24/outline'

import { useState } from 'react';

export default function ProvidersPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <AppShell>
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Providers</h1>
              <p className="text-muted-foreground">
                Configure and manage your notification service providers
              </p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Provider
            </Button>
          </div>

          <ProviderList />

          <CreateProviderDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
          />
        </div>
      </div>
    </AppShell>
  );
}