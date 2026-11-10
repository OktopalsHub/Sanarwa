"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@sanarwa/ui/card";
import { Button } from "@sanarwa/ui/button";
import { useTenantBasePath } from "@/hooks/use-tenant-slug";
import Link from "@/compat/next-link";

export function ProjectWebhooks({ projectId: _projectId }: { projectId: string }) {
  const basePath = useTenantBasePath();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhooks</CardTitle>
        <CardDescription>
          Delivery events are configured for the whole workspace, not per project.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href={`${basePath}/webhooks`}>Open webhooks</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
