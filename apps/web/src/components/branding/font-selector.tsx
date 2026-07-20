'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LanguageIcon } from '@heroicons/react/24/outline';

export const FONT_OPTIONS = [
  { name: 'Geist Sans', value: 'var(--font-geist-sans)', category: 'Sans Serif' },
  { name: 'Inter', value: 'Inter, sans-serif', category: 'Sans Serif' },
  { name: 'Roboto', value: 'Roboto, sans-serif', category: 'Sans Serif' },
  { name: 'Open Sans', value: 'Open Sans, sans-serif', category: 'Sans Serif' },
  { name: 'Lato', value: 'Lato, sans-serif', category: 'Sans Serif' },
  { name: 'Poppins', value: 'Poppins, sans-serif', category: 'Sans Serif' },
  { name: 'Montserrat', value: 'Montserrat, sans-serif', category: 'Sans Serif' },
  { name: 'Playfair Display', value: 'Playfair Display, serif', category: 'Serif' },
  { name: 'Merriweather', value: 'Merriweather, serif', category: 'Serif' },
  { name: 'Source Code Pro', value: 'Source Code Pro, monospace', category: 'Monospace' },
];

interface FontSelectorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function FontSelector({ label, value, onChange }: FontSelectorProps) {
  const selectedFont = FONT_OPTIONS.find((font) => font.value === value);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue>
            <div className="flex items-center gap-2">
              <LanguageIcon className="h-4 w-4" />
              <span style={{ fontFamily: value }}>{selectedFont?.name || 'Custom Font'}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {['Sans Serif', 'Serif', 'Monospace'].map((category) => (
            <div key={category}>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{category}</div>
              {FONT_OPTIONS.filter((f) => f.category === category).map((font) => (
                <SelectItem key={font.value} value={font.value}>
                  <span style={{ fontFamily: font.value }}>{font.name}</span>
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
