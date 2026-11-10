"use client";

import { Button } from "@sanarwa/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@sanarwa/ui/card";
import { Badge } from "@sanarwa/ui/badge";
import { Input } from "@sanarwa/ui/input";
import { Label } from "@sanarwa/ui/label";
import {
  useCompleteEmbeddedSignup,
  useInitiateEmbeddedSignup,
  useWABAStatus,
  useSyncWABA,
  useDisconnectWABA,
} from "@/lib/query/hooks/use-whatsapp-queries";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowTopRightOnSquareIcon, ArrowPathIcon, TrashIcon } from "@heroicons/react/24/outline";

export function WhatsAppEmbeddedSignup() {
  const { data: waba, isLoading, refetch } = useWABAStatus();
  const { mutate: initiate, isPending: initiating } = useInitiateEmbeddedSignup();
  const { mutate: complete } = useCompleteEmbeddedSignup();
  const { mutate: sync, isPending: syncing } = useSyncWABA();
  const { mutate: disconnect, isPending: disconnecting } = useDisconnectWABA();

  const [form, setForm] = useState({
    businessName: "",
    businessEmail: "",
    businessPhone: "",
    businessWebsite: "",
  });

  useEffect((): void => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (code && state) {
      complete(
        { code, state },
        {
          onSuccess: () => {
            toast.success("WhatsApp WABA connected");
            refetch();
          },
          onError: (e: any) => toast.error(e.message),
        },
      );
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  if (isLoading)
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-4 bg-muted rounded w-1/3" />
        </CardHeader>
      </Card>
    );

  const hasWaba = waba?.hasWaba;

  if (hasWaba) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            WhatsApp Business <Badge className="bg-green-100 text-green-800">{waba.status}</Badge>
          </CardTitle>
          <CardDescription>
            Your own dedicated WABA • 6,000 templates • independent reputation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">Display number</span>
              <p className="font-mono text-xs">{waba.displayPhoneNumber || "-"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Phone number ID</span>
              <p className="font-mono text-xs truncate">{waba.phoneNumberId}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Verification</span>
              <p>{waba.verificationStatus}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Templates</span>
              <p>
                {waba.templateUsage?.used}/{waba.templateUsage?.limit} (
                {Math.round(waba.templateUsage?.utilizationRate || 0)}%)
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => sync()} disabled={syncing}>
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Sync with Meta
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => disconnect()}
              disabled={disconnecting}
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleInitiate = (): void => {
    if (!form.businessName || !form.businessEmail || !form.businessPhone) {
      toast.error("Fill business name, email, phone");
      return;
    }
    const redirectUri = window.location.origin + window.location.pathname;
    initiate(
      {
        businessName: form.businessName,
        businessEmail: form.businessEmail,
        businessPhone: form.businessPhone,
        businessWebsite: form.businessWebsite,
        redirectUri,
      },
      {
        onSuccess: (res: any) => {
          toast.success("Opening Meta signup...");
          window.open(res.loginUrl, "_blank", "width=600,height=700");
        },
        onError: (e: any) => toast.error(e.message),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect WhatsApp Business</CardTitle>
        <CardDescription>
          Connect your own WhatsApp Business Account via Meta Embedded Signup. No platform number is
          shared — sends go through your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Business Name</Label>
            <Input
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              placeholder="Acme Inc"
            />
          </div>
          <div>
            <Label>Business Email</Label>
            <Input
              value={form.businessEmail}
              onChange={(e) => setForm({ ...form, businessEmail: e.target.value })}
              placeholder="ops@acme.com"
            />
          </div>
          <div>
            <Label>Business Phone (E.164)</Label>
            <Input
              value={form.businessPhone}
              onChange={(e) => setForm({ ...form, businessPhone: e.target.value })}
              placeholder="+2348012345678"
            />
          </div>
          <div>
            <Label>Website (optional)</Label>
            <Input
              value={form.businessWebsite}
              onChange={(e) => setForm({ ...form, businessWebsite: e.target.value })}
              placeholder="https://acme.com"
            />
          </div>
        </div>
        <Button onClick={handleInitiate} disabled={initiating} className="w-full">
          <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-2" />
          {initiating ? "Generating..." : "Connect with Meta"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Dedicated 6k templates, isolated reputation, Meta ESU compliant. After Meta verification
          you can send immediately.
        </p>
      </CardContent>
    </Card>
  );
}
