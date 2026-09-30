"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreatePushProvider, usePushProviders, useTestPush } from "@/lib/query/hooks/use-push-setup";
import { useTenant } from "@/contexts/tenant-context";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircleIcon, DevicePhoneMobileIcon, CloudIcon } from "@heroicons/react/24/outline";

export function PushProviderSetup() {
  const { selectedTenant } = useTenant();
  const tenantId = selectedTenant?.id;
  const { data: providersData } = usePushProviders(tenantId);
  const providers = (providersData as any)?.data || [];
  const hasFCM = providers.some((p: any) => p.providerId === "fcm");
  const hasAPNS = providers.some((p: any) => p.providerId === "apple-push" || p.providerId === "apns");
  const create = useCreatePushProvider();
  const test = useTestPush(tenantId);

  const [fcmJson, setFcmJson] = useState("");
  const [apns, setApns] = useState({ keyId: "", teamId: "", bundleId: "", privateKey: "" });
  const [testToken, setTestToken] = useState("");

  const handleFCM = (): void => {
    if (!tenantId) {
      toast.error("Select tenant");
      return;
    }
    try {
      const serviceAccount = JSON.parse(fcmJson);
      create.mutate(
        { tenantId, providerId: "fcm", config: { serviceAccountJson: fcmJson, projectId: serviceAccount.project_id } },
        { onSuccess: () => toast.success("FCM BYOK saved (v1)"), onError: (e: any) => toast.error(e.message) },
      );
    } catch {
      toast.error("Invalid service account JSON");
    }
  };

  const handleAPNS = (): void => {
    if (!tenantId) {
      toast.error("Select tenant");
      return;
    }
    if (!apns.keyId || !apns.teamId || !apns.bundleId || !apns.privateKey) {
      toast.error("Fill all APNS fields");
      return;
    }
    create.mutate(
      { tenantId, providerId: "apple-push", config: { apnsKeyId: apns.keyId, apnsTeamId: apns.teamId, apnsBundleId: apns.bundleId, apnsPrivateKey: apns.privateKey, apnsEnvironment: "production" } },
      { onSuccess: () => toast.success("APNS BYOK saved (ES256)"), onError: (e: any) => toast.error(e.message) },
    );
  };

  const handleTest = (providerId: string): void => {
    if (!testToken) {
      toast.error("Enter device token");
      return;
    }
    test.mutate(
      { providerId, deviceToken: testToken, title: "Sanarwa test", body: "Push works!" },
      { onSuccess: () => toast.success("Test sent"), onError: (e: any) => toast.error(e.message) },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Push <Badge variant="secondary">Managed SNS fallback</Badge> {hasFCM && <Badge variant="outline">FCM BYOK</Badge>} {hasAPNS && <Badge variant="outline">APNS BYOK</Badge>}</CardTitle>
        <CardDescription>Managed `SNS` (`GCM+APNS`) works out of box `PUSH_FALLBACK_PROVIDER=sns` `100 burst`. BYOK for Android `FCM HTTP v1` + iOS `APNS ES256` overrides.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="managed" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="managed" className="flex gap-1"><CloudIcon className="h-4 w-4" />Managed</TabsTrigger>
            <TabsTrigger value="fcm" className="flex gap-1"><DevicePhoneMobileIcon className="h-4 w-4" />FCM BYOK</TabsTrigger>
            <TabsTrigger value="apns">APNS BYOK</TabsTrigger>
          </TabsList>
          <TabsContent value="managed" className="space-y-2 pt-4 text-sm">
            <p className="flex gap-2 text-green-600"><CheckCircleIcon className="h-4 w-4" />SNS managed works without config - `Aws SNS` `PLATFORM_APPLICATION_ARN` in env.</p>
            <p className="text-muted-foreground">Covers both Android + iOS via `GCM+APNS` JSON. Keep for minimal, add BYOK later for direct FCM/APNS.</p>
            <div className="flex gap-2"><Input placeholder="Device token for test" value={testToken} onChange={(e)=>setTestToken(e.target.value)} /><Button size="sm" onClick={()=>handleTest("sns")}>Test SNS</Button></div>
          </TabsContent>
          <TabsContent value="fcm" className="space-y-2 pt-4">
            <Label>FCM Service Account JSON (HTTP v1)</Label>
            <textarea className="w-full rounded-md border p-2 text-xs font-mono h-28" value={fcmJson} onChange={(e)=>setFcmJson(e.target.value)} placeholder='{"type":"service_account","project_id":"...","private_key":"..."}' />
            <Button onClick={handleFCM} disabled={create.isPending}>Save FCM BYOK</Button>
            <div className="flex gap-2"><Input placeholder="FCM device token" value={testToken} onChange={(e)=>setTestToken(e.target.value)} /><Button size="sm" variant="outline" onClick={()=>handleTest("fcm")}>Test FCM</Button></div>
            <p className="text-xs text-muted-foreground">Uses `FCM_SERVICE_ACCOUNT_JSON` `project_id` + `google-auth-library` `HTTP v1` - world-class, not legacy `serverKey`.</p>
          </TabsContent>
          <TabsContent value="apns" className="space-y-2 pt-4">
            <div className="grid gap-2 md:grid-cols-2"><div><Label>Key ID</Label><Input value={apns.keyId} onChange={(e)=>setApns({...apns, keyId:e.target.value})} /></div><div><Label>Team ID</Label><Input value={apns.teamId} onChange={(e)=>setApns({...apns, teamId:e.target.value})} /></div></div>
            <div><Label>Bundle ID</Label><Input value={apns.bundleId} onChange={(e)=>setApns({...apns, bundleId:e.target.value})} placeholder="com.acme.app" /></div>
            <div><Label>Private Key (.p8 content)</Label><textarea className="w-full rounded-md border p-2 text-xs font-mono h-20" value={apns.privateKey} onChange={(e)=>setApns({...apns, privateKey:e.target.value})} placeholder="-----BEGIN PRIVATE KEY-----" /></div>
            <Button onClick={handleAPNS} disabled={create.isPending}>Save APNS BYOK</Button>
            <div className="flex gap-2"><Input placeholder="APNS device token (64 hex)" value={testToken} onChange={(e)=>setTestToken(e.target.value)} /><Button size="sm" variant="outline" onClick={()=>handleTest("apple-push")}>Test APNS</Button></div>
            <p className="text-xs text-muted-foreground">ES256 JWT `apple-push.provider.ts:135` `jsonwebtoken` 1h, `apns-topic` + `apns-push-type: alert`.</p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
