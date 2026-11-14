"use client";

import { AddProviderDialog } from "@/components/providers/add-provider-dialog";
import { ProviderList } from "@/components/providers/provider-list";
import { AppShell, PageContainer, PageHeader } from "@/components/layout";
import { ProjectScopeProvider, useProjectScope } from "@/contexts/project-scope-context";
import { useTenantBasePath } from "@/hooks/use-tenant-slug";
import Link from "@/compat/next-link";
import { Button } from "@sanarwa/ui/button";
import { Card } from "@sanarwa/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@sanarwa/ui/select";
import { useState } from "react";

function ProvidersContent() {
  const { projects, projectId, selectProject, isLoading } = useProjectScope();
  const basePath = useTenantBasePath();
  const [adding, setAdding] = useState(false);

  return (
    <PageContainer>
      <PageHeader
        title="Email, SMS & push"
        description="Connect your own provider accounts. Sanarwa sends through them and fails over if one is down."
        actions={
          <>
            {projects.length > 1 ? (
              <Select value={projectId} onValueChange={selectProject}>
                <SelectTrigger className="w-44" aria-label="Project">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button onClick={() => setAdding(true)} disabled={!projectId}>
              Connect provider
            </Button>
          </>
        }
      />

      {projectId ? (
        <>
          <ProviderList projectId={projectId} />
          <AddProviderDialog projectId={projectId} open={adding} onOpenChange={setAdding} />
        </>
      ) : isLoading ? null : (
        <Card className="items-center gap-3 p-10 text-center">
          <p className="font-medium">Create a project first</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Providers and API keys live inside a project.
          </p>
          <Button asChild>
            <Link href={`${basePath}/projects`}>Go to projects</Link>
          </Button>
        </Card>
      )}
    </PageContainer>
  );
}

export default function ProvidersPage() {
  return (
    <AppShell>
      <ProjectScopeProvider>
        <ProvidersContent />
      </ProjectScopeProvider>
    </AppShell>
  );
}
