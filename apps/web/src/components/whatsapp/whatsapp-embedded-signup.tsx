"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompleteEmbeddedSignup, useInitiateEmbeddedSignup, useWABAStatus, useSyncWABA } from "@/lib/query/hooks/use-whatsapp-queries";
import { useTenant } from "@/contexts/tenant-context";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { CheckCircleIcon, ArrowTopRightOnSquareIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

export function WhatsAppEmbeddedSignup() {
  const { selectedTenant } = useTenant();
  const tenantId = selectedTenant?.id;
  const { data: waba, isLoading, refetch } = useWABAStatus(tenantId);
  const { mutate: initiate, isPending: initiating } = useInitiateEmbeddedSignup();
  const { mutate: complete } = useCompleteEmbeddedSignup();
  const { mutate: sync, isPending: syncing } = useSyncWABA();

  const [form, setForm] = useState({ businessName: "", businessEmail: "", businessPhone: "", businessWebsite: "" });

  // Handle redirect ?code & state from Meta after Embedded Signup
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (code && state) {
      complete({ code, state }, { onSuccess: () => { toast.success("WhatsApp WABA connected"); refetch(); }, onError: (e:any)=> toast.error(e.message) });
      // clean url
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  if (isLoading) return <Card className="animate-pulse"><CardHeader><div className="h-4 bg-muted rounded w-1/3" /></CardHeader></Card>;

  const hasWaba = waba?.hasWaba;

  if (hasWaba) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">WhatsApp Business <Badge className="bg-green-100 text-green-800">{waba.status}</Badge></CardTitle>
          <CardDescription>Dedicated WABA • 6,000 templates • independent reputation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-muted-foreground">WABA ID</span><p className="font-mono text-xs truncate">{waba.wabaId}</p></div>
            <div><span className="text-muted-foreground">Phone</span><p className="font-mono text-xs">{waba.phoneNumberId}</p></div>
            <div><span className="text-muted-foreground">Verification</span><p>{waba.verificationStatus}</p></div>
            <div><span className="text-muted-foreground">Templates</span><p>{waba.templateUsage?.used}/{waba.templateUsage?.limit} ({Math.round(waba.templateUsage?.utilizationRate || 0)}%)</p></div>
          </div>
          <Button variant="outline" size="sm" onClick={() => sync(tenantId!)} disabled={syncing}><ArrowPathIcon className="h-4 w-4 mr-2" />Sync with Meta</Button>
        </CardContent>
      </Card>
    );
  }

  const handleInitiate = () => {
    if (!tenantId) return toast.error("Select tenant first");
    if (!form.businessName || !form.businessEmail || !form.businessPhone) return toast.error("Fill business name, email, phone");
    const redirectUri = window.location.origin + window.location.pathname;
    initiate({ tenantId, businessName: form.businessName, businessEmail: form.businessEmail, businessPhone: form.businessPhone, businessWebsite: form.businessWebsite, redirectUri }, {
      onSuccess: (res: any) => {
        toast.success("Opening Meta signup...");
        window.open(res.signupUrl, "_blank", "width=600,height=700");
      },
      onError: (e:any)=> toast.error(e.message),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect WhatsApp Business</CardTitle>
        <CardDescription>One-click via Meta Embedded Signup - your own dedicated WABA (6,000 templates, not shared)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div><Label>Business Name</Label><Input value={form.businessName} onChange={(e)=>setForm({...form,businessName:e.target.value})} placeholder="Acme Inc" /></div>
          <div><Label>Business Email</Label><Input value={form.businessEmail} onChange={(e)=>setForm({...form,businessEmail:e.target.value})} placeholder="ops@acme.com" /></div>
          <div><Label>Business Phone (E.164)</Label><Input value={form.businessPhone} onChange={(e)=>setForm({...form,businessPhone:e.target.value})} placeholder="+2348012345678" /></div>
          <div><Label>Website (optional)</Label><Input value={form.businessWebsite} onChange={(e)=>setForm({...form,businessWebsite:e.target.value})} placeholder="https://acme.com" /></div>
        </div>
        <Button onClick={handleInitiate} disabled={initiating} className="w-full">
          <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-2" />{initiating ? "Generating..." : "Connect with Meta - Embedded Signup"}
        </Button>
        <p className="text-xs text-muted-foreground">Benefits: dedicated 6k templates, isolated reputation, no sharing, Meta ESU compliant. After Meta verification you'll send immediately.</p>
      </CardContent>
    </Card>
  );
}
