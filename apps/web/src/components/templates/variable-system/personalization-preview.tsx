"use client";

import { User } from "@/lib/icons";

import { Badge } from "@sanarwa/ui/badge";
import { Button } from "@sanarwa/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@sanarwa/ui/card";
import { Input } from "@sanarwa/ui/input";
import { Label } from "@sanarwa/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@sanarwa/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@sanarwa/ui/tabs";
import type { CommunicationChannel, TemplateVariable } from "@/lib/types/template";
import { ArrowDownTrayIcon, EyeIcon, ArrowPathIcon, UsersIcon } from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";
import { TemplateProcessor } from "./variable-validator";

interface PersonalizationPreviewProps {
  content: string;
  variables: TemplateVariable[];
  channel: CommunicationChannel;
  className?: string;
}

interface PreviewProfile {
  id: string;
  name: string;
  data: Record<string, any>;
}

const sampleProfiles: PreviewProfile[] = [
  {
    id: "john_doe",
    name: "John Doe (Premium User)",
    data: {
      first_name: "John",
      last_name: "Doe",
      email: "john.doe@example.com",
      user_type: "premium",
      subscription_level: "pro",
      company: "Acme Corp",
      location: "New York",
      signup_date: "2023-01-15",
      last_login: "2024-01-20",
      total_orders: 15,
      total_spent: 1250.5,
    },
  },
  {
    id: "jane_smith",
    name: "Jane Smith (Free User)",
    data: {
      first_name: "Jane",
      last_name: "Smith",
      email: "jane.smith@example.com",
      user_type: "free",
      subscription_level: "basic",
      company: "StartupXYZ",
      location: "San Francisco",
      signup_date: "2024-01-01",
      last_login: "2024-01-19",
      total_orders: 3,
      total_spent: 89.99,
    },
  },
  {
    id: "alex_johnson",
    name: "Alex Johnson (Enterprise)",
    data: {
      first_name: "Alex",
      last_name: "Johnson",
      email: "alex.johnson@enterprise.com",
      user_type: "enterprise",
      subscription_level: "enterprise",
      company: "Enterprise Solutions Inc",
      location: "Chicago",
      signup_date: "2022-06-10",
      last_login: "2024-01-20",
      total_orders: 45,
      total_spent: 5670.25,
    },
  },
];

