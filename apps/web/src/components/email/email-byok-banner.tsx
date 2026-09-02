"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "@/compat/next-link";
import { useTenant } from "@/contexts/tenant-context";

export function EmailBYOKBanner({ tenantId, providerName = "AWS SES" }: { tenantId?: string; providerName?: string }) {
  const { selectedTenant } = useTenant();
  const tid = tenantId || selectedTenant?.id;
  const slug = selectedTenant?.slug || tid;
  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
          BYOK Active <Badge variant="outline" className="border-amber-300">{providerName} (your credentials)</Badge>
        </CardTitle>
        <CardDescription>Managed Cloudflare auto-DNS hidden - you manage TXT/CNAME in your AWS/Cloudflare. Domain verification via your provider.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" size="sm">
          <Link href={`/${slug}/providers`}>Manage provider</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
