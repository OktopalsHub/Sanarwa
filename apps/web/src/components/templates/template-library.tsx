"use client";

import { Bell, Mail, MessageSquare, Phone, Smartphone } from "@/lib/icons";

import { Badge } from "@sanarwa/ui/badge";
import { Button } from "@sanarwa/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@sanarwa/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@sanarwa/ui/dropdown-menu";
import { Input } from "@sanarwa/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@sanarwa/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@sanarwa/ui/tabs";
import { templateApi } from "@sanarwa/api-client";
import type {
  CommunicationChannel,
  Template,
  TemplateCategory,
  TemplateLibraryFilter,
} from "@/lib/types/template";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  BellIcon,
  CalendarIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  PencilIcon,
  EyeIcon,
  FunnelIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  EllipsisVerticalIcon,
  PhoneIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  DevicePhoneMobileIcon,
  TagIcon,
  TrashIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";

interface TemplateLibraryProps {
  onSelectTemplate?: (template: Template) => void;
  onEditTemplate?: (template: Template) => void;
  onCreateTemplate?: () => void;
  selectedChannel?: CommunicationChannel;
  className?: string;
}

const channelIcons = {
  email: Mail,
  sms: MessageSquare,
  push: Smartphone,
  in_app: Bell,
  voice: Phone,
};

const channelColors = {
  email: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  sms: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  push: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  in_app: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  voice: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const categoryLabels: Record<TemplateCategory, string> = {
  welcome: "Welcome",
  promotional: "Promotional",
  transactional: "Transactional",
  notification: "Notification",
  reminder: "Reminder",
  custom: "Custom",
};

export function TemplateLibrary({
  onSelectTemplate,
  onEditTemplate,
  onCreateTemplate,
  selectedChannel,
  className,
}: TemplateLibraryProps) {
  const [filter, setFilter] = useState<TemplateLibraryFilter>({
    channel: selectedChannel,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | "all">("all");

  const {
    data: templatesResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["templates", filter],
    queryFn: () => templateApi.getTemplates(filter),
  });

  const templates = templatesResponse?.data ?? [];

  const { data: categories = [] } = useQuery({
    queryKey: ["template-categories"],
    queryFn: () => templateApi.getCategories(),
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["template-tags"],
    queryFn: () => templateApi.getTags(),
  });

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      const matchesSearch =
        !searchQuery ||
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, selectedCategory]);

  const groupedTemplates = useMemo(() => {
    const groups: Record<CommunicationChannel, Template[]> = {
      email: [],
      sms: [],
      push: [],
      in_app: [],
      voice: [],
    };

    filteredTemplates.forEach((template) => {
      groups[template.channel].push(template);
    });

    return groups;
  }, [filteredTemplates]);

  const handleFilterChange = (key: keyof TemplateLibraryFilter, value: any) => {
    setFilter((prev) => ({ ...prev, [key]: value }));
  };

  const handleDuplicateTemplate = async (template: Template) => {
    try {
      await templateApi.duplicateTemplate({
        templateId: template.id,
        name: `${template.name} (Copy)`,
        description: template.description,
      });
    } catch (error) {
      console.error("Failed to duplicate template:", error);
    }
  };

  const handleDeleteTemplate = async (template: Template) => {
    if (window.confirm(`Are you sure you want to delete "${template.name}"?`)) {
      try {
        await templateApi.deleteTemplate(template.id);
      } catch (error) {
        console.error("Failed to delete template:", error);
      }
    }
  };

  const TemplateCard = ({ template }: { template: Template }) => {
    const ChannelIcon = channelIcons[template.channel];

    return (
      <Card className="group hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Badge className={cn("text-xs", channelColors[template.channel])}>
                <ChannelIcon className="h-3 w-3 mr-1" />
                {template.channel.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {categoryLabels[template.category]}
              </Badge>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                >
                  <EllipsisVerticalIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onSelectTemplate?.(template)}>
                  <EyeIcon className="h-4 w-4 mr-2" />
                  Preview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEditTemplate?.(template)}>
                  <PencilIcon className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDuplicateTemplate(template)}>
                  <DocumentDuplicateIcon className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleDeleteTemplate(template)}
                  className="text-destructive"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <CardTitle className="text-lg">{template.name}</CardTitle>
          {template.description && (
            <CardDescription className="line-clamp-2">{template.description}</CardDescription>
          )}
        </CardHeader>

        <CardContent className="pb-3">
          <div className="flex flex-wrap gap-1 mb-3">
            {template.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                <TagIcon className="h-3 w-3 mr-1" />
                {tag}
              </Badge>
            ))}
            {template.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{template.tags.length - 3} more
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <UsersIcon className="h-3 w-3" />
                <span>{template.usageCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <ClockIcon className="h-3 w-3" />
                <span>v{template.version}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              <span>{new Date(template.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-0">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onSelectTemplate?.(template)}
          >
            Use Template
          </Button>
        </CardFooter>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading templates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive mb-2">Failed to load templates</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Template Library</h2>
          <p className="text-muted-foreground">Browse and manage your communication templates</p>
        </div>
        <Button onClick={onCreateTemplate}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select
          value={selectedCategory}
          onValueChange={(value) => setSelectedCategory(value as TemplateCategory | "all")}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {categoryLabels[category as TemplateCategory]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <FunnelIcon className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="p-2">
              <p className="text-sm font-medium mb-2">Status</p>
              <Select
                value={filter.status || "all"}
                onValueChange={(value) =>
                  handleFilterChange("status", value === "all" ? undefined : value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
          <TabsTrigger value="push">Push</TabsTrigger>
          <TabsTrigger value="in_app">In-App</TabsTrigger>
          <TabsTrigger value="voice">Voice</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
          {filteredTemplates.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No templates found</p>
              <Button onClick={onCreateTemplate}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Create Your First Template
              </Button>
            </div>
          )}
        </TabsContent>

        {Object.entries(groupedTemplates).map(([channel, channelTemplates]) => (
          <TabsContent key={channel} value={channel} className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {channelTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
            {channelTemplates.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No {channel} templates found</p>
                <Button onClick={onCreateTemplate}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Create {channel.charAt(0).toUpperCase() + channel.slice(1)} Template
                </Button>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
