"use client";

import { Send } from "@/lib/icons";

import { Button } from "@sanarwa/ui/button";
import { Card } from "@sanarwa/ui/card";
import { Input } from "@sanarwa/ui/input";
import { Label } from "@sanarwa/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@sanarwa/ui/tabs";
import { Textarea } from "@sanarwa/ui/textarea";
import { useBrandedEmailTemplates } from "@/hooks/use-brand-application";
import { cn } from "@/lib/utils";
import {
  EyeIcon,
  EnvelopeIcon,
  ComputerDesktopIcon,
  BookmarkIcon,
  PaperAirplaneIcon,
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
  CodeBracketIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useState } from "react";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables: string[];
}

interface BrandedEmailTemplateProps {
  template?: EmailTemplate;
  onSave?: (template: EmailTemplate) => void;
  onSend?: (template: EmailTemplate) => void;
  className?: string;
}

export function BrandedEmailTemplate({
  template,
  onSave,
  onSend,
  className,
}: BrandedEmailTemplateProps) {
  const { addTemplate, templates } = useBrandedEmailTemplates();
  const [currentTemplate, setCurrentTemplate] = useState<EmailTemplate>(
    template || {
      id: "",
      name: "",
      subject: "",
      htmlContent: "",
      textContent: "",
      variables: [],
    },
  );
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");

  const brandedTemplate = templates.find((t) => t.id === currentTemplate.id);

  const handleTemplateChange = useCallback(
    (updates: Partial<EmailTemplate>) => {
      const updatedTemplate = { ...currentTemplate, ...updates };
      setCurrentTemplate(updatedTemplate);

      if (updatedTemplate.id) {
        addTemplate(updatedTemplate);
      }
    },
    [currentTemplate, addTemplate],
  );

  const handleSave = useCallback(() => {
    if (!currentTemplate.id) {
      const newTemplate = { ...currentTemplate, id: Date.now().toString() };
      setCurrentTemplate(newTemplate);
      addTemplate(newTemplate);
      onSave?.(newTemplate);
    } else {
      onSave?.(currentTemplate);
    }
  }, [currentTemplate, addTemplate, onSave]);

  const handleSend = useCallback(() => {
    onSend?.(currentTemplate);
  }, [currentTemplate, onSend]);

  const getPreviewWidth = () => {
    switch (previewDevice) {
      case "mobile":
        return "375px";
      case "tablet":
        return "768px";
      case "desktop":
        return "100%";
      default:
        return "100%";
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Email Template Editor</h2>
          <p className="text-muted-foreground">Create and customize branded email templates</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSave}>
            <BookmarkIcon className="h-4 w-4 mr-2" />
            Save Template
          </Button>
          <Button onClick={handleSend}>
            <PaperAirplaneIcon className="h-4 w-4 mr-2" />
            Send Test
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">Template Name</Label>
              <Input
                id="templateName"
                value={currentTemplate.name}
                onChange={(e) => handleTemplateChange({ name: e.target.value })}
                placeholder="Welcome Email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={currentTemplate.subject}
                onChange={(e) => handleTemplateChange({ subject: e.target.value })}
                placeholder="Welcome to {{company_name}}!"
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <Tabs defaultValue="html" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="html" className="flex items-center gap-2">
                <CodeBracketIcon className="h-4 w-4" />
                HTML Content
              </TabsTrigger>
              <TabsTrigger value="text" className="flex items-center gap-2">
                <EnvelopeIcon className="h-4 w-4" />
                Text Content
              </TabsTrigger>
            </TabsList>

            <TabsContent value="html" className="mt-4">
              <div className="space-y-2">
                <Label>HTML Content</Label>
                <Textarea
                  value={currentTemplate.htmlContent}
                  onChange={(e) => handleTemplateChange({ htmlContent: e.target.value })}
                  placeholder={`<h1>Welcome to {{company_name}}!</h1>
<p>Thank you for joining us, {{user_name}}.</p>
<a href="{{activation_link}}" class="btn-primary">Get Started</a>`}
                  className="font-mono text-sm min-h-[400px]"
                />
                <div className="text-xs text-muted-foreground">
                  Use variables like {`{{ user_name }}, {{ company_name }}`}, etc. Branding will be
                  applied automatically.
                </div>
              </div>
            </TabsContent>

            <TabsContent value="text" className="mt-4">
              <div className="space-y-2">
                <Label>Plain Text Content</Label>
                <Textarea
                  value={currentTemplate.textContent || ""}
                  onChange={(e) => handleTemplateChange({ textContent: e.target.value })}
                  placeholder={`Welcome to {{company_name}}!

Thank you for joining us, {{user_name}}.

Get started: {{activation_link}}`}
                  className="font-mono text-sm min-h-[400px]"
                />
                <div className="text-xs text-muted-foreground">
                  Plain text version for email clients that don't support HTML.
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Branded Preview</h3>
              <div className="flex items-center gap-1 border rounded-lg p-1">
                <Button
                  variant={previewDevice === "desktop" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setPreviewDevice("desktop")}
                >
                  <ComputerDesktopIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant={previewDevice === "tablet" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setPreviewDevice("tablet")}
                >
                  <DeviceTabletIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant={previewDevice === "mobile" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setPreviewDevice("mobile")}
                >
                  <DevicePhoneMobileIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900">
              <div
                className="mx-auto bg-white dark:bg-gray-800 min-h-[400px] transition-all duration-200"
                style={{ width: getPreviewWidth() }}
              >
                {brandedTemplate ? (
                  <iframe
                    srcDoc={brandedTemplate.brandedHtmlContent}
                    className="w-full h-[500px] border-0"
                    title="Email Preview"
                  />
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                    <div className="text-center">
                      <EyeIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Preview will appear here</p>
                      <p className="text-sm">Add content and save to see branded preview</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {brandedTemplate && (
              <div className="text-xs text-muted-foreground">
                <p>
                  <strong>Subject:</strong> {currentTemplate.subject}
                </p>
                <p>
                  <strong>Variables detected:</strong>{" "}
                  {currentTemplate.variables.join(", ") || "None"}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Available Variables</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            "{{user_name}}",
            "{{user_email}}",
            "{{company_name}}",
            "{{activation_link}}",
            "{{unsubscribe_link}}",
            "{{current_date}}",
            "{{campaign_name}}",
            "{{support_email}}",
          ].map((variable) => (
            <Button
              key={variable}
              variant="outline"
              size="sm"
              className="justify-start font-mono text-xs"
              onClick={() => {
                const newContent = currentTemplate.htmlContent + variable;
                handleTemplateChange({ htmlContent: newContent });
              }}
            >
              {variable}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}
