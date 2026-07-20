'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CheckIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline'
import { useState } from 'react';

interface CodeBlockProps {
  children: string;
  language?: string;
  title?: string;
  showLineNumbers?: boolean;
  className?: string;
}

export function CodeBlock({
  children,
  language = 'javascript',
  title,
  showLineNumbers = false,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const lines = children.split('\n');

  return (
    <div className={cn('relative group', className)}>
      {title && (
        <div className="flex items-center justify-between rounded-t-lg bg-muted px-4 py-2 text-sm font-medium">
          <span>{title}</span>
          <span className="text-xs text-muted-foreground uppercase">
            {language}
          </span>
        </div>
      )}

      <div className="relative">
        <pre
          className={cn(
            'overflow-x-auto rounded-lg bg-slate-950 p-4 text-sm',
            title && 'rounded-t-none',
            'dark:bg-slate-900'
          )}
        >
          <code className="text-slate-50">
            {showLineNumbers ? (
              <div className="table w-full">
                {lines.map((line, index) => (
                  <div key={index} className="table-row">
                    <span className="table-cell pr-4 text-slate-500 select-none text-right">
                      {index + 1}
                    </span>
                    <span className="table-cell">{line}</span>
                  </div>
                ))}
              </div>
            ) : (
              children
            )}
          </code>
        </pre>

        <Button
          size="sm"
          variant="ghost"
          className="absolute right-2 top-2 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleCopy}
        >
          {copied ? (
            <CheckIcon className="h-4 w-4 text-green-500" />
          ) : (
            <DocumentDuplicateIcon className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

// Language-specific code block components
export function JavaScriptCode({ children, title }: { children: string; title?: string }) {
  return <CodeBlock language="javascript" title={title}>{children}</CodeBlock>;
}

export function PythonCode({ children, title }: { children: string; title?: string }) {
  return <CodeBlock language="python" title={title}>{children}</CodeBlock>;
}

export function PHPCode({ children, title }: { children: string; title?: string }) {
  return <CodeBlock language="php" title={title}>{children}</CodeBlock>;
}

export function JavaCode({ children, title }: { children: string; title?: string }) {
  return <CodeBlock language="java" title={title}>{children}</CodeBlock>;
}

export function GoCode({ children, title }: { children: string; title?: string }) {
  return <CodeBlock language="go" title={title}>{children}</CodeBlock>;
}

export function CSharpCode({ children, title }: { children: string; title?: string }) {
  return <CodeBlock language="csharp" title={title}>{children}</CodeBlock>;
}