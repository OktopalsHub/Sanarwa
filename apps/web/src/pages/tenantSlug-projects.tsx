"use client";

import { ProjectList } from "@/components/projects/project-list";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@heroicons/react/24/outline";

import { useState } from "react";

export default function ProjectsPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <AppShell>
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
              <p className="text-muted-foreground">
                Manage your notification projects and their configurations
              </p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </div>

          <ProjectList />

          <CreateProjectDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
        </div>
      </div>
    </AppShell>
  );
}
