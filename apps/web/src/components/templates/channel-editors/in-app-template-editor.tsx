"use client";

import { Badge } from "@sanarwa/ui/badge";
import { Button } from "@sanarwa/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@sanarwa/ui/card";
import { Input } from "@sanarwa/ui/input";
import { Label } from "@sanarwa/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@sanarwa/ui/select";
import type { TemplateVariable } from "@/lib/types/template";
import { EyeIcon, Cog6ToothIcon, ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { RichTextEditor } from "../rich-text-editor";

interface InAppTemplateEditorProps {
  content?: string;
  variables?: TemplateVariable[];
  onChange?: (value: string) => void;
}

type MessageType = "banner" | "modal" | "toast" | "sidebar" | "fullscreen";
type MessagePosition =
  | "top"
  | "bottom"
  | "center"
  | "top-right"
  | "top-left"
  | "bottom-right"
  | "bottom-left"
  | "left"
  | "right";
type MessageStyle = "info" | "success" | "warning" | "error" | "neutral";

export function InAppTemplateEditor({
  content = "",
  variables = [],
  onChange,
}: InAppTemplateEditorProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [messageType, setMessageType] = useState<MessageType>("banner");
  const [position, setPosition] = useState<MessagePosition>("top");
  const [style, setStyle] = useState<MessageStyle>("info");
  const [title, setTitle] = useState("");
  const [actionText, setActionText] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [dismissible, setDismissible] = useState(true);
  const [autoClose, setAutoClose] = useState(false);
  const [autoCloseDelay, setAutoCloseDelay] = useState(5000);

  const insertVariable = (variable: string) => {
    const variableText = `{{${variable}}}`;
    onChange?.(content + variableText);
  };

  const messageTypeOptions = [
    { value: "banner", label: "Banner", description: "Top or bottom banner across the page" },
    { value: "modal", label: "Modal", description: "Centered overlay that blocks interaction" },
    { value: "toast", label: "Toast", description: "Small notification in corner" },
    { value: "sidebar", label: "Sidebar", description: "Side panel that slides in" },
    { value: "fullscreen", label: "Fullscreen", description: "Full page overlay" },
  ];

  const positionOptions = {
    banner: ["top", "bottom"],
    modal: ["center"],
    toast: ["top-right", "top-left", "bottom-right", "bottom-left"],
    sidebar: ["left", "right"],
    fullscreen: ["center"],
  };

  const styleOptions = [
    { value: "info", label: "Info", color: "bg-blue-500" },
    { value: "success", label: "Success", color: "bg-green-500" },
    { value: "warning", label: "Warning", color: "bg-yellow-500" },
    { value: "error", label: "Error", color: "bg-red-500" },
    { value: "neutral", label: "Neutral", color: "bg-gray-500" },
  ];

  const renderPreview = () => {
    const baseClasses = "border rounded-lg p-4 shadow-lg max-w-md";
    const styleClasses = {
      info: "border-blue-200 bg-blue-50 text-blue-900",
      success: "border-green-200 bg-green-50 text-green-900",
      warning: "border-yellow-200 bg-yellow-50 text-yellow-900",
      error: "border-red-200 bg-red-50 text-red-900",
      neutral: "border-gray-200 bg-gray-50 text-gray-900",
    };

    const messageContent = (
      <div className={`${baseClasses} ${styleClasses[style]}`}>
        {dismissible && (
          <div className="flex justify-end mb-2">
            <button className="text-gray-400 hover:text-gray-600">×</button>
          </div>
        )}

        {title && <h3 className="font-semibold text-lg mb-2">{title}</h3>}

        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{
            __html: content || "<p>Your in-app message content will appear here...</p>",
          }}
        />

        {actionText && (
          <div className="mt-4">
            <Button size="sm" className="w-full">
              {actionText}
            </Button>
          </div>
        )}

        {autoClose && (
          <div className="mt-2 text-xs opacity-75">Auto-closes in {autoCloseDelay / 1000}s</div>
        )}
      </div>
    );

    switch (messageType) {
      case "banner":
        return (
          <div className="w-full">
            <div className={position === "top" ? "mb-4" : "mt-4"}>
              <div className="w-full bg-blue-500 text-white p-3 rounded">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {title && <div className="font-medium">{title}</div>}
                    <div
                      dangerouslySetInnerHTML={{ __html: content || "Banner message content" }}
                    />
                  </div>
                  {actionText && (
                    <Button variant="secondary" size="sm" className="ml-4">
                      {actionText}
                    </Button>
                  )}
                  {dismissible && (
                    <button className="ml-2 text-white/80 hover:text-white">×</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case "modal":
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
            {messageContent}
          </div>
        );

      case "toast":
        return (
          <div
            className={`fixed ${position.includes("top") ? "top-4" : "bottom-4"} ${position.includes("right") ? "right-4" : "left-4"}`}
          >
            {messageContent}
          </div>
        );

      case "sidebar":
        return (
          <div
            className={`fixed top-0 ${position === "left" ? "left-0" : "right-0"} h-full w-80 bg-white shadow-xl p-4 border-l`}
          >
            <div className="space-y-4">
              {dismissible && (
                <div className="flex justify-end">
                  <button className="text-gray-400 hover:text-gray-600">×</button>
                </div>
              )}
              {title && <h3 className="font-semibold text-xl">{title}</h3>}
              <div dangerouslySetInnerHTML={{ __html: content || "Sidebar content" }} />
              {actionText && <Button className="w-full">{actionText}</Button>}
            </div>
          </div>
        );

      case "fullscreen":
        return (
          <div className="fixed inset-0 bg-white flex items-center justify-center p-8">
            <div className="max-w-2xl w-full text-center space-y-6">
              {dismissible && (
                <div className="flex justify-end">
                  <button className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
                </div>
              )}
              {title && <h1 className="text-4xl font-bold">{title}</h1>}
              <div
                className="text-lg"
                dangerouslySetInnerHTML={{ __html: content || "Fullscreen message content" }}
              />
              {actionText && (
                <Button size="lg" className="px-8">
                  {actionText}
                </Button>
              )}
            </div>
          </div>
        );

      default:
        return messageContent;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cog6ToothIcon className="h-4 w-4" />
            Message Configuration
          </CardTitle>
          <CardDescription>
            Configure the type, position, and style of your in-app message
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Message Type</Label>
              <Select
                value={messageType}
                onValueChange={(value: MessageType) => setMessageType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {messageTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Position</Label>
              <Select
                value={position}
                onValueChange={(value: MessagePosition) => setPosition(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(positionOptions[messageType] || ["center"]).map((pos) => (
                    <SelectItem key={pos} value={pos}>
                      {pos.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Style</Label>
              <Select value={style} onValueChange={(value: MessageStyle) => setStyle(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {styleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${option.color}`} />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Message Title (Optional)</Label>
          <div className="flex gap-1">
            {variables.map((variable) => (
              <Button
                key={variable.name}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTitle(title + `{{${variable.name}}}`)}
                className="text-xs"
              >
                {variable.name}
              </Button>
            ))}
          </div>
        </div>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Optional title for your message"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Message Content</Label>
          <div className="flex gap-1">
            {variables.map((variable) => (
              <Button
                key={variable.name}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertVariable(variable.name)}
                className="text-xs"
              >
                {variable.name}
              </Button>
            ))}
          </div>
        </div>
        <RichTextEditor
          content={content}
          onChange={onChange}
          variables={variables}
          placeholder="Write your in-app message content..."
          className="min-h-[200px]"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Call-to-Action</CardTitle>
          <CardDescription>Add an optional action button to your message</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Button Text</Label>
              <Input
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                placeholder="Learn More"
              />
            </div>
            <div>
              <Label>Action URL</Label>
              <Input
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Behavior Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Dismissible</Label>
              <p className="text-sm text-muted-foreground">Allow users to close the message</p>
            </div>
            <input
              type="checkbox"
              checked={dismissible}
              onChange={(e) => setDismissible(e.target.checked)}
              className="rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-close</Label>
              <p className="text-sm text-muted-foreground">Automatically close after a delay</p>
            </div>
            <input
              type="checkbox"
              checked={autoClose}
              onChange={(e) => setAutoClose(e.target.checked)}
              className="rounded"
            />
          </div>

          {autoClose && (
            <div>
              <Label>Auto-close Delay (ms)</Label>
              <Input
                type="number"
                value={autoCloseDelay}
                onChange={(e) => setAutoCloseDelay(Number(e.target.value))}
                min={1000}
                max={30000}
                step={1000}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChatBubbleLeftRightIcon className="h-4 w-4" />
            In-App Message Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              <EyeIcon className="h-4 w-4 mr-2" />
              {showPreview ? "Hide Preview" : "Show Preview"}
            </Button>
            <Badge variant="secondary">
              {messageType} • {position} • {style}
            </Badge>
          </div>

          {showPreview && (
            <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-[300px] bg-gray-50">
              <div className="absolute inset-2 bg-white rounded border overflow-hidden">
                <div className="p-4 space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>

                <div className="absolute inset-0">{renderPreview()}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">In-App Message Best Practices</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• Use in-app messages for contextual, timely information</li>
            <li>• Keep messages concise and actionable</li>
            <li>• Choose the right message type for your content</li>
            <li>• Test different positions and styles for optimal engagement</li>
            <li>• Provide clear value in every message</li>
            <li>• Consider user workflow when timing messages</li>
            <li>• Use rich formatting sparingly to maintain readability</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
