"use client";

import { Badge } from "@sanarwa/ui/badge";
import { Button } from "@sanarwa/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@sanarwa/ui/card";
import { Input } from "@sanarwa/ui/input";
import { Label } from "@sanarwa/ui/label";
import {
  useDisconnectChannel,
  useTestChannel,
  useUpsertChannel,
} from "@/lib/query/hooks/use-channels";
import { useTenant } from "@/contexts/tenant-context";
import { useState } from "react";
import { toast } from "sonner";
import { BeakerIcon, CheckCircleIcon, LinkIcon, TrashIcon } from "@heroicons/react/24/outline";

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  required?: boolean;
  weight?: string;
}

interface ChannelCardProps {
  providerId: "slack" | "discord" | "telegram";
  title: string;
  description: string;
  fields: FieldDef[];
  helpUrl: string;
  helpLabel: string;
  summary: {
    connected: boolean;
    connection: { name: string; isActive: boolean; destination: string | null } | null;
  };
}

export function ChannelCard({
  providerId,
  title,
  description,
  fields,
  helpUrl,
  helpLabel,
  summary,
}: ChannelCardProps) {
  const { selectedTenant } = useTenant();
  const tenantId = selectedTenant?.id;
  const upsert = useUpsertChannel();
  const test = useTestChannel();
  const disconnect = useDisconnectChannel();
  const [values, setValues] = useState<Record<string, string>>({});
  const [destination, setDestination] = useState("");
  const [message, setMessage] = useState("Sanarwa test message");

  const set = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  const handleConnect = (): void => {
    if (!tenantId) {
      toast.error("Select a workspace first");
      return;
    }
    const config: Record<string, unknown> = {};
    for (const field of fields) {
      const value = values[field.key]?.trim();
      if (value) {
        config[field.key] = value;
      }
    }
    const missing = fields.filter((f) => f.required && !config[f.key]);
    if (missing.length > 0) {
      toast.error(`Missing: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }
    upsert.mutate(
      { tenantId, providerId, config },
      {
        onSuccess: () => toast.success(`${title} connected`),
        onError: (e: any) => toast.error(e.message),
      },
    );
  };

  const handleTest = (): void => {
    if (!tenantId) {
      toast.error("Select a workspace first");
      return;
    }
    test.mutate(
      { tenantId, providerId, to: destination || undefined, message },
      {
        onSuccess: (res: any) =>
          res?.ok
            ? toast.success(res.message || "Test sent")
            : toast.error(res?.outcome?.reason || "Test failed"),
        onError: (e: any) => toast.error(e.message),
      },
    );
  };

  const handleDisconnect = (): void => {
    if (!tenantId) return;
    disconnect.mutate(
      { tenantId, providerId },
      {
        onSuccess: () => toast.success(`${title} disconnected`),
        onError: (e: any) => toast.error(e.message),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          {summary.connected ? (
            <Badge className="bg-green-100 text-green-800">Connected</Badge>
          ) : (
            <Badge variant="secondary">Not connected</Badge>
          )}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.connected && summary.connection && (
          <div className="space-y-2 rounded-md border p-3 text-sm">
            <p className="flex items-center gap-2">
              <CheckCircleIcon className="h-4 w-4 text-green-600" />
              {summary.connection.name}
              {!summary.connection.isActive && <Badge variant="secondary">Inactive</Badge>}
            </p>
            {summary.connection.destination && (
              <p className="text-xs text-muted-foreground">
                Destination: {summary.connection.destination}
              </p>
            )}
            <div className="space-y-2 pt-1">
              <Label htmlFor={`${providerId}-test-to`}>Test destination (optional override)</Label>
              <Input
                id={`${providerId}-test-to`}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Channel / chat / number"
              />
              <Label htmlFor={`${providerId}-test-msg`}>Test message</Label>
              <Input
                id={`${providerId}-test-msg`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Sanarwa test message"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleTest} disabled={test.isPending}>
                  <BeakerIcon className="h-4 w-4 mr-2" />
                  {test.isPending ? "Sending..." : "Send test"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={disconnect.isPending}
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-3">
          {fields.map((field) => (
            <div key={field.key}>
              <Label htmlFor={`${providerId}-${field.key}`}>{field.label}</Label>
              <Input
                id={`${providerId}-${field.key}`}
                value={values[field.key] || ""}
                onChange={(e) => set(field.key, e.target.value)}
                placeholder={field.placeholder}
                type={field.key.toLowerCase().includes("token") ? "password" : "text"}
                autoComplete="off"
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button onClick={handleConnect} disabled={upsert.isPending}>
            <LinkIcon className="h-4 w-4 mr-2" />
            {upsert.isPending ? "Saving..." : summary.connected ? "Update connection" : "Connect"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(helpUrl, "_blank")}>
            {helpLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
