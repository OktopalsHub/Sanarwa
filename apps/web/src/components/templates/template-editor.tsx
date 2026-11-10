"use client";

import { Badge } from "@sanarwa/ui/badge";
import { Button } from "@sanarwa/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@sanarwa/ui/card";
import { Input } from "@sanarwa/ui/input";
import { Label } from "@sanarwa/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@sanarwa/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@sanarwa/ui/tabs";
import { Textarea } from "@sanarwa/ui/textarea";
import { templateApi } from "@sanarwa/api-client";
import type {
  CommunicationChannel,
  CreateTemplateRequest,
  Template,
  TemplateCategory,
  TemplateVariable,
  UpdateTemplateRequest,
} from "@/lib/types/template";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EyeIcon,
  BookmarkIcon,
  Cog6ToothIcon,
  TagIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  EmailTemplateEditor,
  InAppTemplateEditor,
  PushTemplateEditor,
  SmsTemplateEditor,
  VoiceTemplateEditor,
} from "./channel-editors";
import { TemplatePreview } from "./template-preview";
import { PersonalizationPreview, VariableManager } from "./variable-system";

const templateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  category: z.enum([
    "welcome",
    "promotional",
    "transactional",
    "notification",
    "reminder",
    "custom",
  ]),
  channel: z.enum(["email", "sms", "push", "in_app", "voice"]),
  subject: z.string().optional(),
  preheader: z.string().optional(),
  body: z.string().min(1, "Template body is required"),
  plainText: z.string().optional(),
  pushTitle: z.string().optional(),
  pushBody: z.string().optional(),
  smsBody: z.string().optional(),
  voiceScript: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
});

type TemplateFormData = z.infer<typeof templateSchema>;

interface TemplateEditorProps {
  templateId?: string;
  initialChannel?: CommunicationChannel;
  onSave?: (template: Template) => void;
  onCancel?: () => void;
  className?: string;
}

const categoryLabels = {
  welcome: "Welcome",
  promotional: "Promotional",
  transactional: "Transactional",
  notification: "Notification",
  reminder: "Reminder",
  custom: "Custom",
};

const channelLabels = {
  email: "Email",
  sms: "SMS",
  push: "Push Notification",
  in_app: "In-App Message",
  voice: "Voice Call",
};

