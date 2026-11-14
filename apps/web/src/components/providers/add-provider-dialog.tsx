"use client";

import { Button } from "@sanarwa/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@sanarwa/ui/dialog";
import { Input } from "@sanarwa/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@sanarwa/ui/select";
import { Textarea } from "@sanarwa/ui/textarea";
import type { ProviderChannel } from "@sanarwa/api-client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/auth/form-field";
import { getApiErrorMessage } from "@/lib/utils/api-error-message";
import {
  useCreateProviderConfig,
  useProviderCatalog,
  type CatalogEntry,
} from "@/lib/query/hooks/use-provider-configs";

const CHANNEL_LABELS: Record<string, string> = { email: "Email", sms: "SMS", push: "Push" };

const ACRONYMS: Record<string, string> = {
  api: "API",
  id: "ID",
  url: "URL",
  sms: "SMS",
  smtp: "SMTP",
};

function fieldLabel(field: string): string {
  const words = field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .map((word) => word.toLowerCase());
  const label = words.map((word) => ACRONYMS[word] ?? word).join(" ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

interface AddProviderDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddProviderDialog({ projectId, open, onOpenChange }: AddProviderDialogProps) {
  const { data: catalog = [], isLoading } = useProviderCatalog(projectId);
  const create = useCreateProviderConfig(projectId);
  const [channel, setChannel] = useState<string>("email");
  const [providerKey, setProviderKey] = useState<string>("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [rawJson, setRawJson] = useState("");

  const channels = useMemo(() => [...new Set(catalog.map((entry) => entry.channel))], [catalog]);
  const options = catalog.filter((entry) => entry.channel === channel);
  const entry: CatalogEntry | undefined = options.find((item) => item.providerId === providerKey);
  const schema = entry?.schema;

  const fields = schema
    ? [...schema.required, ...schema.requiredAny, ...schema.optional].filter(
        (field, index, all) => all.indexOf(field) === index,
      )
    : [];

  const reset = () => {
    setProviderKey("");
    setValues({});
    setRawJson("");
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!entry) return;

    let config: Record<string, unknown>;
    if (schema) {
      config = Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim()));
      const missing = schema.required.filter((field) => !config[field]);
      if (missing.length > 0) {
        toast.error(`Fill in: ${missing.map(fieldLabel).join(", ")}`);
        return;
      }
    } else {
      try {
        config = JSON.parse(rawJson);
      } catch {
        toast.error("Credentials must be valid JSON");
        return;
      }
    }

    create.mutate(
      {
        providerId: entry.providerId,
        providerName: entry.name,
        providerType: entry.providerId,
        channel: entry.channel as ProviderChannel,
        config,
      },
      {
        onSuccess: () => {
          toast.success(`${entry.name} connected`);
          close(false);
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Could not connect provider")),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect a provider</DialogTitle>
          <DialogDescription>
            Use your own account. Credentials are encrypted and never shown again.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <FormField label="Channel" htmlFor="channel">
            <Select
              value={channel}
              onValueChange={(next) => {
                setChannel(next);
                reset();
              }}
            >
              <SelectTrigger id="channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {channels.map((item) => (
                  <SelectItem key={item} value={item}>
                    {CHANNEL_LABELS[item] ?? item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Provider" htmlFor="provider">
            <Select
              value={providerKey}
              onValueChange={(next) => {
                setProviderKey(next);
                setValues({});
              }}
            >
              <SelectTrigger id="provider">
                <SelectValue placeholder={isLoading ? "Loading…" : "Choose a provider"} />
              </SelectTrigger>
              <SelectContent>
                {options.map((item) => (
                  <SelectItem key={item.providerId} value={item.providerId}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {entry && schema
            ? fields.map((field) => (
                <FormField
                  key={field}
                  label={`${fieldLabel(field)}${schema.required.includes(field) ? "" : " (optional)"}`}
                  htmlFor={`field-${field}`}
                  hint={schema.description[field]}
                >
                  <Input
                    id={`field-${field}`}
                    type={schema.secretFields.includes(field) ? "password" : "text"}
                    autoComplete="off"
                    value={values[field] ?? ""}
                    onChange={(event) =>
                      setValues((previous) => ({ ...previous, [field]: event.target.value }))
                    }
                  />
                </FormField>
              ))
            : null}

          {entry && !schema ? (
            <FormField
              label="Credentials (JSON)"
              htmlFor="raw-config"
              hint={`Paste the credentials ${entry.name} needs, as a JSON object.`}
            >
              <Textarea
                id="raw-config"
                rows={5}
                className="font-mono text-xs"
                value={rawJson}
                onChange={(event) => setRawJson(event.target.value)}
                placeholder='{"apiKey": "…"}'
              />
            </FormField>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!entry || create.isPending}>
              {create.isPending ? "Connecting…" : "Connect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
