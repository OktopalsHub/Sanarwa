"use client";

import { AlertTriangle, Bug, ExternalLink, Zap } from "@/lib/icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/utils/toast";
import {
  ExclamationTriangleIcon,
  BugAntIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentDuplicateIcon,
  ArrowTopRightOnSquareIcon,
  MagnifyingGlassIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { CodeBlock } from "./code-block";

interface ErrorScenario {
  id: string;
  title: string;
  errorCode: string;
  httpStatus?: number;
  category:
    | "authentication"
    | "validation"
    | "rate-limiting"
    | "network"
    | "server"
    | "integration";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  commonCauses: string[];
  errorExample: {
    request?: string;
    response: string;
    language?: string;
  };
  solutions: {
    title: string;
    description: string;
    code?: string;
    language?: string;
    steps?: string[];
  }[];
  prevention: string[];
  relatedErrors?: string[];
  tags: string[];
}

interface ErrorScenariosProps {
  scenarios?: ErrorScenario[];
}

const defaultScenarios: ErrorScenario[] = [
  {
    id: "auth-401-invalid-key",
    title: "Invalid API Key",
    errorCode: "INVALID_API_KEY",
    httpStatus: 401,
    category: "authentication",
    severity: "high",
    description: "The provided API key is invalid, expired, or malformed",
    commonCauses: [
      "API key is incorrect or contains typos",
      "API key has been revoked or expired",
      "Using wrong environment API key (dev vs prod)",
      'Missing "Bearer" prefix in Authorization header',
    ],
    errorExample: {
      request: `curl -X POST https://api.notifi.com/v1/notifications/email \\
  -H "Authorization: Bearer invalid_key_123" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "user@example.com", "subject": "Test"}'`,
      response: `{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "The provided API key is invalid",
    "details": {
      "provided_key": "invalid_key_123",
      "key_format": "Expected format: nk_live_* or nk_test_*"
    }
  },
  "request_id": "req_1234567890"
}`,
      language: "json",
    },
    solutions: [
      {
        title: "Verify API Key Format",
        description: "Ensure your API key follows the correct format and is properly configured.",
        code: `// Check API key format
const apiKey = process.env.NOTIFI_API_KEY;

if (!apiKey) {
  throw new Error('NOTIFI_API_KEY environment variable is not set');
}

if (!apiKey.startsWith('nk_live_') && !apiKey.startsWith('nk_test_')) {
  throw new Error('Invalid API key format. Expected: nk_live_* or nk_test_*');
}

// Correct usage
const client = new NotifiClient({
  apiKey: apiKey,
  baseUrl: apiKey.startsWith('nk_live_') 
    ? 'https://api.notifi.com' 
    : 'https://api-sandbox.notifi.com'
});`,
        language: "javascript",
      },
      {
        title: "Test API Key Validity",
        description: "Use the auth verification endpoint to test your API key.",
        code: `// Test API key
async function verifyApiKey() {
  try {
    const response = await fetch('https://api.notifi.com/v1/auth/verify', {
      headers: {
        'Authorization': \`Bearer \${process.env.NOTIFI_API_KEY}\`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('API key is valid:', data);
      return true;
    } else {
      console.error('API key verification failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('Network error during verification:', error);
    return false;
  }
}`,
        language: "javascript",
      },
    ],
    prevention: [
      "Store API keys securely in environment variables",
      "Use different keys for different environments",
      "Regularly rotate API keys",
      "Monitor API key usage and expiration dates",
    ],
    relatedErrors: ["EXPIRED_API_KEY", "INSUFFICIENT_PERMISSIONS"],
    tags: ["authentication", "api-key", "401", "unauthorized"],
  },
  {
    id: "validation-400-missing-field",
    title: "Missing Required Field",
    errorCode: "VALIDATION_ERROR",
    httpStatus: 400,
    category: "validation",
    severity: "medium",
    description: "A required field is missing from the request payload",
    commonCauses: [
      "Required field not included in request body",
      "Field name is misspelled",
      "Field value is null or undefined",
      "Incorrect request structure",
    ],
    errorExample: {
      request: `{
  "subject": "Test Email",
  "template": "welcome"
  // Missing required "to" field
}`,
      response: `{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing required field: to",
    "details": {
      "field": "to",
      "type": "string",
      "description": "Recipient email address is required"
    }
  },
  "request_id": "req_1234567890"
}`,
      language: "json",
    },
    solutions: [
      {
        title: "Validate Request Data",
        description: "Implement client-side validation before sending requests.",
        code: `// Request validation function
function validateEmailRequest(data) {
  const required = ['to', 'subject'];
  const missing = required.filter(field => !data[field]);
  
  if (missing.length > 0) {
    throw new Error(\`Missing required fields: \${missing.join(', ')}\`);
  }
  
  // Email format validation
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  if (!emailRegex.test(data.to)) {
    throw new Error('Invalid email format');
  }
  
  return true;
}

// Usage
try {
  const emailData = {
    to: 'user@example.com',
    subject: 'Welcome!',
    template: 'welcome-template'
  };
  
  validateEmailRequest(emailData);
  const result = await client.email.send(emailData);
} catch (error) {
  console.error('Validation error:', error.message);
}`,
        language: "javascript",
      },
    ],
    prevention: [
      "Use TypeScript for compile-time type checking",
      "Implement request validation schemas",
      "Use form validation libraries",
      "Test with invalid data during development",
    ],
    tags: ["validation", "required-fields", "400", "bad-request"],
  },
  {
    id: "rate-limit-429",
    title: "Rate Limit Exceeded",
    errorCode: "RATE_LIMIT_EXCEEDED",
    httpStatus: 429,
    category: "rate-limiting",
    severity: "medium",
    description: "Too many requests sent in a given time period",
    commonCauses: [
      "Sending requests too frequently",
      "Burst traffic exceeding rate limits",
      "Multiple instances making concurrent requests",
      "Not implementing proper backoff strategies",
    ],
    errorExample: {
      response: `{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again later.",
    "details": {
      "limit": 100,
      "window": "60s",
      "retry_after": 45
    }
  },
  "request_id": "req_1234567890"
}`,
      language: "json",
    },
    solutions: [
      {
        title: "Implement Exponential Backoff",
        description: "Add retry logic with exponential backoff to handle rate limits gracefully.",
        code: `class RateLimitHandler {
  constructor(maxRetries = 3, baseDelay = 1000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
  }
  
  async executeWithRetry(requestFn) {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        if (error.status === 429 && attempt < this.maxRetries - 1) {
          const retryAfter = error.headers?.['retry-after'];
          const delay = retryAfter 
            ? parseInt(retryAfter) * 1000 
            : this.baseDelay * Math.pow(2, attempt);
          
          console.log(\`Rate limited, retrying in \${delay}ms...\`);
          await this.sleep(delay);
          continue;
        }
        throw error;
      }
    }
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
const rateLimitHandler = new RateLimitHandler();

const result = await rateLimitHandler.executeWithRetry(() =>
  client.email.send({
    to: 'user@example.com',
    subject: 'Test',
    content: 'Hello World'
  })
);`,
        language: "javascript",
      },
    ],
    prevention: [
      "Monitor rate limit headers in responses",
      "Implement request queuing",
      "Use batch operations when available",
      "Cache frequently accessed data",
    ],
    tags: ["rate-limiting", "429", "throttling", "retry", "backoff"],
  },
];

export function ErrorScenarios({ scenarios = defaultScenarios }: ErrorScenariosProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [openScenarios, setOpenScenarios] = useState<Set<string>>(new Set());
  const [copiedCode, setCopiedCode] = useState<string>("");

  const filteredScenarios = scenarios.filter((scenario) => {
    const matchesSearch =
      searchTerm === "" ||
      scenario.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scenario.errorCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scenario.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scenario.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === "all" || scenario.category === selectedCategory;
    const matchesSeverity = selectedSeverity === "all" || scenario.severity === selectedSeverity;

    return matchesSearch && matchesCategory && matchesSeverity;
  });

  const toggleScenario = (scenarioId: string) => {
    const newOpenScenarios = new Set(openScenarios);
    if (newOpenScenarios.has(scenarioId)) {
      newOpenScenarios.delete(scenarioId);
    } else {
      newOpenScenarios.add(scenarioId);
    }
    setOpenScenarios(newOpenScenarios);
  };

  const handleCopyCode = async (code: string, scenarioId: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(scenarioId);
      toast.success("Code copied to clipboard");
      setTimeout(() => setCopiedCode(""), 2000);
    } catch (err) {
      toast.error("Failed to copy code");
    }
  };

  const categories = ["all", ...Array.from(new Set(scenarios.map((s) => s.category)))];
  const severities = ["all", "low", "medium", "high", "critical"];

  const severityColors = {
    low: "bg-blue-100 text-blue-800",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-orange-100 text-orange-800",
    critical: "bg-red-100 text-red-800",
  };

  const categoryIcons = {
    authentication: AlertTriangle,
    validation: Bug,
    "rate-limiting": Zap,
    network: ExternalLink,
    server: AlertTriangle,
    integration: ExternalLink,
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search error scenarios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Category:</span>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category} className="capitalize">
                    {category.replace("-", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Severity:</span>
            <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {severities.map((severity) => (
                  <SelectItem key={severity} value={severity} className="capitalize">
                    {severity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredScenarios.length} of {scenarios.length} error scenarios
      </div>

      {/* Error Scenarios */}
      <div className="space-y-4">
        {filteredScenarios.map((scenario) => {
          const CategoryIcon = categoryIcons[scenario.category] || AlertTriangle;

          return (
            <Card key={scenario.id} className="overflow-hidden">
              <Collapsible
                open={openScenarios.has(scenario.id)}
                onOpenChange={() => toggleScenario(scenario.id)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          {openScenarios.has(scenario.id) ? (
                            <ChevronDownIcon className="h-4 w-4" />
                          ) : (
                            <ChevronRightIcon className="h-4 w-4" />
                          )}
                          <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                          <CardTitle className="text-lg">{scenario.title}</CardTitle>
                          {scenario.httpStatus && (
                            <Badge variant="outline">{scenario.httpStatus}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{scenario.description}</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="text-xs">
                            {scenario.errorCode}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs ${severityColors[scenario.severity]}`}
                          >
                            {scenario.severity}
                          </Badge>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {scenario.category.replace("-", " ")}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-6">
                    {/* Common Causes */}
                    <div className="space-y-2">
                      <h4 className="font-medium">Common Causes</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        {scenario.commonCauses.map((cause, index) => (
                          <li key={index}>{cause}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Error Example */}
                    <div className="space-y-2">
                      <h4 className="font-medium">Error Example</h4>
                      {scenario.errorExample.request && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Request:</p>
                          <CodeBlock
                            language={scenario.errorExample.language || "bash"}
                            showLineNumbers={false}
                          >
                            {scenario.errorExample.request}
                          </CodeBlock>
                        </div>
                      )}
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Response:</p>
                        <CodeBlock
                          language={scenario.errorExample.language || "json"}
                          showLineNumbers={false}
                        >
                          {scenario.errorExample.response}
                        </CodeBlock>
                      </div>
                    </div>

                    {/* Solutions */}
                    <div className="space-y-4">
                      <h4 className="font-medium">Solutions</h4>
                      {scenario.solutions.map((solution, index) => (
                        <div key={index} className="border rounded-lg p-4 space-y-3">
                          <h5 className="font-medium">{solution.title}</h5>
                          <p className="text-sm text-muted-foreground">{solution.description}</p>

                          {solution.steps && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Steps:</p>
                              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                                {solution.steps.map((step, stepIndex) => (
                                  <li key={stepIndex}>{step}</li>
                                ))}
                              </ol>
                            </div>
                          )}

                          {solution.code && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">Code Example:</p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleCopyCode(solution.code!, `${scenario.id}-${index}`)
                                  }
                                  className="h-8 w-8 p-0"
                                >
                                  {copiedCode === `${scenario.id}-${index}` ? (
                                    <CheckIcon className="h-3 w-3" />
                                  ) : (
                                    <DocumentDuplicateIcon className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                              <CodeBlock
                                language={solution.language || "javascript"}
                                showLineNumbers={false}
                              >
                                {solution.code}
                              </CodeBlock>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Prevention */}
                    <div className="space-y-2">
                      <h4 className="font-medium">Prevention Tips</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        {scenario.prevention.map((tip, index) => (
                          <li key={index}>{tip}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Related Errors */}
                    {scenario.relatedErrors && scenario.relatedErrors.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Related Errors</h4>
                        <div className="flex flex-wrap gap-2">
                          {scenario.relatedErrors.map((errorCode) => (
                            <Badge key={errorCode} variant="outline" className="text-xs">
                              {errorCode}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {filteredScenarios.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No error scenarios found matching your criteria.</p>
          <Button
            variant="outline"
            onClick={() => {
              setSearchTerm("");
              setSelectedCategory("all");
              setSelectedSeverity("all");
            }}
            className="mt-2"
          >
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
}
