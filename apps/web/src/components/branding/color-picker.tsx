'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { getAccessibilityLevel } from '@/lib/utils/color-contrast';
import { Popover, PopoverContent, PopoverTrigger } from '@radix-ui/react-popover';
import { CheckIcon, ExclamationTriangleIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { useCallback, useState } from 'react';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  presets?: Array<{ name: string; value: string; description?: string }>;
  showAccessibility?: boolean;
  contrastBase?: string;
}

export function ColorPicker({
  label,
  value,
  onChange,
  presets,
  showAccessibility,
  contrastBase,
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const accessibilityLevel =
    showAccessibility && contrastBase ? getAccessibilityLevel(value, contrastBase) : null;

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        {showAccessibility && accessibilityLevel && (
          <div className="flex items-center gap-1">
            {accessibilityLevel === 'AAA' && <CheckIcon className="h-4 w-4 text-green-600" />}
            {accessibilityLevel === 'AA' && <CheckIcon className="h-4 w-4 text-yellow-600" />}
            {accessibilityLevel === 'FAIL' && (
              <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />
            )}
            <span className="text-xs text-muted-foreground">{accessibilityLevel}</span>
          </div>
        )}
      </div>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start gap-2">
            <div className="h-4 w-4 rounded border" style={{ backgroundColor: value }} />
            <span className="truncate font-mono text-xs">{value}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-3">
            <Input value={value} onChange={(e) => onChange(e.target.value)} />
            {presets && (
              <div className="grid grid-cols-3 gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className={cn(
                      'h-8 rounded border-2 transition-all hover:scale-105',
                      value === preset.value ? 'border-primary' : 'border-transparent'
                    )}
                    style={{ backgroundColor: preset.value }}
                    onClick={() => onChange(preset.value)}
                    title={preset.description ?? preset.name}
                  />
                ))}
              </div>
            )}
            <Button variant="ghost" size="sm" className="w-full" onClick={() => copyToClipboard(value)}>
              <DocumentDuplicateIcon className="h-4 w-4 mr-2" />
              Copy value
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
