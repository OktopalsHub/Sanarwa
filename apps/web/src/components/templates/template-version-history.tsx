"use client";

import { CheckCircle, Clock } from "@/lib/icons";

import { Badge } from "@sanarwa/ui/badge";
import { Button } from "@sanarwa/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@sanarwa/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@sanarwa/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@sanarwa/ui/dropdown-menu";
import { ScrollArea } from "@sanarwa/ui/scroll-area";
import { templateApi } from "@sanarwa/api-client";
import type { Template, TemplateVersion } from "@/lib/types/template";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ExclamationCircleIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  DocumentTextIcon,
  EllipsisVerticalIcon,
  UserIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import React, { useState } from "react";
import { toast } from "sonner";

interface TemplateVersionHistoryProps {
  templateId: string;
  currentTemplate?: Template;
  onVersionRestore?: (version: TemplateVersion) => void;
  className?: string;
}

export function TemplateVersionHistory({
  templateId,
  currentTemplate,
  onVersionRestore,
  className,
}: TemplateVersionHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<TemplateVersion | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const queryClient = useQueryClient();

  const {
    data: versions = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["template-versions", templateId],
    queryFn: () => templateApi.getTemplateVersions(templateId),
    enabled: !!templateId,
  });

  const restoreMutation = useMutation({
    mutationFn: (version: number) => templateApi.restoreVersion(templateId, version),
    onSuccess: (restoredTemplate) => {
      toast.success(`Version ${selectedVersion?.version} restored successfully`);
      queryClient.invalidateQueries({ queryKey: ["template", templateId] });
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      onVersionRestore?.(selectedVersion!);
      setSelectedVersion(null);
    },
    onError: (error) => {
      toast.error("Failed to restore version");
      console.error("Restore version error:", error);
    },
  });

  const handleRestoreVersion = (version: TemplateVersion) => {
    if (
      window.confirm(
        `Are you sure you want to restore version ${version.version}? This will create a new version with the restored content.`,
      )
    ) {
      restoreMutation.mutate(version.version);
    }
  };

  const handlePreviewVersion = (version: TemplateVersion) => {
    setSelectedVersion(version);
    setShowPreview(true);
  };

  const getVersionStatus = (version: TemplateVersion) => {
    if (version.isActive) {
      return { label: "Current", variant: "default" as const, icon: CheckCircle };
    }
    return { label: "Archived", variant: "secondary" as const, icon: Clock };
  };

  const formatChangeLog = (changeLog?: string) => {
    if (!changeLog) return "No change log provided";
    return changeLog.length > 100 ? `${changeLog.substring(0, 100)}...` : changeLog;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading version history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-center">
          <ExclamationCircleIcon className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-destructive">Failed to load version history</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2">
        <ClockIcon className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Version History</h3>
        <Badge variant="outline">{versions.length} versions</Badge>
      </div>

      <ScrollArea className="h-96">
        <div className="space-y-3">
          {versions.map((version, index) => {
            const status = getVersionStatus(version);
            const StatusIcon = status.icon;

            return (
              <Card
                key={version.id}
                className={cn(
                  "transition-colors",
                  version.isActive && "ring-2 ring-primary/20 bg-primary/5",
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={status.variant} className="text-xs">
                          <StatusIcon className="h-3 w-3 mr-1" />
                          Version {version.version}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {status.label}
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarIcon className="h-3 w-3" />
                          <span>{new Date(version.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <UserIcon className="h-3 w-3" />
                          <span>{version.createdBy}</span>
                        </div>
                      </div>

                      {version.changeLog && (
                        <div className="flex items-start gap-2 text-sm">
                          <DocumentTextIcon className="h-3 w-3 mt-0.5 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {formatChangeLog(version.changeLog)}
                          </span>
                        </div>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <EllipsisVerticalIcon className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handlePreviewVersion(version)}>
                          <EyeIcon className="h-4 w-4 mr-2" />
                          Preview
                        </DropdownMenuItem>
                        {!version.isActive && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleRestoreVersion(version)}
                              disabled={restoreMutation.isPending}
                            >
                              <ArrowPathIcon className="h-4 w-4 mr-2" />
                              Restore Version
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {versions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <ClockIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No version history available</p>
              <p className="text-sm">
                Versions will appear here as you make changes to the template
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Version {selectedVersion?.version} Preview</DialogTitle>
            <DialogDescription>
              Created on{" "}
              {selectedVersion?.createdAt
                ? new Date(selectedVersion.createdAt).toLocaleString()
                : "Unknown"}
              {selectedVersion?.createdBy && ` by ${selectedVersion.createdBy}`}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            {selectedVersion && (
              <div className="space-y-4">
                {selectedVersion.changeLog && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Change Log</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{selectedVersion.changeLog}</p>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Content Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {selectedVersion.content.subject && (
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">
                            Subject
                          </Label>
                          <p className="text-sm">{selectedVersion.content.subject}</p>
                        </div>
                      )}

                      {selectedVersion.content.preheader && (
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">
                            Preheader
                          </Label>
                          <p className="text-sm">{selectedVersion.content.preheader}</p>
                        </div>
                      )}

                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">Body</Label>
                        <div
                          className="prose prose-sm max-w-none mt-2 p-3 bg-muted/50 rounded-md"
                          dangerouslySetInnerHTML={{ __html: selectedVersion.content.body }}
                        />
                      </div>

                      {selectedVersion.variables.length > 0 && (
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">
                            Variables
                          </Label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {selectedVersion.variables.map((variable) => (
                              <Badge key={variable.name} variant="outline" className="text-xs">
                                {variable.name} ({variable.type})
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
            {selectedVersion && !selectedVersion.isActive && (
              <Button
                onClick={() => {
                  handleRestoreVersion(selectedVersion);
                  setShowPreview(false);
                }}
                disabled={restoreMutation.isPending}
              >
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Restore This Version
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("text-sm font-medium", className)}>{children}</div>;
}
