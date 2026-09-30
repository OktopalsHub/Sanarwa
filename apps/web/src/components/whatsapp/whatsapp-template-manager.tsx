"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTemplateCapacity, useWABAStatus } from "@/lib/query/hooks/use-whatsapp-queries";
import { useTenant } from "@/contexts/tenant-context";
import { ExclamationTriangleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

export function WhatsAppTemplateManager() {
  const { selectedTenant } = useTenant();
  const tenantId = selectedTenant?.id;
  const { data: capacity, isLoading } = useTemplateCapacity(tenantId);
  const { data: waba } = useWABAStatus(tenantId);

  if (isLoading) return <Card className="animate-pulse"><CardHeader><div className="h-4 bg-muted rounded w-1/4" /></CardHeader></Card>;
  if (!waba?.hasWaba) return <Card><CardContent className="pt-6 text-sm text-muted-foreground">Connect WABA first to manage templates.</CardContent></Card>;

  const usage = capacity?.templateUsage || waba.templateUsage;
  const canCreate = capacity?.canCreateTemplate ?? true;
  const rate = usage?.utilizationRate || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Templates <Badge variant={rate > 80 ? "destructive" : "secondary"}>{usage?.used}/{usage?.limit}</Badge></CardTitle>
        <CardDescription>Meta review ~10min. 24h window for unsolicited templates.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={rate} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground"><span>{usage?.remaining} remaining</span><span>{Math.round(rate)}% used</span></div>
        {!canCreate && <div className="flex gap-2 text-amber-600 text-sm"><ExclamationTriangleIcon className="h-4 w-4" />Limit reached - archive unused or create additional WABA.</div>}
        {canCreate && <div className="flex gap-2 text-green-600 text-sm"><CheckCircleIcon className="h-4 w-4" />Can create templates.</div>}
        {capacity?.recommendation && <p className="text-xs text-muted-foreground">{capacity.recommendation}</p>}
        <Button variant="outline" size="sm" onClick={() => window.open("https://business.facebook.com/wa/manage/message-templates/", "_blank")}>Manage in Meta Business</Button>
      </CardContent>
    </Card>
  );
}