export function TemplateEditor({
  templateId,
  initialChannel = "email",
  onSave,
  onCancel,
  className,
}: TemplateEditorProps) {
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [newTag, setNewTag] = useState("");
  const [previewData, setPreviewData] = useState<Record<string, any>>({});
  const [showPreview, setShowPreview] = useState(false);
  const queryClient = useQueryClient();

  const { data: template, isLoading } = useQuery({
    queryKey: ["template", templateId],
    queryFn: () => templateApi.getTemplate(templateId!),
    enabled: !!templateId,
  });

  const { data: existingTags = [] } = useQuery({
    queryKey: ["template-tags"],
    queryFn: () => templateApi.getTags(),
  });

  const form = useForm({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "custom",
      channel: initialChannel,
      subject: "",
      preheader: "",
      body: "",
      plainText: "",
      pushTitle: "",
      pushBody: "",
      smsBody: "",
      voiceScript: "",
      tags: [],
    },
  });

  const { watch, setValue, getValues } = form;
  const selectedChannel = watch("channel");
  const currentTags = watch("tags");

  useEffect(() => {
    if (template) {
      form.reset({
        name: template.name,
        description: template.description || "",
        category: template.category,
        channel: template.channel,
        subject: template.content.subject || "",
        preheader: template.content.preheader || "",
        body: template.content.body,
        plainText: template.content.plainText || "",
        pushTitle: template.content.pushTitle || "",
        pushBody: template.content.pushBody || "",
        smsBody: template.content.smsBody || "",
        voiceScript: template.content.voiceScript || "",
        tags: template.tags,
      });
      setVariables(template.variables);
    }
  }, [template, form]);

  const createMutation = useMutation({
    mutationFn: (data: CreateTemplateRequest) => templateApi.createTemplate(data),
    onSuccess: (newTemplate) => {
      toast.success("Template created successfully");
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      onSave?.(newTemplate);
    },
    onError: (error) => {
      toast.error("Failed to create template");
      console.error("Create template error:", error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateTemplateRequest) => templateApi.updateTemplate(data),
    onSuccess: (updatedTemplate) => {
      toast.success("Template updated successfully");
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["template", templateId] });
      onSave?.(updatedTemplate);
    },
    onError: (error) => {
      toast.error("Failed to update template");
      console.error("Update template error:", error);
    },
  });

  const previewMutation = useMutation({
    mutationFn: (variables: Record<string, any>) =>
      templateApi.previewTemplate(templateId!, variables),
    onSuccess: (preview) => {
      setShowPreview(true);
    },
    onError: (error) => {
      toast.error("Failed to generate preview");
      console.error("Preview error:", error);
    },
  });

  const handleSave = (data: any) => {
    const content = {
      subject: data.subject,
      preheader: data.preheader,
      body: data.body,
      plainText: data.plainText,
      pushTitle: data.pushTitle,
      pushBody: data.pushBody,
      smsBody: data.smsBody,
      voiceScript: data.voiceScript,
    };

    if (templateId) {
      updateMutation.mutate({
        id: templateId,
        name: data.name,
        description: data.description,
        category: data.category,
        channel: data.channel,
        content,
        variables,
        tags: data.tags,
      });
    } else {
      createMutation.mutate({
        name: data.name,
        description: data.description,
        category: data.category,
        channel: data.channel,
        content,
        variables,
        tags: data.tags,
      });
    }
  };

  const handlePreview = () => {
    if (templateId) {
      previewMutation.mutate(previewData);
    } else {
      setShowPreview(true);
    }
  };

  const addVariable = () => {
    const newVariable: TemplateVariable = {
      name: `variable_${variables.length + 1}`,
      type: "text",
      required: false,
      description: "",
    };
    setVariables([...variables, newVariable]);
  };

  const updateVariable = (index: number, updates: Partial<TemplateVariable>) => {
    const updated = [...variables];
    updated[index] = { ...updated[index], ...updates } as TemplateVariable;
    setVariables(updated);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const addTag = () => {
    if (newTag.trim() && !currentTags?.includes(newTag.trim())) {
      setValue("tags", [...(currentTags || []), newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setValue(
      "tags",
      (currentTags || []).filter((tag) => tag !== tagToRemove),
    );
  };

  const getContentForChannel = (channel: CommunicationChannel): string => {
    switch (channel) {
      case "email":
        return watch("body") || "";
      case "sms":
        return watch("smsBody") || "";
      case "push":
        return `${watch("pushTitle") || ""}\n${watch("pushBody") || ""}`.trim();
      case "in_app":
        return watch("body") || "";
      case "voice":
        return watch("voiceScript") || "";
      default:
        return "";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading template...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{templateId ? "Edit Template" : "Create Template"}</h2>
          <p className="text-muted-foreground">
            {templateId
              ? "Update your template content and settings"
              : "Create a new communication template"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePreview}>
            <EyeIcon className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={onCancel} variant="outline">
            Cancel
          </Button>
          <Button
            onClick={form.handleSubmit(handleSave)}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            <BookmarkIcon className="h-4 w-4 mr-2" />
            {templateId ? "Update" : "Create"}
          </Button>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
        <Tabs defaultValue="content" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="variables">Variables</TabsTrigger>
            <TabsTrigger value="personalization">Personalization</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="name">Template Name</Label>
                      <Input
                        id="name"
                        {...form.register("name")}
                        placeholder="Enter template name"
                      />
                      {form.formState.errors.name && (
                        <p className="text-sm text-destructive mt-1">
                          {form.formState.errors.name.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        {...form.register("description")}
                        placeholder="Describe what this template is for"
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="category">Category</Label>
                        <Select
                          value={watch("category")}
                          onValueChange={(value) => setValue("category", value as TemplateCategory)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(categoryLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="channel">Channel</Label>
                        <Select
                          value={watch("channel")}
                          onValueChange={(value) =>
                            setValue("channel", value as CommunicationChannel)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(channelLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Content</CardTitle>
                    <CardDescription>
                      Create your {channelLabels[selectedChannel].toLowerCase()} content
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedChannel === "email" && (
                      <EmailTemplateEditor
                        subject={watch("subject")}
                        preheader={watch("preheader")}
                        body={watch("body")}
                        plainText={watch("plainText")}
                        variables={variables}
                        onSubjectChange={(value) => setValue("subject", value)}
                        onPreheaderChange={(value) => setValue("preheader", value)}
                        onBodyChange={(value) => setValue("body", value)}
                        onPlainTextChange={(value) => setValue("plainText", value)}
                      />
                    )}

                    {selectedChannel === "sms" && (
                      <SmsTemplateEditor
                        content={watch("smsBody")}
                        variables={variables}
                        onChange={(value) => setValue("smsBody", value)}
                      />
                    )}

                    {selectedChannel === "push" && (
                      <PushTemplateEditor
                        title={watch("pushTitle")}
                        body={watch("pushBody")}
                        variables={variables}
                        onTitleChange={(value) => setValue("pushTitle", value)}
                        onBodyChange={(value) => setValue("pushBody", value)}
                      />
                    )}

                    {selectedChannel === "in_app" && (
                      <InAppTemplateEditor
                        content={watch("body")}
                        variables={variables}
                        onChange={(value) => setValue("body", value)}
                      />
                    )}

                    {selectedChannel === "voice" && (
                      <VoiceTemplateEditor
                        script={watch("voiceScript")}
                        variables={variables}
                        onChange={(value) => setValue("voiceScript", value)}
                      />
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TagIcon className="h-4 w-4" />
                      Tags
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {(currentTags || []).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="ml-1 hover:text-destructive"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="Add tag"
                        onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                      />
                      <Button type="button" size="sm" onClick={addTag}>
                        Add
                      </Button>
                    </div>
                    {existingTags.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Existing tags:</p>
                        <div className="flex flex-wrap gap-1">
                          {existingTags.slice(0, 10).map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() =>
                                !(currentTags || []).includes(tag) &&
                                setValue("tags", [...(currentTags || []), tag])
                              }
                              className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 disabled:opacity-50"
                              disabled={(currentTags || []).includes(tag)}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="variables" className="space-y-6">
            <VariableManager
              variables={variables}
              onChange={setVariables}
              onInsert={(variableName) => {
                const variableText = `{{${variableName}}}`;
                if (selectedChannel === "email") {
                  setValue("body", watch("body") + variableText);
                } else if (selectedChannel === "sms") {
                  setValue("smsBody", (watch("smsBody") || "") + variableText);
                } else if (selectedChannel === "push") {
                  setValue("pushBody", (watch("pushBody") || "") + variableText);
                } else if (selectedChannel === "in_app") {
                  setValue("body", watch("body") + variableText);
                } else if (selectedChannel === "voice") {
                  setValue("voiceScript", (watch("voiceScript") || "") + variableText);
                }
              }}
            />
          </TabsContent>

          <TabsContent value="personalization" className="space-y-6">
            <PersonalizationPreview
              content={getContentForChannel(selectedChannel)}
              variables={variables}
              channel={selectedChannel}
            />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cog6ToothIcon className="h-4 w-4" />
                  Template Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Status</Label>
                    <Select defaultValue="draft">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Approval Status</Label>
                    <Select defaultValue="pending">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending Review</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="needs_review">Needs Review</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {templateId && (
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2">Template History</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ClockIcon className="h-4 w-4" />
                      <span>Version {template?.version || 1}</span>
                      <span>•</span>
                      <span>
                        Last updated{" "}
                        {template?.updatedAt
                          ? new Date(template.updatedAt).toLocaleDateString()
                          : "Never"}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview" className="space-y-6">
            <TemplatePreview
              template={template}
              formData={getValues()}
              variables={variables}
              previewData={previewData}
              onPreviewDataChange={setPreviewData}
            />
          </TabsContent>
        </Tabs>
      </form>
    </div>
  );
}
