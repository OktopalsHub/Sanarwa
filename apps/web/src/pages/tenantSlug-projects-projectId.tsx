"use client";

import { ProjectDetails } from "@/components/projects/project-details";
import { AppShell } from "@/components/layout";
import { useRouter } from "@/compat/next-navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/button";

import { useTenantSlug } from "@/hooks/use-tenant-slug";
import { useParams } from "@tanstack/react-router";

export default function ProjectDetailPage() {
  const router = useRouter();
  const tenantSlug = useTenantSlug();
  const { projectId } = useParams({ strict: false }) as { projectId?: string };

  return (
    <AppShell>
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/${tenantSlug}/projects`)}
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </div>

          <ProjectDetails projectId={projectId || ""} />
        </div>
      </div>
    </AppShell>
  );
}
