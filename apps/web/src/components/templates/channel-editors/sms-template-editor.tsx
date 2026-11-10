"use client";

import { Phone } from "@/lib/icons";

import { Badge } from "@sanarwa/ui/badge";
import { Button } from "@sanarwa/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@sanarwa/ui/card";
import { Label } from "@sanarwa/ui/label";
import { Textarea } from "@sanarwa/ui/textarea";
import type { TemplateVariable } from "@/lib/types/template";
import {
  ExclamationCircleIcon,
  CheckCircleIcon,
  ChatBubbleLeftRightIcon,
  DevicePhoneMobileIcon,
} from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";

interface SmsTemplateEditorProps {
  content?: string;
  variables?: TemplateVariable[];
  onChange?: (value: string) => void;
}

export function SmsTemplateEditor({
  content = "",
  variables = [],
  onChange,
}: SmsTemplateEditorProps) {
  const [showPreview, setShowPreview] = useState(false);

  const smsAnalysis = useMemo(() => {
    const length = content.length;
    const singleSmsLimit = 160;
    const multiSmsLimit = 153;

    let messageCount = 1;
    let charactersRemaining = singleSmsLimit - length;

    if (length > singleSmsLimit) {
      messageCount = Math.ceil(length / multiSmsLimit);
      charactersRemaining = messageCount * multiSmsLimit - length;
    }

    const isOverLimit = length > messageCount * multiSmsLimit;
    const cost = messageCount;

    return {
      length,
      messageCount,
      charactersRemaining: isOverLimit ? 0 : charactersRemaining,
      isOverLimit,
      cost,
      isOptimal: length <= singleSmsLimit,
    };
  }, [content]);

  const insertVariable = (variable: string) => {
    const variableText = `{{${variable}}}`;
    const newContent = content + variableText;
    onChange?.(newContent);
  };

  const insertAtCursor = (text: string) => {
    onChange?.(content + text);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label htmlFor="smsContent">SMS Message</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              <DevicePhoneMobileIcon className="h-4 w-4 mr-2" />
              {showPreview ? "Hide Preview" : "Show Preview"}
            </Button>
          </div>
        </div>

        <Textarea
          id="smsContent"
          value={content}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="Write your SMS message here..."
          rows={6}
          className="resize-none"
        />

        <div className="mt-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span
              className={`font-medium ${smsAnalysis.isOverLimit ? "text-destructive" : "text-muted-foreground"}`}
            >
              {smsAnalysis.length} characters
            </span>
            <span className="text-muted-foreground">
              {smsAnalysis.messageCount} message{smsAnalysis.messageCount > 1 ? "s" : ""}
            </span>
            <span className="text-muted-foreground">
              Cost: {smsAnalysis.cost} credit{smsAnalysis.cost > 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {smsAnalysis.isOptimal ? (
              <Badge variant="secondary" className="text-green-600">
                <CheckCircleIcon className="h-3 w-3 mr-1" />
                Optimal
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-orange-600">
                <ExclamationCircleIcon className="h-3 w-3 mr-1" />
                Multi-part
              </Badge>
            )}
            <span className="text-muted-foreground">
              {smsAnalysis.charactersRemaining} remaining
            </span>
          </div>
        </div>

        {smsAnalysis.messageCount > 1 && (
          <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start gap-2">
              <ExclamationCircleIcon className="h-4 w-4 text-orange-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-orange-800">Multi-part SMS</p>
                <p className="text-orange-700">
                  Your message will be sent as {smsAnalysis.messageCount} separate SMS messages,
                  costing {smsAnalysis.cost} credits total.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {variables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Insert Variables</CardTitle>
            <CardDescription>
              Click to insert personalization variables into your message
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {variables.map((variable) => (
                <Button
                  key={variable.name}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertVariable(variable.name)}
                  className="text-xs"
                  title={variable.description}
                >
                  {variable.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
          <CardDescription>Common SMS elements you can add to your message</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => insertAtCursor(" STOP to opt out")}
            >
              Add Opt-out
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => insertAtCursor(" Reply HELP for info")}
            >
              Add Help Info
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => insertAtCursor(" Click: ")}
            >
              Add Link Prefix
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => insertAtCursor(" Call: ")}
            >
              Add Phone Prefix
            </Button>
          </div>
        </CardContent>
      </Card>

      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChatBubbleLeftRightIcon className="h-4 w-4" />
              SMS Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-sm mx-auto">
              <div className="bg-gray-900 rounded-3xl p-2">
                <div className="bg-white rounded-2xl p-4 min-h-[200px]">
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      B
                    </div>
                    <div>
                      <div className="font-medium text-sm">Your Business</div>
                      <div className="text-xs text-gray-500">SMS</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm p-3 max-w-[80%]">
                      <p className="text-sm whitespace-pre-wrap">
                        {content || "Your SMS message will appear here..."}
                      </p>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SMS Best Practices</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• Keep messages under 160 characters when possible</li>
            <li>• Include your business name for identification</li>
            <li>• Always provide opt-out instructions (STOP)</li>
            <li>• Use clear, actionable language</li>
            <li>• Avoid excessive punctuation and ALL CAPS</li>
            <li>• Include time-sensitive information when relevant</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
