"use client";

import { Badge } from "@sanarwa/ui/badge";
import { Button } from "@sanarwa/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@sanarwa/ui/card";
import { Input } from "@sanarwa/ui/input";
import { Label } from "@sanarwa/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@sanarwa/ui/select";
import { Textarea } from "@sanarwa/ui/textarea";
import type { TemplateVariable } from "@/lib/types/template";
import {
  ExclamationCircleIcon,
  BellIcon,
  CheckCircleIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
} from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";

interface PushTemplateEditorProps {
  title?: string;
  body?: string;
  variables?: TemplateVariable[];
  onTitleChange?: (value: string) => void;
  onBodyChange?: (value: string) => void;
}

export function PushTemplateEditor({
  title = "",
  body = "",
  variables = [],
  onTitleChange,
  onBodyChange,
}: PushTemplateEditorProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState<"ios" | "android" | "web">("ios");
  const [iconUrl, setIconUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [actionButtons, setActionButtons] = useState<Array<{ text: string; action: string }>>([]);

  const pushAnalysis = useMemo(() => {
    const titleLimit = 50;
    const bodyLimit = 120;

    return {
      title: {
        length: title.length,
        limit: titleLimit,
        remaining: titleLimit - title.length,
        isOverLimit: title.length > titleLimit,
      },
      body: {
        length: body.length,
        limit: bodyLimit,
        remaining: bodyLimit - body.length,
        isOverLimit: body.length > bodyLimit,
      },
    };
  }, [title, body]);

  const insertVariable = (field: "title" | "body", variable: string) => {
    const variableText = `{{${variable}}}`;

    if (field === "title") {
      onTitleChange?.(title + variableText);
    } else {
      onBodyChange?.(body + variableText);
    }
  };

  const addActionButton = () => {
    if (actionButtons.length < 3) {
      setActionButtons([...actionButtons, { text: "", action: "" }]);
    }
  };

  const updateActionButton = (index: number, field: "text" | "action", value: string) => {
    const updated = [...actionButtons];
    if (updated[index]) {
      updated[index][field] = value;
      setActionButtons(updated);
    }
  };

  const removeActionButton = (index: number) => {
    setActionButtons(actionButtons.filter((_, i) => i !== index));
  };

  const renderPreview = () => {
    const commonContent = (
      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {iconUrl ? (
              <img src={iconUrl} alt="App icon" className="w-full h-full rounded-lg object-cover" />
            ) : (
              "A"
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">Your App</span>
              <span className="text-xs text-gray-500">now</span>
            </div>
            <div className="font-medium text-sm leading-tight mb-1">
              {title || "Notification title"}
            </div>
            <div className="text-sm text-gray-600 leading-tight">
              {body || "Notification message body"}
            </div>
          </div>
        </div>

        {imageUrl && (
          <div className="mt-2">
            <img
              src={imageUrl}
              alt="Notification image"
              className="w-full h-32 object-cover rounded-lg"
            />
          </div>
        )}

        {actionButtons.length > 0 && (
          <div className="flex gap-2 mt-3">
            {actionButtons.map((button, index) => (
              <Button key={index} variant="outline" size="sm" className="text-xs" disabled>
                {button.text || `Action ${index + 1}`}
              </Button>
            ))}
          </div>
        )}
      </div>
    );

    switch (previewPlatform) {
      case "ios":
        return (
          <div className="bg-gray-100 rounded-2xl p-4 max-w-sm mx-auto">
            <div className="bg-white rounded-xl p-3 shadow-sm border">{commonContent}</div>
          </div>
        );

      case "android":
        return (
          <div className="bg-gray-900 rounded-lg p-4 max-w-sm mx-auto">
            <div className="bg-gray-800 rounded-lg p-3 text-white">{commonContent}</div>
          </div>
        );

      case "web":
        return (
          <div className="bg-white border rounded-lg p-4 max-w-sm mx-auto shadow-lg">
            {commonContent}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label htmlFor="pushTitle">Notification Title</Label>
          <div className="flex gap-1">
            {variables.map((variable) => (
              <Button
                key={variable.name}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertVariable("title", variable.name)}
                className="text-xs"
              >
                {variable.name}
              </Button>
            ))}
          </div>
        </div>
        <Input
          id="pushTitle"
          value={title}
          onChange={(e) => onTitleChange?.(e.target.value)}
          placeholder="Enter notification title"
          className="font-medium"
        />
        <div className="flex items-center justify-between mt-1 text-xs">
          <span
            className={
              pushAnalysis.title.isOverLimit ? "text-destructive" : "text-muted-foreground"
            }
          >
            {pushAnalysis.title.length}/{pushAnalysis.title.limit} characters
          </span>
          {pushAnalysis.title.isOverLimit ? (
            <Badge variant="destructive" className="text-xs">
              <ExclamationCircleIcon className="h-3 w-3 mr-1" />
              Too long
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs text-green-600">
              <CheckCircleIcon className="h-3 w-3 mr-1" />
              Good
            </Badge>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label htmlFor="pushBody">Notification Message</Label>
          <div className="flex gap-1">
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
        <Textarea
          id="pushBody"
          value={body}
          onChange={(e) => onBodyChange?.(e.target.value)}
          placeholder="Enter notification message"
          rows={3}
        />
        <div className="flex items-center justify-between mt-1 text-xs">
          <span
            className={pushAnalysis.body.isOverLimit ? "text-destructive" : "text-muted-foreground"}
          >
            {pushAnalysis.body.length}/{pushAnalysis.body.limit} characters
          </span>
          {pushAnalysis.body.isOverLimit ? (
            <Badge variant="destructive" className="text-xs">
              <ExclamationCircleIcon className="h-3 w-3 mr-1" />
              Too long
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs text-green-600">
              <CheckCircleIcon className="h-3 w-3 mr-1" />
              Good
            </Badge>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Advanced Options</CardTitle>
          <CardDescription>
            Customize the appearance and behavior of your push notification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="iconUrl">App Icon URL</Label>
              <Input
                id="iconUrl"
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                placeholder="https://example.com/icon.png"
              />
            </div>
            <div>
              <Label htmlFor="imageUrl">Large Image URL</Label>
              <Input
                id="imageUrl"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Action Buttons</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addActionButton}
                disabled={actionButtons.length >= 3}
              >
                Add Button
              </Button>
            </div>
            <div className="space-y-2">
              {actionButtons.map((button, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Button text"
                    value={button.text}
                    onChange={(e) => updateActionButton(index, "text", e.target.value)}
                  />
                  <Input
                    placeholder="Action URL"
                    value={button.action}
                    onChange={(e) => updateActionButton(index, "action", e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeActionButton(index)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellIcon className="h-4 w-4" />
            Push Notification Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Label>Platform:</Label>
            <Select
              value={previewPlatform}
              onValueChange={(value: "ios" | "android" | "web") => setPreviewPlatform(value)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ios">
                  <div className="flex items-center gap-2">
                    <DevicePhoneMobileIcon className="h-4 w-4" />
                    iOS
                  </div>
                </SelectItem>
                <SelectItem value="android">
                  <div className="flex items-center gap-2">
                    <DevicePhoneMobileIcon className="h-4 w-4" />
                    Android
                  </div>
                </SelectItem>
                <SelectItem value="web">
                  <div className="flex items-center gap-2">
                    <ComputerDesktopIcon className="h-4 w-4" />
                    Web
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? "Hide Preview" : "Show Preview"}
            </Button>
          </div>

          {showPreview && renderPreview()}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Push Notification Best Practices</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• Keep titles under 50 characters for better visibility</li>
            <li>• Write clear, actionable messages under 120 characters</li>
            <li>• Use personalization to increase engagement</li>
            <li>• Include relevant emojis sparingly for visual appeal</li>
            <li>• Test on different devices and platforms</li>
            <li>• Consider time zones when scheduling notifications</li>
            <li>• Provide clear value in every notification</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
