"use client";

import { Bell, Mail, MessageSquare, Phone, Send } from "@/lib/icons";

import { Badge } from "@sanarwa/ui/badge";
import { Button } from "@sanarwa/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@sanarwa/ui/card";
import { Input } from "@sanarwa/ui/input";
import { Label } from "@sanarwa/ui/label";
import { Separator } from "@sanarwa/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@sanarwa/ui/tabs";
import type { CommunicationChannel, Template, TemplateVariable } from "@/lib/types/template";
import { cn } from "@/lib/utils";
import {
  BellIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  ComputerDesktopIcon,
  PhoneIcon,
  PaperAirplaneIcon,
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
} from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";

interface TemplatePreviewProps {
  template?: Template;
  formData?: any;
  variables: TemplateVariable[];
  previewData: Record<string, any>;
  onPreviewDataChange: (data: Record<string, any>) => void;
  className?: string;
}

const deviceSizes = {
  mobile: { width: "375px", height: "667px" },
  tablet: { width: "768px", height: "1024px" },
  desktop: { width: "100%", height: "600px" },
};

const channelIcons = {
  email: Mail,
  sms: MessageSquare,
  push: Bell,
  in_app: Bell,
  voice: Phone,
};

export function TemplatePreview({
  template,
  formData,
  variables,
  previewData,
  onPreviewDataChange,
  className,
}: TemplatePreviewProps) {
  const [selectedDevice, setSelectedDevice] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const [testEmail, setTestEmail] = useState("");

  const currentChannel = template?.channel || formData?.channel || "email";
  const currentContent = template?.content || {
    subject: formData?.subject || "",
    preheader: formData?.preheader || "",
    body: formData?.body || "",
    plainText: formData?.plainText || "",
    pushTitle: formData?.pushTitle || "",
    pushBody: formData?.pushBody || "",
    smsBody: formData?.smsBody || "",
    voiceScript: formData?.voiceScript || "",
  };

  const processedContent = useMemo(() => {
    const replaceVariables = (text: string) => {
      if (!text) return text;

      let processed = text;
      variables.forEach((variable) => {
        const value = previewData[variable.name] || variable.defaultValue || `{{${variable.name}}}`;
        const regex = new RegExp(`{{\\s*${variable.name}\\s*}}`, "g");
        processed = processed.replace(regex, String(value));
      });

      return processed;
    };

    return {
      subject: replaceVariables(currentContent.subject || ""),
      preheader: replaceVariables(currentContent.preheader || ""),
      body: replaceVariables(currentContent.body || ""),
      plainText: replaceVariables(currentContent.plainText || ""),
      pushTitle: replaceVariables(currentContent.pushTitle || ""),
      pushBody: replaceVariables(currentContent.pushBody || ""),
      smsBody: replaceVariables(currentContent.smsBody || ""),
      voiceScript: replaceVariables(currentContent.voiceScript || ""),
    };
  }, [currentContent, variables, previewData]);

  const handleVariableChange = (variableName: string, value: any) => {
    onPreviewDataChange({
      ...previewData,
      [variableName]: value,
    });
  };

  const handleSendTest = () => {
    if (!testEmail) return;

    console.log("Sending test to:", testEmail, "with data:", previewData);
  };

  const EmailPreview = () => (
    <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
      <div className="bg-gray-50 p-4 border-b">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <EnvelopeIcon className="h-4 w-4" />
            <span>Email Preview</span>
          </div>
          <Badge variant="outline">HTML</Badge>
        </div>
      </div>

      <div className="p-4 border-b bg-blue-50">
        <div className="text-sm text-gray-600 mb-1">Subject:</div>
        <div className="font-medium">{processedContent.subject || "No subject"}</div>
        {processedContent.preheader && (
          <>
            <div className="text-sm text-gray-600 mt-2 mb-1">Preheader:</div>
            <div className="text-sm text-gray-500">{processedContent.preheader}</div>
          </>
        )}
      </div>

      <div className="p-6">
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: processedContent.body }}
        />
      </div>
    </div>
  );

  const SMSPreview = () => (
    <div className="bg-white border rounded-lg overflow-hidden shadow-sm max-w-sm mx-auto">
      <div className="bg-gray-50 p-3 border-b">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <ChatBubbleLeftRightIcon className="h-4 w-4" />
          <span>SMS Preview</span>
        </div>
      </div>

      <div className="p-4">
        <div className="bg-blue-500 text-white p-3 rounded-lg rounded-br-sm max-w-xs ml-auto">
          <div className="text-sm whitespace-pre-wrap">
            {processedContent.smsBody || "No message content"}
          </div>
          <div className="text-xs opacity-75 mt-1">
            {processedContent.smsBody?.length || 0}/160 characters
          </div>
        </div>
      </div>
    </div>
  );

  const PushPreview = () => (
    <div className="bg-white border rounded-lg overflow-hidden shadow-sm max-w-sm mx-auto">
      <div className="bg-gray-50 p-3 border-b">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <BellIcon className="h-4 w-4" />
          <span>Push Notification Preview</span>
        </div>
      </div>

      <div className="p-4">
        <div className="bg-gray-100 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <BellIcon className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">
                {processedContent.pushTitle || "No title"}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {processedContent.pushBody || "No message content"}
              </div>
              <div className="text-xs text-gray-400 mt-2">now</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const InAppPreview = () => (
    <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
      <div className="bg-gray-50 p-3 border-b">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <BellIcon className="h-4 w-4" />
          <span>In-App Message Preview</span>
        </div>
      </div>

      <div className="p-6">
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: processedContent.body }}
        />
      </div>
    </div>
  );

  const VoicePreview = () => (
    <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
      <div className="bg-gray-50 p-3 border-b">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <PhoneIcon className="h-4 w-4" />
          <span>Voice Call Script Preview</span>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm font-mono whitespace-pre-wrap">
            {processedContent.voiceScript || "No script content"}
          </div>
        </div>
      </div>
    </div>
  );

  const renderPreview = () => {
    switch (currentChannel) {
      case "email":
        return <EmailPreview />;
      case "sms":
        return <SMSPreview />;
      case "push":
        return <PushPreview />;
      case "in_app":
        return <InAppPreview />;
      case "voice":
        return <VoicePreview />;
      default:
        return <EmailPreview />;
    }
  };

  const ChannelIcon = channelIcons[currentChannel as CommunicationChannel];

  return (
    <div className={cn("space-y-6", className)}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ChannelIcon className="h-5 w-5" />
              <CardTitle>Template Preview</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {currentChannel === "email" && (
                <>
                  <Button
                    variant={selectedDevice === "mobile" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedDevice("mobile")}
                  >
                    <DevicePhoneMobileIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={selectedDevice === "tablet" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedDevice("tablet")}
                  >
                    <DeviceTabletIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={selectedDevice === "desktop" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedDevice("desktop")}
                  >
                    <ComputerDesktopIcon className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
          <CardDescription>See how your template will look to recipients</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="preview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="variables">Test Data</TabsTrigger>
              <TabsTrigger value="test">Send Test</TabsTrigger>
            </TabsList>

            <TabsContent value="preview" className="mt-6">
              <div
                className="mx-auto transition-all duration-200"
                style={{
                  width: deviceSizes[selectedDevice].width,
                  maxWidth: "100%",
                }}
              >
                {renderPreview()}
              </div>
            </TabsContent>

            <TabsContent value="variables" className="mt-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-3">Test Variable Values</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Enter test values for your variables to see how they appear in the preview
                  </p>
                </div>

                {variables.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {variables.map((variable) => (
                      <div key={variable.name} className="space-y-2">
                        <Label htmlFor={`var-${variable.name}`}>
                          {variable.name}
                          {variable.required && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        <Input
                          id={`var-${variable.name}`}
                          type={
                            variable.type === "number"
                              ? "number"
                              : variable.type === "date"
                                ? "date"
                                : variable.type === "email"
                                  ? "email"
                                  : variable.type === "url"
                                    ? "url"
                                    : "text"
                          }
                          value={previewData[variable.name] || ""}
                          onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                          placeholder={variable.defaultValue || `Enter ${variable.name}`}
                        />
                        {variable.description && (
                          <p className="text-xs text-muted-foreground">{variable.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No variables defined for this template.</p>
                    <p className="text-sm">
                      Add variables in the Variables tab to make your template dynamic.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="test" className="mt-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-3">Send Test Message</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Send a test version of this template to verify how it looks and works
                  </p>
                </div>

                <div className="max-w-md space-y-4">
                  <div>
                    <Label htmlFor="test-email">
                      {currentChannel === "email"
                        ? "Email Address"
                        : currentChannel === "sms"
                          ? "Phone Number"
                          : "Test Recipient"}
                    </Label>
                    <Input
                      id="test-email"
                      type={currentChannel === "email" ? "email" : "text"}
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder={
                        currentChannel === "email"
                          ? "test@example.com"
                          : currentChannel === "sms"
                            ? "+1234567890"
                            : "Enter recipient"
                      }
                    />
                  </div>

                  <Button onClick={handleSendTest} disabled={!testEmail} className="w-full">
                    <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                    Send Test {currentChannel.charAt(0).toUpperCase() + currentChannel.slice(1)}
                  </Button>
                </div>

                <Separator />

                <div className="text-sm text-muted-foreground">
                  <h5 className="font-medium mb-2">Preview Summary:</h5>
                  <ul className="space-y-1">
                    <li>• Channel: {currentChannel.toUpperCase()}</li>
                    <li>• Variables: {variables.length}</li>
                    {currentChannel === "email" && (
                      <>
                        <li>• Subject: {processedContent.subject || "Not set"}</li>
                        <li>• Has preheader: {processedContent.preheader ? "Yes" : "No"}</li>
                      </>
                    )}
                    {currentChannel === "sms" && (
                      <li>• Character count: {processedContent.smsBody?.length || 0}/160</li>
                    )}
                  </ul>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
