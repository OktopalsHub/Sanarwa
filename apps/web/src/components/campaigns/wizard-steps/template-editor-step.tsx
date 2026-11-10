"use client";

import { Input } from "@sanarwa/ui/input";
import { Label } from "@sanarwa/ui/label";
import { Textarea } from "@sanarwa/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@sanarwa/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@sanarwa/ui/card";
import type { CommunicationChannel } from "@/lib/types/campaign";
import { useState } from "react";

export type TemplatePerChannel = Record<
  CommunicationChannel,
  { subject?: string; data: string; variables?: Record<string, any> }
>;

interface TemplateEditorStepProps {
  selectedChannels: CommunicationChannel[];
  templates: TemplatePerChannel;
  onChange: (templates: TemplatePerChannel) => void;
}

const varHint = "{{firstName}} {{code}} - handlebars variables";

function Field({
  label,
  value,
  onChange,
  placeholder,
  isTextarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  isTextarea?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs">{label}</Label>
      {isTextarea ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="font-mono text-sm"
        />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
      <span className="text-xs text-muted-foreground">{varHint}</span>
    </div>
  );
}

export function TemplateEditorStep({
  selectedChannels,
  templates,
  onChange,
}: TemplateEditorStepProps) {
  const [active, setActive] = useState<CommunicationChannel>(selectedChannels[0] || "email");
  const update = (
    ch: CommunicationChannel,
    patch: Partial<TemplatePerChannel[CommunicationChannel]>,
  ) => {
    onChange({ ...templates, [ch]: { ...(templates[ch] || { data: "" }), ...patch } });
  };
  if (!selectedChannels.length)
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Select channels first.
        </CardContent>
      </Card>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Templates per channel</CardTitle>
        <CardDescription>
          One template per channel, handlebars `{"{{var}}"}` with live preview. Minimal for `250
          burst`.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={active}
          onValueChange={(v) => setActive(v as CommunicationChannel)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 h-auto">
            {selectedChannels.map((ch) => (
              <TabsTrigger key={ch} value={ch} className="text-xs capitalize">
                {ch.replace("_", " ")}
              </TabsTrigger>
            ))}
          </TabsList>

          {selectedChannels.includes("email" as any) && (
            <TabsContent value="email" className="space-y-3 pt-4">
              <Field
                label="Subject"
                value={templates.email?.subject || ""}
                onChange={(v) => update("email", { subject: v })}
                placeholder="Welcome {{firstName}}!"
              />
              <Field
                label="HTML content"
                value={templates.email?.data || ""}
                onChange={(v) => update("email", { data: v, variables: { html: v } })}
                isTextarea
                placeholder="<h1>Hi {{firstName}}</h1>"
              />
              <div className="rounded-md border p-3 bg-muted/20 text-sm">
                <p className="font-medium">Preview</p>
                <p className="text-muted-foreground">Subject: {templates.email?.subject || "-"}</p>
                <div
                  className="prose prose-sm max-w-none mt-2"
                  dangerouslySetInnerHTML={{ __html: templates.email?.data || "" }}
                />
              </div>
            </TabsContent>
          )}

          {selectedChannels.includes("sms" as any) && (
            <TabsContent value="sms" className="space-y-3 pt-4">
              <Field
                label="SMS text (160 char)"
                value={templates.sms?.data || ""}
                onChange={(v) => update("sms", { data: v })}
                isTextarea
                placeholder="Code: {{code}}"
              />
              <p className="text-xs text-muted-foreground">
                {(templates.sms?.data || "").length}/160 • GSM 7-bit - preview:{" "}
                {templates.sms?.data || "-"}
              </p>
            </TabsContent>
          )}

          {selectedChannels.includes("whatsapp" as any) && (
            <TabsContent value="whatsapp" className="space-y-3 pt-4">
              <Field
                label="Template name (Meta approved)"
                value={templates.whatsapp?.variables?.templateName || ""}
                onChange={(v) =>
                  update("whatsapp", {
                    data: v,
                    variables: { ...templates.whatsapp?.variables, templateName: v },
                  })
                }
                placeholder="hello_world"
              />
              <Field
                label="Body with {{1}} params"
                value={templates.whatsapp?.data || ""}
                onChange={(v) => update("whatsapp", { data: v })}
                isTextarea
                placeholder="Hi {{1}} code {{2}}"
              />
              <Field
                label="Language"
                value={templates.whatsapp?.variables?.language || "en"}
                onChange={(v) =>
                  update("whatsapp", {
                    variables: { ...templates.whatsapp?.variables, language: v },
                  })
                }
                placeholder="en"
              />
              <p className="text-xs">Preview WhatsApp bubble: {templates.whatsapp?.data || "-"}</p>
            </TabsContent>
          )}

          {selectedChannels.includes("push" as any) && (
            <TabsContent value="push" className="space-y-3 pt-4">
              <Field
                label="Title"
                value={templates.push?.subject || ""}
                onChange={(v) => update("push", { subject: v })}
                placeholder="{{title}}"
              />
              <Field
                label="Body"
                value={templates.push?.data || ""}
                onChange={(v) => update("push", { data: v })}
                isTextarea
                placeholder="Hi {{firstName}}"
              />
              <Field
                label="Image URL"
                value={templates.push?.variables?.imageUrl || ""}
                onChange={(v) =>
                  update("push", { variables: { ...templates.push?.variables, imageUrl: v } })
                }
                placeholder="https://..."
              />
              <div className="rounded-md border p-3 bg-muted/20 text-sm">
                <p className="font-medium">{templates.push?.subject || "Title"}</p>
                <p>{templates.push?.data || "Body"}</p>
              </div>
            </TabsContent>
          )}

          {selectedChannels.includes("in_app" as any) && (
            <TabsContent value="in_app" className="space-y-3 pt-4">
              <Field
                label="Title"
                value={templates.in_app?.subject || ""}
                onChange={(v) => update("in_app", { subject: v })}
                placeholder="New message"
              />
              <Field
                label="Message"
                value={templates.in_app?.data || ""}
                onChange={(v) => update("in_app", { data: v })}
                isTextarea
                placeholder="Hi {{firstName}}"
              />
              <div className="rounded-md border p-3 bg-muted/20 text-sm">
                <p className="font-medium">{templates.in_app?.subject || "Title"}</p>
                <p>{templates.in_app?.data || "Message"}</p>
                <p className="text-xs text-muted-foreground">
                  Feed: default • type: info - preview bell
                </p>
              </div>
            </TabsContent>
          )}

          {selectedChannels.includes("voice" as any) && (
            <TabsContent value="voice" className="space-y-3 pt-4">
              <Field
                label="TTS text"
                value={templates.voice?.data || ""}
                onChange={(v) => update("voice", { data: v })}
                isTextarea
                placeholder="Hello {{firstName}}, your code is {{code}}"
              />
              <Field
                label="Voice"
                value={templates.voice?.variables?.voice || "female"}
                onChange={(v) =>
                  update("voice", { variables: { ...templates.voice?.variables, voice: v } })
                }
                placeholder="female/male Telnyx.Natural.abbie"
              />
              <p className="text-xs">Preview TTS • 10 burst limit • Telnyx will speak on answer.</p>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