export function PersonalizationPreview({
  content,
  variables,
  channel,
  className,
}: PersonalizationPreviewProps) {
  const [selectedProfile, setSelectedProfile] = useState<string>(
    sampleProfiles[0]?.id || "john_doe",
  );
  const [customData, setCustomData] = useState<Record<string, any>>({});
  const [useCustomData, setUseCustomData] = useState(false);
  const [showVariableHighlight, setShowVariableHighlight] = useState(true);

  const currentProfile = sampleProfiles.find((p) => p.id === selectedProfile);
  const previewData = useCustomData ? customData : currentProfile?.data || {};

  const processedContent = useMemo(() => {
    return TemplateProcessor.processTemplate(content, previewData);
  }, [content, previewData]);

  const usedVariables = useMemo(() => {
    return TemplateProcessor.extractVariables(content);
  }, [content]);

  const missingVariables = useMemo(() => {
    return usedVariables.filter((varName) => !variables.some((v) => v.name === varName));
  }, [usedVariables, variables]);

  const generateRandomData = () => {
    const randomData: Record<string, any> = {};

    variables.forEach((variable) => {
      switch (variable.type) {
        case "text":
          randomData[variable.name] = `Sample ${variable.name}`;
          break;
        case "number":
          randomData[variable.name] = Math.floor(Math.random() * 1000);
          break;
        case "email":
          randomData[variable.name] = `user${Math.floor(Math.random() * 1000)}@example.com`;
          break;
        case "url":
          randomData[variable.name] = `https://example.com/${variable.name}`;
          break;
        case "date":
          randomData[variable.name] = new Date().toISOString().split("T")[0];
          break;
        case "boolean":
          randomData[variable.name] = Math.random() > 0.5;
          break;
        case "image":
          randomData[variable.name] = `https://via.placeholder.com/300x200?text=${variable.name}`;
          break;
        default:
          randomData[variable.name] = variable.defaultValue || `Sample ${variable.name}`;
      }
    });

    setCustomData(randomData);
    setUseCustomData(true);
  };

  const exportPreview = () => {
    const exportData = {
      content: processedContent,
      variables: previewData,
      channel,
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template-preview-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const highlightVariables = (text: string): string => {
    if (!showVariableHighlight) return text;

    return text.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
      const trimmedName = variableName.trim();
      const isDefined = variables.some((v) => v.name === trimmedName);
      const className = isDefined
        ? "bg-blue-100 text-blue-800 px-1 rounded"
        : "bg-red-100 text-red-800 px-1 rounded";
      return `<span class="${className}">${match}</span>`;
    });
  };

  const renderChannelPreview = () => {
    switch (channel) {
      case "email":
        return (
          <div className="border rounded-lg overflow-hidden bg-white">
            <div className="bg-gray-50 p-4 border-b">
              <div className="text-sm text-gray-600">Email Preview</div>
            </div>
            <div className="p-6">
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: processedContent }}
              />
            </div>
          </div>
        );

      case "sms":
        return (
          <div className="max-w-sm mx-auto">
            <div className="bg-gray-900 rounded-3xl p-2">
              <div className="bg-white rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    B
                  </div>
                  <div>
                    <div className="font-medium text-sm">Your Business</div>
                    <div className="text-xs text-gray-500">SMS</div>
                  </div>
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-sm p-3">
                  <p className="text-sm whitespace-pre-wrap">{processedContent}</p>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "push":
        return (
          <div className="max-w-sm mx-auto">
            <div className="bg-gray-100 rounded-2xl p-4">
              <div className="bg-white rounded-xl p-3 shadow-sm border">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                    A
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">Your App</span>
                      <span className="text-xs text-gray-500">now</span>
                    </div>
                    <div className="text-sm">{processedContent}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "in_app":
        return (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
            <div className="bg-white border rounded-lg p-4 shadow-sm">
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: processedContent }}
              />
            </div>
          </div>
        );

      case "voice":
        return (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white">
                📞
              </div>
              <div>
                <div className="font-medium">Voice Call Script</div>
                <div className="text-sm text-gray-500">Text-to-Speech Preview</div>
              </div>
            </div>
            <div className="bg-white rounded p-4 border">
              <p className="text-sm whitespace-pre-wrap">{processedContent}</p>
            </div>
          </div>
        );

      default:
        return (
          <div className="border rounded-lg p-4">
            <pre className="whitespace-pre-wrap text-sm">{processedContent}</pre>
          </div>
        );
    }
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <EyeIcon className="h-4 w-4" />
                Personalization Preview
              </CardTitle>
              <CardDescription>
                See how your template will look with different user data
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={generateRandomData}>
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Random Data
              </Button>
              <Button variant="outline" size="sm" onClick={exportPreview}>
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="preview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="data">Test Data</TabsTrigger>
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="preview" className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label>Profile:</Label>
                  <Select
                    value={selectedProfile}
                    onValueChange={setSelectedProfile}
                    disabled={useCustomData}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sampleProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useCustomData"
                    checked={useCustomData}
                    onChange={(e) => setUseCustomData(e.target.checked)}
                  />
                  <Label htmlFor="useCustomData" className="text-sm">
                    Use custom data
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="highlightVariables"
                    checked={showVariableHighlight}
                    onChange={(e) => setShowVariableHighlight(e.target.checked)}
                  />
                  <Label htmlFor="highlightVariables" className="text-sm">
                    Highlight variables
                  </Label>
                </div>
              </div>

              {missingVariables.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-yellow-700">
                      Warning
                    </Badge>
                    <span className="text-sm font-medium">Undefined Variables</span>
                  </div>
                  <p className="text-sm text-yellow-700 mb-2">
                    The following variables are used in the template but not defined:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {missingVariables.map((varName) => (
                      <Badge key={varName} variant="outline" className="text-xs">
                        {varName}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Preview Result</h4>
                  <Badge variant="secondary">{channel}</Badge>
                </div>
                {renderChannelPreview()}
              </div>

              {showVariableHighlight && (
                <div className="space-y-2">
                  <h4 className="font-medium">Raw Content with Variables Highlighted</h4>
                  <div
                    className="border rounded-lg p-4 bg-gray-50 text-sm"
                    dangerouslySetInnerHTML={{ __html: highlightVariables(content) }}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="data" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Current Data</CardTitle>
                    <CardDescription>
                      {useCustomData ? "Custom test data" : `Data from ${currentProfile?.name}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(previewData).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-3 gap-2 items-center">
                          <Label className="text-sm font-medium">{key}</Label>
                          <div className="col-span-2">
                            {useCustomData ? (
                              <Input
                                value={String(value)}
                                onChange={(e) =>
                                  setCustomData({
                                    ...customData,
                                    [key]: e.target.value,
                                  })
                                }
                              />
                            ) : (
                              <span className="text-sm text-muted-foreground">{String(value)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {useCustomData && (
                      <div className="mt-4 pt-4 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newData = { ...customData };
                            variables.forEach((variable) => {
                              if (!(variable.name in newData)) {
                                newData[variable.name] = variable.defaultValue || "";
                              }
                            });
                            setCustomData(newData);
                          }}
                        >
                          <ArrowPathIcon className="h-4 w-4 mr-2" />
                          Add Missing Variables
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Variable Mapping</CardTitle>
                    <CardDescription>How template variables map to data values</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {usedVariables.map((varName) => {
                        const isDefined = variables.some((v) => v.name === varName);
                        const hasValue = varName in previewData;
                        const value = previewData[varName];

                        return (
                          <div
                            key={varName}
                            className="flex items-center justify-between p-2 border rounded"
                          >
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-muted px-1 rounded">
                                {"{{" + varName + "}}"}
                              </code>
                              {!isDefined && (
                                <Badge variant="destructive" className="text-xs">
                                  Undefined
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm">
                              {hasValue ? (
                                <span className="text-muted-foreground">
                                  {String(value).substring(0, 30)}
                                  {String(value).length > 30 ? "..." : ""}
                                </span>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  No Value
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="analysis" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <UsersIcon className="h-4 w-4" />
                      Variable Usage
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Variables in template:</span>
                        <Badge variant="secondary">{usedVariables.length}</Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Defined variables:</span>
                        <Badge variant="secondary">{variables.length}</Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Missing definitions:</span>
                        <Badge variant={missingVariables.length > 0 ? "destructive" : "secondary"}>
                          {missingVariables.length}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Unused variables:</span>
                        <Badge variant="secondary">
                          {variables.filter((v) => !usedVariables.includes(v.name)).length}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Personalization Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(() => {
                        const totalWords = content.split(/\s+/).length;
                        const variableWords = usedVariables.length;
                        const score =
                          totalWords > 0 ? Math.round((variableWords / totalWords) * 100) : 0;

                        return (
                          <>
                            <div className="text-center">
                              <div className="text-3xl font-bold text-primary">{score}%</div>
                              <div className="text-sm text-muted-foreground">Personalization</div>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{ width: `${score}%` }}
                              />
                            </div>
                            <div className="text-xs text-muted-foreground text-center">
                              {variableWords} variables in {totalWords} words
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {missingVariables.length > 0 && (
                      <div className="flex items-start gap-2 p-2 bg-red-50 rounded">
                        <span className="text-red-600">⚠️</span>
                        <span>Define missing variables: {missingVariables.join(", ")}</span>
                      </div>
                    )}

                    {variables.filter((v) => !usedVariables.includes(v.name)).length > 0 && (
                      <div className="flex items-start gap-2 p-2 bg-yellow-50 rounded">
                        <span className="text-yellow-600">💡</span>
                        <span>
                          Consider using unused variables:{" "}
                          {variables
                            .filter((v) => !usedVariables.includes(v.name))
                            .map((v) => v.name)
                            .join(", ")}
                        </span>
                      </div>
                    )}

                    {usedVariables.length === 0 && (
                      <div className="flex items-start gap-2 p-2 bg-blue-50 rounded">
                        <span className="text-blue-600">💡</span>
                        <span>
                          Add personalization variables to make your content more engaging
                        </span>
                      </div>
                    )}

                    {usedVariables.length > 0 && missingVariables.length === 0 && (
                      <div className="flex items-start gap-2 p-2 bg-green-50 rounded">
                        <span className="text-green-600">✅</span>
                        <span>Great! All variables are properly defined and used</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
