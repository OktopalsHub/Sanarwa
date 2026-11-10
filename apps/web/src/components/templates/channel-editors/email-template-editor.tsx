"use client";

import { Button } from "@sanarwa/ui/button";
import { Input } from "@sanarwa/ui/input";
import { Label } from "@sanarwa/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@sanarwa/ui/tabs";
import { Textarea } from "@sanarwa/ui/textarea";
import type { TemplateVariable } from "@/lib/types/template";
import { CodeBracketIcon, EyeIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { RichTextEditor } from "../rich-text-editor";

interface EmailTemplateEditorProps {
  subject?: string;
  preheader?: string;
  body?: string;
  plainText?: string;
  variables?: TemplateVariable[];
  onSubjectChange?: (value: string) => void;
  onPreheaderChange?: (value: string) => void;
  onBodyChange?: (value: string) => void;
  onPlainTextChange?: (value: string) => void;
}

export function EmailTemplateEditor({
  subject = "",
  preheader = "",
  body = "",
  plainText = "",
  variables = [],
  onSubjectChange,
  onPreheaderChange,
  onBodyChange,
  onPlainTextChange,
}: EmailTemplateEditorProps) {
  const [activeTab, setActiveTab] = useState("visual");
  const [showPreview, setShowPreview] = useState(false);

  const insertVariable = (
    field: "subject" | "preheader" | "body" | "plainText",
    variable: string,
  ) => {
    const variableText = `{{${variable}}}`;

    switch (field) {
      case "subject":
        onSubjectChange?.(subject + variableText);
        break;
      case "preheader":
        onPreheaderChange?.(preheader + variableText);
        break;
      case "body":
        onBodyChange?.(body + variableText);
        break;
      case "plainText":
        onPlainTextChange?.(plainText + variableText);
        break;
    }
  };

  const generatePlainText = () => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = body;
    const plainTextContent = tempDiv.textContent || tempDiv.innerText || "";
    onPlainTextChange?.(plainTextContent);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label htmlFor="subject">Subject Line</Label>
            <div className="flex gap-1">
              {variables.map((variable) => (
                <Button
                  key={variable.name}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertVariable("subject", variable.name)}
                  className="text-xs"
                >
                  {variable.name}
                </Button>
              ))}
            </div>
          </div>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => onSubjectChange?.(e.target.value)}
            placeholder="Enter email subject line"
            className="font-medium"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Keep it under 50 characters for better deliverability
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label htmlFor="preheader">Preheader Text</Label>
            <div className="flex gap-1">
              {variables.map((variable) => (
                <Button
                  key={variable.name}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertVariable("preheader", variable.name)}
                  className="text-xs"
                >
                  {variable.name}
                </Button>
              ))}
            </div>
          </div>
          <Input
            id="preheader"
            value={preheader}
            onChange={(e) => onPreheaderChange?.(e.target.value)}
            placeholder="Preview text that appears after the subject line"
          />
          <p className="text-xs text-muted-foreground mt-1">
            This text appears in email previews. Keep it under 90 characters.
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <Label>Email Body</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              <EyeIcon className="h-4 w-4 mr-2" />
              {showPreview ? "Hide Preview" : "Show Preview"}
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="visual" className="flex items-center gap-2">
              <DocumentTextIcon className="h-4 w-4" />
              Visual Editor
            </TabsTrigger>
            <TabsTrigger value="html" className="flex items-center gap-2">
              <CodeBracketIcon className="h-4 w-4" />
              HTML Editor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="visual" className="mt-4">
            <RichTextEditor
              content={body}
              onChange={onBodyChange}
              variables={variables}
              placeholder="Write your email content using the rich text editor..."
              className="min-h-[400px]"
            />
          </TabsContent>

          <TabsContent value="html" className="mt-4">
            <div className="space-y-4">
              <Textarea
                value={body}
                onChange={(e) => onBodyChange?.(e.target.value)}
                placeholder="Enter HTML content..."
                className="font-mono text-sm min-h-[400px]"
              />
              <div className="flex gap-2">
                {variables.map((variable) => (
                  <Button
                    key={variable.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertVariable("body", variable.name)}
                    className="text-xs"
                  >
                    {variable.name}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label htmlFor="plainText">Plain Text Version</Label>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={generatePlainText}>
              Generate from HTML
            </Button>
            <div className="flex gap-1">
              {variables.map((variable) => (
                <Button
                  key={variable.name}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertVariable("plainText", variable.name)}
                  className="text-xs"
                >
                  {variable.name}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <Textarea
          id="plainText"
          value={plainText}
          onChange={(e) => onPlainTextChange?.(e.target.value)}
          placeholder="Plain text version for email clients that don't support HTML"
          rows={8}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Fallback version for email clients that don't support HTML formatting
        </p>
      </div>

      {showPreview && (
        <div className="border rounded-lg p-4 bg-muted/50">
          <h4 className="font-medium mb-4">Email Preview</h4>
          <div className="space-y-2 mb-4">
            <div className="text-sm">
              <span className="font-medium">Subject:</span> {subject || "No subject"}
            </div>
            {preheader && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Preheader:</span> {preheader}
              </div>
            )}
          </div>
          <div
            className="prose prose-sm max-w-none border rounded p-4 bg-background"
            dangerouslySetInnerHTML={{ __html: body || "<p>No content</p>" }}
          />
        </div>
      )}
    </div>
  );
}
