'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/utils/toast';
import { ExclamationTriangleIcon, CheckIcon, CheckCircleIcon, ChevronDownIcon, ChevronRightIcon, DocumentDuplicateIcon, ArrowTopRightOnSquareIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useState } from 'react';
import { CodeBlock } from './code-block';

interface TroubleshootingItem {
  id: string;
  title: string;
  category: 'authentication' | 'api' | 'sdk' | 'integration' | 'performance' | 'general';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  symptoms: string[];
  causes: string[];
  solutions: {
    title: string;
    description: string;
    code?: string;
    language?: string;
    steps?: string[];
  }[];
  relatedLinks?: {
    title: string;
    url: string;
  }[];
  tags: string[];
}

interface TroubleshootingGuideProps {
  items: TroubleshootingItem[];
}

const severityColors = {
  low: 'bg-blue-100 text-blue-800 border-blue-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  critical: 'bg-red-100 text-red-800 border-red-200'
};

const categoryColors = {
  authentication: 'bg-purple-100 text-purple-800',
  api: 'bg-green-100 text-green-800',
  sdk: 'bg-blue-100 text-blue-800',
  integration: 'bg-indigo-100 text-indigo-800',
  performance: 'bg-orange-100 text-orange-800',
  general: 'bg-gray-100 text-gray-800'
};

export function TroubleshootingGuide({ items }: TroubleshootingGuideProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const [copiedCode, setCopiedCode] = useState<string>('');

  const filteredItems = items.filter(item => {
    const matchesSearch = searchTerm === '' ||
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSeverity = selectedSeverity === 'all' || item.severity === selectedSeverity;

    return matchesSearch && matchesCategory && matchesSeverity;
  });

  const toggleItem = (itemId: string) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(itemId)) {
      newOpenItems.delete(itemId);
    } else {
      newOpenItems.add(itemId);
    }
    setOpenItems(newOpenItems);
  };

  const handleCopyCode = async (code: string, solutionId: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(solutionId);
      toast.success('Code copied to clipboard');
      setTimeout(() => setCopiedCode(''), 2000);
    } catch (err) {
      toast.error('Failed to copy code');
    }
  };

  const categories = ['all', ...Array.from(new Set(items.map(item => item.category)))];
  const severities = ['all', 'low', 'medium', 'high', 'critical'];

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search troubleshooting guides..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Category:</span>
            {categories.map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="capitalize"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Severity:</span>
            {severities.map(severity => (
              <Button
                key={severity}
                variant={selectedSeverity === severity ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedSeverity(severity)}
                className="capitalize"
              >
                {severity}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredItems.length} of {items.length} troubleshooting guides
      </div>

      {/* Troubleshooting Items */}
      <div className="space-y-4">
        {filteredItems.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <Collapsible
              open={openItems.has(item.id)}
              onOpenChange={() => toggleItem(item.id)}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {openItems.has(item.id) ? (
                          <ChevronDownIcon className="h-4 w-4" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4" />
                        )}
                        <CardTitle className="text-lg">{item.title}</CardTitle>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className={categoryColors[item.category]}
                        >
                          {item.category}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={severityColors[item.severity]}
                        >
                          {item.severity}
                        </Badge>
                        {item.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0 space-y-6">
                  {/* Symptoms */}
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <ExclamationTriangleIcon className="h-4 w-4 text-orange-500" />
                      Symptoms
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {item.symptoms.map((symptom, index) => (
                        <li key={index}>{symptom}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Possible Causes */}
                  <div className="space-y-2">
                    <h4 className="font-medium">Possible Causes</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {item.causes.map((cause, index) => (
                        <li key={index}>{cause}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Solutions */}
                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      Solutions
                    </h4>
                    {item.solutions.map((solution, index) => (
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
                                onClick={() => handleCopyCode(solution.code!, `${item.id}-${index}`)}
                                className="h-8 w-8 p-0"
                              >
                                {copiedCode === `${item.id}-${index}` ? (
                                  <CheckIcon className="h-3 w-3" />
                                ) : (
                                  <DocumentDuplicateIcon className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                            <CodeBlock
                              language={solution.language || 'javascript'}
                              showLineNumbers={false}
                            >
                              {solution.code}
                            </CodeBlock>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Related Links */}
                  {item.relatedLinks && item.relatedLinks.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Related Resources</h4>
                      <div className="space-y-1">
                        {item.relatedLinks.map((link, index) => (
                          <a
                            key={index}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-primary hover:underline"
                          >
                            <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                            {link.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No troubleshooting guides found matching your criteria.</p>
          <Button
            variant="outline"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('all');
              setSelectedSeverity('all');
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