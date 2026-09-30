"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreateSMSProvider, useSMSProviders, useTestSMS } from "@/lib/query/hooks/use-sms-setup";
import { useTenant } from "@/contexts/tenant-context";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircleIcon, DevicePhoneMobileIcon, GlobeAltIcon, ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";

export function SMSSenderSetup() {
  const { selectedTenant } = useTenant();
  const tenantId = selectedTenant?.id;
  const { data: providersData } = useSMSProviders(tenantId);
  const providers = (providersData as any)?.data || [];
  const hasTermii = providers.some((p: any) => p.providerId === "termii");
  const hasAT = providers.some((p: any) => p.providerId === "africastalking");
  const hasTwilio = providers.some((p: any) => p.providerId === "twilio");
  const create = useCreateSMSProvider();
  const test = useTestSMS();

  const [termii, setTermii] = useState({ apiKey: "", senderId: "" });
  const [at, setAT] = useState({ apiKey: "", username: "", senderId: "" });
  const [twilio, setTwilio] = useState({ accountSid: "", authToken: "", fromNumber: "" });
  const [testPhone, setTestPhone] = useState("");
  const [testMsg, setTestMsg] = useState("Sanarwa SMS test");

  const handleTermii = (): void => {
    if (!tenantId) {
      toast.error("Select tenant");
      return;
    }
    if (!termii.apiKey || !termii.senderId) {
      toast.error("Fill Termii API key + Sender ID");
      return;
    }
    create.mutate(
      { tenantId, providerId: "termii", config: { apiKey: termii.apiKey, senderId: termii.senderId } },
      { onSuccess: () => toast.success("Termii BYOK saved"), onError: (e: any) => toast.error(e.message) },
    );
  };

  const handleAT = (): void => {
    if (!tenantId) {
      toast.error("Select tenant");
      return;
    }
    if (!at.apiKey || !at.username) {
      toast.error("Fill AT API key + Username");
      return;
    }
    create.mutate(
      { tenantId, providerId: "africastalking", config: { apiKey: at.apiKey, username: at.username, senderId: at.senderId } },
      { onSuccess: () => toast.success("Africa's Talking BYOK saved"), onError: (e: any) => toast.error(e.message) },
    );
  };

  const handleTwilio = (): void => {
    if (!tenantId) {
      toast.error("Select tenant");
      return;
    }
    if (!twilio.accountSid || !twilio.authToken || !twilio.fromNumber) {
      toast.error("Fill Twilio SID/Token/From");
      return;
    }
    create.mutate(
      { tenantId, providerId: "twilio", config: { accountSid: twilio.accountSid, authToken: twilio.authToken, fromNumber: twilio.fromNumber } },
      { onSuccess: () => toast.success("Twilio BYOK saved"), onError: (e: any) => toast.error(e.message) },
    );
  };

  const handleTest = (providerId: string): void => {
    if (!testPhone) {
      toast.error("Enter phone E.164");
      return;
    }
    test.mutate(
      { providerId, phone: testPhone, message: testMsg },
      { onSuccess: () => toast.success(`Test via ${providerId} sent`), onError: (e: any) => toast.error(e.message) },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">SMS <Badge variant="secondary">Managed Africastalking+Telnyx</Badge> {hasTermii && <Badge variant="outline">Termii BYOK</Badge>} {hasAT && <Badge variant="outline">AT BYOK</Badge>} {hasTwilio && <Badge variant="outline">Twilio BYOK</Badge>}</CardTitle>
        <CardDescription>Managed `SMS_AFRICA=africastalking` + `SMS_GLOBAL=telnyx` routing `sms-routing.service.ts` `100 burst`. BYOK overrides per-tenant.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="managed" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="managed" className="flex gap-1"><GlobeAltIcon className="h-4 w-4" />Managed</TabsTrigger>
            <TabsTrigger value="termii" className="flex gap-1"><ChatBubbleLeftRightIcon className="h-4 w-4" />Termii</TabsTrigger>
            <TabsTrigger value="at"><DevicePhoneMobileIcon className="h-4 w-4" />AT</TabsTrigger>
            <TabsTrigger value="twilio">Twilio</TabsTrigger>
          </TabsList>
          <TabsContent value="managed" className="space-y-2 pt-4 text-sm">
            <p className="flex gap-2 text-green-600"><CheckCircleIcon className="h-4 w-4" />Managed works without config - Africa via AT/Termii, global via Telnyx `sms.provider.ts`.</p>
            <p className="text-muted-foreground">Keep `100 burst` `limiter 30/sec`. Sender ID via Termii dashboard `TL...` or AT short code.</p>
            <div className="flex gap-2"><Input placeholder="+2348012345678" value={testPhone} onChange={(e)=>setTestPhone(e.target.value)} /><Input placeholder="Test message" value={testMsg} onChange={(e)=>setTestMsg(e.target.value)} /><Button size="sm" onClick={()=>handleTest("africastalking")}>Test Managed</Button></div>
          </TabsContent>
          <TabsContent value="termii" className="space-y-2 pt-4">
            <div className="grid gap-2 md:grid-cols-2"><div><Label>API Key</Label><Input value={termii.apiKey} onChange={(e)=>setTermii({...termii, apiKey:e.target.value})} placeholder="TL..." /></div><div><Label>Sender ID</Label><Input value={termii.senderId} onChange={(e)=>setTermii({...termii, senderId:e.target.value})} placeholder="Acme" /></div></div>
            <Button onClick={handleTermii} disabled={create.isPending}>Save Termii BYOK</Button>
            <div className="flex gap-2"><Input placeholder="+234..." value={testPhone} onChange={(e)=>setTestPhone(e.target.value)} /><Button size="sm" variant="outline" onClick={()=>handleTest("termii")}>Test Termii</Button></div>
          </TabsContent>
          <TabsContent value="at" className="space-y-2 pt-4">
            <div className="grid gap-2 md:grid-cols-3"><div><Label>API Key</Label><Input value={at.apiKey} onChange={(e)=>setAT({...at, apiKey:e.target.value})} /></div><div><Label>Username</Label><Input value={at.username} onChange={(e)=>setAT({...at, username:e.target.value})} placeholder="sandbox" /></div><div><Label>Sender ID/Short Code</Label><Input value={at.senderId} onChange={(e)=>setAT({...at, senderId:e.target.value})} /></div></div>
            <Button onClick={handleAT} disabled={create.isPending}>Save AT BYOK</Button>
            <div className="flex gap-2"><Input placeholder="+234..." value={testPhone} onChange={(e)=>setTestPhone(e.target.value)} /><Button size="sm" variant="outline" onClick={()=>handleTest("africastalking")}>Test AT</Button></div>
          </TabsContent>
          <TabsContent value="twilio" className="space-y-2 pt-4">
            <div className="grid gap-2 md:grid-cols-3"><div><Label>Account SID</Label><Input value={twilio.accountSid} onChange={(e)=>setTwilio({...twilio, accountSid:e.target.value})} /></div><div><Label>Auth Token</Label><Input type="password" value={twilio.authToken} onChange={(e)=>setTwilio({...twilio, authToken:e.target.value})} /></div><div><Label>From Number</Label><Input value={twilio.fromNumber} onChange={(e)=>setTwilio({...twilio, fromNumber:e.target.value})} placeholder="+123..." /></div></div>
            <Button onClick={handleTwilio} disabled={create.isPending}>Save Twilio BYOK</Button>
            <div className="flex gap-2"><Input placeholder="+1..." value={testPhone} onChange={(e)=>setTestPhone(e.target.value)} /><Button size="sm" variant="outline" onClick={()=>handleTest("twilio")}>Test Twilio</Button></div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
