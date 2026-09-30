"use client";

import { Activity } from "@/lib/icons";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { projectApi } from "@/lib/api/project";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Cog6ToothIcon,
  UsersIcon,
  KeyIcon,
  ChartBarIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import { ProjectSettings } from "./project-settings";
import { ProjectMembers } from "./project-members";
import { ProjectApiKeys } from "./project-api-keys";
import { ProjectAnalytics } from "./project-analytics";
import { ProjectWebhooks } from "./project-webhooks";
import { ProjectStatus } from "@/lib/types/project";

interface ProjectDetailsProps {
  projectId: string;
}

export function ProjectDetails({ projectId }: ProjectDetailsProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const {
    data: project,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectApi.getProject(projectId),
  });

  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.ACTIVE:
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case ProjectStatus.INACTIVE:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case ProjectStatus.ARCHIVED:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </CardHeader>
          <CardContent>
            <div className="h-4 bg-muted rounded w-3/4"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !project) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <p>Failed to load project details. Please try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl">{project.name}</CardTitle>
                <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
              </div>
              <CardDescription className="text-base">
                {project.description || "No description provided"}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Cog6ToothIcon className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">{new Date(project.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last Activity</p>
              <p className="font-medium">
                {project.lastActivity
                  ? new Date(project.lastActivity).toLocaleDateString()
                  : "No activity"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">API Keys</p>
              <p className="font-medium">{project.apiKeysCount || 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Members</p>
              <p className="font-medium">{project.memberCount || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">
            <UsersIcon className="h-4 w-4 mr-2" />
            Members
          </TabsTrigger>
          <TabsTrigger value="api-keys">
            <KeyIcon className="h-4 w-4 mr-2" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <ChartBarIcon className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="webhooks">
            <LinkIcon className="h-4 w-4 mr-2" />
            Webhooks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <ProjectSettings project={project} />
        </TabsContent>

        <TabsContent value="members">
          <ProjectMembers projectId={projectId} />
        </TabsContent>

        <TabsContent value="api-keys">
          <ProjectApiKeys projectId={projectId} />
        </TabsContent>

        <TabsContent value="analytics">
          <ProjectAnalytics projectId={projectId} />
        </TabsContent>

        <TabsContent value="webhooks">
          <ProjectWebhooks projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
