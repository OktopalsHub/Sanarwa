"use client";

import {
  TemplateApprovalWorkflow,
  TemplateEditor,
  TemplateLibrary,
  TemplateVersionHistory,
} from "@/components/templates";
import { Button } from "@sanarwa/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@sanarwa/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@sanarwa/ui/tabs";
import type { CommunicationChannel, Template } from "@/lib/types/template";
import { CheckCircleIcon, ArrowLeftIcon, ClockIcon } from "@heroicons/react/24/outline";

import { useState } from "react";

type ViewType = "library" | "editor" | "details";

export default function TemplatesPage() {
  const [currentView, setCurrentView] = useState<ViewType>("library");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<CommunicationChannel>("email");

  const handleCreateTemplate = () => {
    setSelectedTemplate(null);
    setCurrentView("editor");
  };

  const handleEditTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setCurrentView("editor");
  };

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setCurrentView("details");
  };

  const handleBackToLibrary = () => {
    setSelectedTemplate(null);
    setCurrentView("library");
  };

  const handleTemplateSaved = (template: Template) => {
    setSelectedTemplate(template);
    setCurrentView("details");
  };

  const renderContent = () => {
    switch (currentView) {
      case "library":
        return (
          <TemplateLibrary
            onSelectTemplate={handleSelectTemplate}
            onEditTemplate={handleEditTemplate}
            onCreateTemplate={handleCreateTemplate}
            selectedChannel={selectedChannel}
          />
        );

      case "editor":
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={handleBackToLibrary}>
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Back to Library
              </Button>
            </div>

            <TemplateEditor
              templateId={selectedTemplate?.id}
              initialChannel={selectedChannel}
              onSave={handleTemplateSaved}
              onCancel={handleBackToLibrary}
            />
          </div>
        );

      case "details":
        return selectedTemplate ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={handleBackToLibrary}>
                  <ArrowLeftIcon className="h-4 w-4 mr-2" />
                  Back to Library
                </Button>
                <div>
                  <h1 className="text-2xl font-bold">{selectedTemplate.name}</h1>
                  <p className="text-muted-foreground">
                    {selectedTemplate.description || "No description provided"}
                  </p>
                </div>
              </div>
              <Button onClick={() => handleEditTemplate(selectedTemplate)}>Edit Template</Button>
            </div>

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="versions">
                  <ClockIcon className="h-4 w-4 mr-2" />
                  Versions
                </TabsTrigger>
                <TabsTrigger value="approval">
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                  Approval
                </TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Template Content</CardTitle>
                        <CardDescription>Preview of the template content</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {selectedTemplate.content.subject && (
                            <div>
                              <h4 className="font-medium text-sm text-muted-foreground mb-1">
                                Subject
                              </h4>
                              <p className="text-sm">{selectedTemplate.content.subject}</p>
                            </div>
                          )}

                          <div>
                            <h4 className="font-medium text-sm text-muted-foreground mb-1">Body</h4>
                            <div
                              className="prose prose-sm max-w-none p-3 bg-muted/50 rounded-md"
                              dangerouslySetInnerHTML={{ __html: selectedTemplate.content.body }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Template Info</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm font-medium">Channel</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {selectedTemplate.channel}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Category</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {selectedTemplate.category}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Version</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedTemplate.version}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Status</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {selectedTemplate.status}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Usage Count</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedTemplate.usageCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Last Updated</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(selectedTemplate.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {selectedTemplate.variables.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Variables</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {selectedTemplate.variables.map((variable) => (
                              <div
                                key={variable.name}
                                className="flex justify-between items-center"
                              >
                                <span className="text-sm font-mono">
                                  {"{{"}
                                  {variable.name}
                                  {"}}"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {variable.type}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="versions">
                <TemplateVersionHistory
                  templateId={selectedTemplate.id}
                  currentTemplate={selectedTemplate}
                  onVersionRestore={(version) => {
                    console.log("Version restored:", version);
                  }}
                />
              </TabsContent>

              <TabsContent value="approval">
                <TemplateApprovalWorkflow
                  templateId={selectedTemplate.id}
                  template={selectedTemplate}
                  onApprovalChange={(approval) => {
                    console.log("Approval changed:", approval);
                  }}
                />
              </TabsContent>

              <TabsContent value="analytics">
                <Card>
                  <CardHeader>
                    <CardTitle>Template Analytics</CardTitle>
                    <CardDescription>Performance metrics and usage statistics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Analytics feature coming soon</p>
                      <p className="text-sm">
                        Track template performance, usage patterns, and engagement metrics
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : null;

      default:
        return null;
    }
  };

  return <div className="container mx-auto py-6">{renderContent()}</div>;
}
