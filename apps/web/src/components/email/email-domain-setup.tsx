"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBrands, useIsBYOK, useSESCapability, useSESDomainInstructions, useSetupSESDKIM, useVerifyDMARC, useVerifyDomain, useVerifySESDomain } from "@/lib/query/hooks/use-email-setup";
import { useTenant } from "@/contexts/tenant-context";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircleIcon, ExclamationTriangleIcon, ClipboardDocumentIcon } from "@heroicons/react/24/outline";

export function EmailDomainSetup() {
  const { selectedTenant } = useTenant();
  const tenantId = selectedTenant?.id;
  const { data: brandsData } = useBrands(tenantId);
  const brands = (brandsData as any)?.data || (brandsData as any) || [];
  const brand = brands?.[0];
  const brandId = brand?.id;
  const { data: byokData } = useIsBYOK(tenantId);
  const isBYOK = !!byokData?.isBYOK;
  const cloudflareAvailable = !isBYOK;

  const { data: sesInfo } = useSESDomainInstructions(tenantId, brandId);
  const { data: capability, refetch: refetchCap } = useSESCapability(tenantId, brandId);

  const verifyDomain = useVerifyDomain(tenantId, brandId);
  const verifySES = useVerifySESDomain(tenantId, brandId);
  const setupDKIM = useSetupSESDKIM(tenantId, brandId);
  const verifyDMARC = useVerifyDMARC(tenantId, brandId);

  const [domain, setDomain] = useState(brand?.domain || "");
  const [cfToken, setCfToken] = useState("");

  const progress = (() => {
    let p = 0;
    if (brand?.whiteLabelConfig?.domains?.verified) p += 25;
    if (sesInfo?.sesStatus?.configured && brand?.whiteLabelConfig?.domains?.sesVerified) p += 25;
    if (capability?.dkimStatus?.enabled) p += 25;
    if (capability?.canSend) p += 25;
    return p;
  })();

  const copy = (v: string) => { navigator.clipboard.writeText(v); toast.success("Copied"); };

  if (!brandId) return <Card><CardContent className="pt-6 text-sm text-muted-foreground">Create a Brand first (Settings → Branding) with domain like acme.com, then return here.</CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Email Domain <Badge variant={isBYOK ? "outline" : "secondary"}>{isBYOK ? "BYOK" : "Managed"}</Badge> <Badge variant={progress === 100 ? "default" : "secondary"}>{progress}%</Badge></CardTitle>
        <CardDescription>Managed: Cloudflare auto TXT/CNAME (one-click) • BYOK: manual DNS in your AWS. Minimal 250 burst.</CardDescription>
        <Progress value={progress} className="h-2" />
      </CardHeader>
      <CardContent>
        {isBYOK && <div className="mb-4 rounded-md bg-amber-50 p-3 text-xs text-amber-800">BYOK active - Cloudflare auto hidden. Manage TXT/CNAME in your AWS SES / Cloudflare.</div>}
        <Tabs defaultValue="domain" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="domain">Domain</TabsTrigger>
            <TabsTrigger value="ses">SES</TabsTrigger>
            <TabsTrigger value="dkim">DKIM/DMARC</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
          </TabsList>

          <TabsContent value="domain" className="space-y-3 pt-4">
            <Label>Domain</Label><Input value={domain} onChange={(e)=>setDomain(e.target.value)} placeholder="acme.com" />
            {!isBYOK && <><Label>Cloudflare API Token (optional, auto-add TXT)</Label><Input value={cfToken} onChange={(e)=>setCfToken(e.target.value)} placeholder="cf_..." /></>}
            <div className="flex gap-2"><Button onClick={()=> verifyDomain.mutate({domain, cloudflareApiToken: cloudflareAvailable ? cfToken : undefined}, {onSuccess:()=>toast.success("Domain verified"), onError:(e:any)=>toast.error(e.message)})} disabled={verifyDomain.isPending}>Verify Domain</Button>
            {sesInfo?.instructions && <Button variant="outline" onClick={()=>copy(sesInfo.instructions.value)}><ClipboardDocumentIcon className="h-4 w-4 mr-1" />Copy TXT</Button>}</div>
            {sesInfo?.instructions && <p className="text-xs font-mono">TXT {sesInfo.instructions.name} → {sesInfo.instructions.value}</p>}
          </TabsContent>

          <TabsContent value="ses" className="space-y-3 pt-4">
            <Button onClick={()=> verifySES.mutate({domain, cloudflareApiToken: cloudflareAvailable ? cfToken : undefined}, {onSuccess:()=>toast.success("SES verified"), onError:(e:any)=>toast.error(e.message)})} disabled={verifySES.isPending}>Verify SES Domain</Button>
            <p className="text-xs text-muted-foreground">Adds TXT _amazonses.{domain} - {cloudflareAvailable ? "auto via Cloudflare if token" : "manual for BYOK"}</p>
            {sesInfo?.sesStatus && <div className="flex gap-2 text-xs">{sesInfo.sesStatus.configured ? <span className="flex gap-1 text-green-600"><CheckCircleIcon className="h-4 w-4" />SES configured</span> : <span className="flex gap-1 text-red-600"><ExclamationTriangleIcon className="h-4 w-4" />SES not configured</span>}</div>}
          </TabsContent>

          <TabsContent value="dkim" className="space-y-3 pt-4">
            <Button onClick={()=> setupDKIM.mutate({cloudflareApiToken: cloudflareAvailable ? cfToken : undefined}, {onSuccess:()=>toast.success("DKIM setup"), onError:(e:any)=>toast.error(e.message)})} disabled={setupDKIM.isPending}>Setup DKIM (3x CNAME)</Button>
            <Button variant="outline" onClick={()=> verifyDMARC.mutate(undefined, {onSuccess:()=>toast.success("DMARC verified"), onError:(e:any)=>toast.error(e.message)})}>Verify DMARC</Button>
            <p className="text-xs">_dmarc.{domain} → v=DMARC1; p=quarantine; rua=mailto:dmarc@{domain}</p>
          </TabsContent>

          <TabsContent value="health" className="space-y-3 pt-4">
            <div className="flex gap-2">
              <Badge variant={capability?.canSend ? "default" : "secondary"}>{capability?.canSend ? "Can send" : "Not ready"}</Badge>
              <Badge variant={capability?.dkimStatus?.verified ? "default" : "outline"}>DKIM {capability?.dkimStatus?.verified ? "verified" : "pending"}</Badge>
            </div>
            {capability?.recommendations && <ul className="list-disc pl-5 text-xs text-muted-foreground">{capability.recommendations.map((r:string,i:number)=><li key={i}>{r}</li>)}</ul>}
            <Button variant="outline" size="sm" onClick={()=>refetchCap()}>Refresh health</Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
