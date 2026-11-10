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
  EyeIcon,
  CodeBracketSquareIcon,
  PlusIcon,
  TrashIcon,
  BoltIcon,
  CodeBracketIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

interface ConditionalRule {
  id: string;
  variable: string;
  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "not_contains"
    | "greater_than"
    | "less_than"
    | "exists"
    | "not_exists";
  value: string;
  content: string;
}

interface ConditionalContentProps {
  variables: TemplateVariable[];
  onInsert?: (conditionalCode: string) => void;
  className?: string;
}

const operators = [
  { value: "equals", label: "Equals", description: "Variable equals exact value" },
  { value: "not_equals", label: "Not Equals", description: "Variable does not equal value" },
  { value: "contains", label: "Contains", description: "Variable contains text" },
  { value: "not_contains", label: "Not Contains", description: "Variable does not contain text" },
  {
    value: "greater_than",
    label: "Greater Than",
    description: "Variable is greater than value (numbers)",
  },
  { value: "less_than", label: "Less Than", description: "Variable is less than value (numbers)" },
  { value: "exists", label: "Exists", description: "Variable has any value" },
  { value: "not_exists", label: "Not Exists", description: "Variable is empty or undefined" },
];

export function ConditionalContent({ variables, onInsert, className }: ConditionalContentProps) {
  const [rules, setRules] = useState<ConditionalRule[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, any>>({});

  const addRule = () => {
    const newRule: ConditionalRule = {
      id: `rule_${Date.now()}`,
      variable: variables[0]?.name || "",
      operator: "equals",
      value: "",
      content: "",
    };
    setRules([...rules, newRule]);
  };

  const updateRule = (id: string, updates: Partial<ConditionalRule>) => {
    setRules(rules.map((rule) => (rule.id === id ? { ...rule, ...updates } : rule)));
  };

  const removeRule = (id: string) => {
    setRules(rules.filter((rule) => rule.id !== id));
  };

  const generateConditionalCode = (rule: ConditionalRule): string => {
    const { variable, operator, value, content } = rule;

    switch (operator) {
      case "equals":
        return `{{#if (eq ${variable} "${value}")}}${content}{{/if}}`;
      case "not_equals":
        return `{{#unless (eq ${variable} "${value}")}}${content}{{/unless}}`;
      case "contains":
        return `{{#if (contains ${variable} "${value}")}}${content}{{/if}}`;
      case "not_contains":
        return `{{#unless (contains ${variable} "${value}")}}${content}{{/unless}}`;
      case "greater_than":
        return `{{#if (gt ${variable} ${value})}}${content}{{/if}}`;
      case "less_than":
        return `{{#if (lt ${variable} ${value})}}${content}{{/if}}`;
      case "exists":
        return `{{#if ${variable}}}${content}{{/if}}`;
      case "not_exists":
        return `{{#unless ${variable}}}${content}{{/unless}}`;
      default:
        return `{{#if ${variable}}}${content}{{/if}}`;
    }
  };

  const generateComplexConditional = (): string => {
    if (rules.length === 0) return "";

    if (rules.length === 1 && rules[0]) {
      return generateConditionalCode(rules[0]);
    }

    let code = "";
    rules.forEach((rule, index) => {
      const ruleCode = generateConditionalCode(rule);
      if (index === 0) {
        code = ruleCode;
      } else {
        code = code.replace("{{/if}}", `{{else}}${ruleCode}{{/if}}`);
      }
    });

    return code;
  };

  const insertConditionalCode = (rule?: ConditionalRule) => {
    const code = rule ? generateConditionalCode(rule) : generateComplexConditional();
    onInsert?.(code);
  };

  const previewConditionalContent = (rule: ConditionalRule): string => {
    const { variable, operator, value } = rule;
    const variableValue = previewData[variable];

    let conditionMet = false;

    switch (operator) {
      case "equals":
        conditionMet = String(variableValue) === value;
        break;
      case "not_equals":
        conditionMet = String(variableValue) !== value;
        break;
      case "contains":
        conditionMet = String(variableValue).includes(value);
        break;
      case "not_contains":
        conditionMet = !String(variableValue).includes(value);
        break;
      case "greater_than":
        conditionMet = Number(variableValue) > Number(value);
        break;
      case "less_than":
        conditionMet = Number(variableValue) < Number(value);
        break;
      case "exists":
        conditionMet =
          variableValue !== undefined && variableValue !== null && variableValue !== "";
        break;
      case "not_exists":
        conditionMet =
          variableValue === undefined || variableValue === null || variableValue === "";
        break;
    }

    return conditionMet ? rule.content : "";
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CodeBracketSquareIcon className="h-4 w-4" />
                Conditional Content
              </CardTitle>
              <CardDescription>
                Create dynamic content that shows or hides based on variable values
              </CardDescription>
            </div>
            <Button onClick={addRule} disabled={variables.length === 0}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {variables.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No variables available.</p>
              <p className="text-sm">Add some variables first to create conditional content.</p>
            </div>
          )}

          {rules.length === 0 && variables.length > 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <CodeBracketSquareIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No conditional rules defined yet.</p>
              <p className="text-sm">
                Add rules to create dynamic content based on variable values.
              </p>
            </div>
          )}

          {rules.map((rule) => (
            <Card key={rule.id} className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Conditional Rule</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => insertConditionalCode(rule)}>
                      <CodeBracketIcon className="h-4 w-4 mr-2" />
                      Insert
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeRule(rule.id)}>
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Variable</Label>
                    <Select
                      value={rule.variable}
                      onValueChange={(value) => updateRule(rule.id, { variable: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {variables.map((variable) => (
                          <SelectItem key={variable.name} value={variable.name}>
                            <div>
                              <div className="font-medium">{variable.name}</div>
                              <div className="text-xs text-muted-foreground">{variable.type}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Condition</Label>
                    <Select
                      value={rule.operator}
                      onValueChange={(value) => updateRule(rule.id, { operator: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {operators.map((operator) => (
                          <SelectItem key={operator.value} value={operator.value}>
                            <div>
                              <div className="font-medium">{operator.label}</div>
                              <div className="text-xs text-muted-foreground">
                                {operator.description}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Value</Label>
                    <Input
                      value={rule.value}
                      onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                      placeholder="Comparison value"
                      disabled={rule.operator === "exists" || rule.operator === "not_exists"}
                    />
                  </div>
                </div>

                <div>
                  <Label>Content to Show</Label>
                  <Textarea
                    value={rule.content}
                    onChange={(e) => updateRule(rule.id, { content: e.target.value })}
                    placeholder="Content that will be shown when condition is met..."
                    rows={3}
                  />
                </div>

                <div className="bg-muted/50 rounded-lg p-3">
                  <Label className="text-xs font-medium">Generated Code:</Label>
                  <code className="block text-xs mt-1 font-mono bg-background p-2 rounded border">
                    {generateConditionalCode(rule)}
                  </code>
                </div>
              </CardContent>
            </Card>
          ))}

          {rules.length > 1 && (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BoltIcon className="h-4 w-4" />
                  Combined Conditional
                </CardTitle>
                <CardDescription>
                  All rules combined into a single conditional block
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <Label className="text-xs font-medium">Combined Code:</Label>
                    <code className="block text-xs mt-1 font-mono bg-background p-2 rounded border whitespace-pre-wrap">
                      {generateComplexConditional()}
                    </code>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => insertConditionalCode()}
                    className="w-full"
                  >
                    <CodeBracketIcon className="h-4 w-4 mr-2" />
                    Insert Combined Conditional
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {rules.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <EyeIcon className="h-4 w-4" />
                Preview Conditional Content
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
                {showPreview ? "Hide Preview" : "Show Preview"}
              </Button>
            </div>
          </CardHeader>
          {showPreview && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Test Data</Label>
                  <div className="space-y-2 mt-2">
                    {variables.map((variable) => (
                      <div key={variable.name} className="flex items-center gap-2">
                        <Label className="text-xs w-20">{variable.name}:</Label>
                        <Input
                          value={previewData[variable.name] || ""}
                          onChange={(e) =>
                            setPreviewData({
                              ...previewData,
                              [variable.name]: e.target.value,
                            })
                          }
                          placeholder={`Test ${variable.type} value`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Preview Results</Label>
                  <div className="space-y-2 mt-2">
                    {rules.map((rule, index) => {
                      const result = previewConditionalContent(rule);
                      return (
                        <div key={rule.id} className="border rounded p-2">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              Rule {index + 1}
                            </Badge>
                            <Badge variant={result ? "default" : "secondary"} className="text-xs">
                              {result ? "Shown" : "Hidden"}
                            </Badge>
                          </div>
                          <div className="text-sm">
                            {result || (
                              <span className="text-muted-foreground italic">Content hidden</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Conditional Content Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium">How it works:</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground mt-1">
                <li>Create rules that check variable values</li>
                <li>Content is shown only when conditions are met</li>
                <li>Use multiple rules for complex logic</li>
                <li>Test with preview data to verify behavior</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium">Common use cases:</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground mt-1">
                <li>Personalized greetings based on user type</li>
                <li>Different content for different subscription levels</li>
                <li>Location-specific information</li>
                <li>Time-sensitive offers</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium">Syntax reference:</h4>
              <div className="bg-muted/50 rounded p-2 mt-1 font-mono text-xs">
                <div>
                  {"{{#if condition}}"}content{"{{/if}}"}
                </div>
                <div>
                  {"{{#unless condition}}"}content{"{{/unless}}"}
                </div>
                <div>
                  {"{{#if condition}}"}content{"{{else}}"}other content{"{{/if}}"}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
