"use client";

import { Badge } from "@sanarwa/ui/badge";
import { Button } from "@sanarwa/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@sanarwa/ui/card";
import { Input } from "@sanarwa/ui/input";
import { Label } from "@sanarwa/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@sanarwa/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@sanarwa/ui/tabs";
import { Textarea } from "@sanarwa/ui/textarea";
import type { TemplateVariable } from "@/lib/types/template";
import {
  ExclamationCircleIcon,
  CheckCircleIcon,
  DocumentDuplicateIcon,
  PlusIcon,
  TrashIcon,
  CodeBracketIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { toast } from "sonner";

interface VariableManagerProps {
  variables: TemplateVariable[];
  onChange: (variables: TemplateVariable[]) => void;
  onInsert?: (variable: string) => void;
  className?: string;
}

const variableTypes = [
  { value: "text", label: "Text", description: "Any text string" },
  { value: "number", label: "Number", description: "Numeric values" },
  { value: "date", label: "Date", description: "Date and time values" },
  { value: "boolean", label: "Boolean", description: "True/false values" },
  { value: "url", label: "URL", description: "Web addresses" },
  { value: "email", label: "Email", description: "Email addresses" },
  { value: "image", label: "Image", description: "Image URLs" },
];

export function VariableManager({
  variables,
  onChange,
  onInsert,
  className,
}: VariableManagerProps) {
  const [activeTab, setActiveTab] = useState("manage");
  const [previewData, setPreviewData] = useState<Record<string, any>>({});

  const addVariable = () => {
    const newVariable: TemplateVariable = {
      name: `variable_${variables.length + 1}`,
      type: "text",
      required: false,
      description: "",
    };
    onChange([...variables, newVariable]);
  };

  const updateVariable = (index: number, updates: Partial<TemplateVariable>) => {
    const updated = [...variables];
    if (updated[index]) {
      updated[index] = { ...updated[index], ...updates } as TemplateVariable;
      onChange(updated);
    }
  };

  const removeVariable = (index: number) => {
    onChange(variables.filter((_, i) => i !== index));
  };

  const duplicateVariable = (index: number) => {
    const variable = variables[index];
    if (variable) {
      const duplicated: TemplateVariable = {
        ...variable,
        name: `${variable.name}_copy`,
      };
      onChange([...variables, duplicated]);
    }
  };

  const validateVariable = (variable: TemplateVariable): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!variable.name.trim()) {
      errors.push("Variable name is required");
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable.name)) {
      errors.push(
        "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
      );
    }

    if (variables.filter((v) => v.name === variable.name).length > 1) {
      errors.push("Variable name must be unique");
    }

    if (variable.validation) {
      const validation = variable.validation;

      if (validation.minLength !== undefined && validation.maxLength !== undefined) {
        if (validation.minLength > validation.maxLength) {
          errors.push("Minimum length cannot be greater than maximum length");
        }
      }

      if (validation.pattern) {
        try {
          new RegExp(validation.pattern);
        } catch {
          errors.push("Invalid regular expression pattern");
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  const generateSampleData = () => {
    const sampleData: Record<string, any> = {};

    variables.forEach((variable) => {
      switch (variable.type) {
        case "text":
          sampleData[variable.name] = variable.defaultValue || "Sample Text";
          break;
        case "number":
          sampleData[variable.name] = variable.defaultValue || 42;
          break;
        case "date":
          sampleData[variable.name] = variable.defaultValue || new Date().toISOString();
          break;
        case "boolean":
          sampleData[variable.name] =
            variable.defaultValue !== undefined ? variable.defaultValue : true;
          break;
        case "url":
          sampleData[variable.name] = variable.defaultValue || "https://example.com";
          break;
        case "email":
          sampleData[variable.name] = variable.defaultValue || "user@example.com";
          break;
        case "image":
          sampleData[variable.name] =
            variable.defaultValue || "https://via.placeholder.com/300x200";
          break;
        default:
          sampleData[variable.name] = variable.defaultValue || "Sample Value";
      }
    });

    setPreviewData(sampleData);
    toast.success("Sample data generated");
  };

  const copyVariableCode = (variable: TemplateVariable) => {
    const code = `{{${variable.name}}}`;
    navigator.clipboard.writeText(code);
    toast.success(`Copied ${code} to clipboard`);
  };

  const renderVariableEditor = (variable: TemplateVariable, index: number) => {
    const validation = validateVariable(variable);

    return (
      <Card key={index} className="relative">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Variable {index + 1}</CardTitle>
              {validation.isValid ? (
                <Badge variant="secondary" className="text-green-600">
                  <CheckCircleIcon className="h-3 w-3 mr-1" />
                  Valid
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <ExclamationCircleIcon className="h-3 w-3 mr-1" />
                  Invalid
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => copyVariableCode(variable)}
                title="Copy variable code"
              >
                <DocumentDuplicateIcon className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => duplicateVariable(index)}
                title="Duplicate variable"
              >
                <CodeBracketIcon className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeVariable(index)}
                title="Remove variable"
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {!validation.isValid && (
            <div className="text-sm text-destructive">
              {validation.errors.map((error, i) => (
                <div key={i}>• {error}</div>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Variable Name</Label>
              <Input
                value={variable.name}
                onChange={(e) => updateVariable(index, { name: e.target.value })}
                placeholder="variable_name"
                className={!validation.isValid ? "border-destructive" : ""}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use in templates as:{" "}
                <code className="bg-muted px-1 rounded">{"{{" + variable.name + "}}"}</code>
              </p>
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={variable.type}
                onValueChange={(value) => updateVariable(index, { type: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {variableTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Input
              value={variable.description || ""}
              onChange={(e) => updateVariable(index, { description: e.target.value })}
              placeholder="Describe what this variable represents"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Default Value</Label>
              <Input
                value={variable.defaultValue || ""}
                onChange={(e) => updateVariable(index, { defaultValue: e.target.value })}
                placeholder="Default value (optional)"
              />
            </div>
            <div className="flex items-center gap-4 pt-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={variable.required}
                  onChange={(e) => updateVariable(index, { required: e.target.checked })}
                />
                <span className="text-sm">Required</span>
              </label>
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="text-sm font-medium">Validation Rules</Label>
            <div className="grid grid-cols-2 gap-4 mt-2">
              {(variable.type === "text" ||
                variable.type === "email" ||
                variable.type === "url") && (
                <>
                  <div>
                    <Label className="text-xs">Min Length</Label>
                    <Input
                      type="number"
                      value={variable.validation?.minLength || ""}
                      onChange={(e) =>
                        updateVariable(index, {
                          validation: {
                            ...variable.validation,
                            minLength: e.target.value ? parseInt(e.target.value) : undefined,
                          },
                        })
                      }
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Max Length</Label>
                    <Input
                      type="number"
                      value={variable.validation?.maxLength || ""}
                      onChange={(e) =>
                        updateVariable(index, {
                          validation: {
                            ...variable.validation,
                            maxLength: e.target.value ? parseInt(e.target.value) : undefined,
                          },
                        })
                      }
                      placeholder="100"
                    />
                  </div>
                </>
              )}

              {variable.type === "text" && (
                <div className="col-span-2">
                  <Label className="text-xs">Pattern (RegEx)</Label>
                  <Input
                    value={variable.validation?.pattern || ""}
                    onChange={(e) =>
                      updateVariable(index, {
                        validation: {
                          ...variable.validation,
                          pattern: e.target.value,
                        },
                      })
                    }
                    placeholder="^[A-Za-z]+$"
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={className}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="manage">Manage Variables</TabsTrigger>
          <TabsTrigger value="preview">Preview Data</TabsTrigger>
          <TabsTrigger value="insert">Insert Variables</TabsTrigger>
        </TabsList>

        <TabsContent value="manage" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Template Variables</h3>
              <p className="text-sm text-muted-foreground">
                Define dynamic variables that can be personalized for each recipient
              </p>
            </div>
            <Button onClick={addVariable}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Variable
            </Button>
          </div>

          <div className="space-y-4">
            {variables.map((variable, index) => renderVariableEditor(variable, index))}

            {variables.length === 0 && (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No variables defined yet.</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add variables to make your templates dynamic and personalized.
                  </p>
                  <Button onClick={addVariable}>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Your First Variable
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Preview Data</CardTitle>
                  <CardDescription>
                    Test your variables with sample data to see how they'll appear in templates
                  </CardDescription>
                </div>
                <Button onClick={generateSampleData}>Generate Sample Data</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {variables.length > 0 ? (
                variables.map((variable) => (
                  <div key={variable.name} className="grid grid-cols-3 gap-4 items-center">
                    <div>
                      <Label className="text-sm font-medium">{variable.name}</Label>
                      <p className="text-xs text-muted-foreground">{variable.type}</p>
                    </div>
                    <div>
                      <Input
                        value={previewData[variable.name] || ""}
                        onChange={(e) =>
                          setPreviewData({
                            ...previewData,
                            [variable.name]: e.target.value,
                          })
                        }
                        placeholder={`Enter ${variable.type} value`}
                      />
                    </div>
                    <div>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {"{{" + variable.name + "}}"}
                      </code>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No variables to preview. Add some variables first.
                </p>
              )}
            </CardContent>
          </Card>

          {Object.keys(previewData).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>JSON Preview</CardTitle>
                <CardDescription>
                  This is how the data will be sent to your template
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={JSON.stringify(previewData, null, 2)}
                  readOnly
                  rows={10}
                  className="font-mono text-sm"
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="insert" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CodeBracketIcon className="h-4 w-4" />
                Insert Variables
              </CardTitle>
              <CardDescription>
                Click on any variable to insert it into your template content
              </CardDescription>
            </CardHeader>
            <CardContent>
              {variables.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {variables.map((variable) => (
                    <div
                      key={variable.name}
                      className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => onInsert?.(variable.name)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{variable.name}</h4>
                        <Badge variant="secondary" className="text-xs">
                          {variable.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {variable.description || "No description"}
                      </p>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {"{{" + variable.name + "}}"}
                      </code>
                      {variable.required && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Required
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No variables available. Add some variables first.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
