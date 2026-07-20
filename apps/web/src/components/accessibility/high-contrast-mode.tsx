"use client";

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useHighContrast } from '@/lib/utils/accessibility';
import { EyeIcon, ComputerDesktopIcon, SwatchIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react';

type ContrastMode = 'normal' | 'high' | 'auto';

interface HighContrastModeProps {
  className?: string;
}

export function HighContrastMode({ className }: HighContrastModeProps) {
  const [contrastMode, setContrastMode] = useState<ContrastMode>('auto');
  const [mounted, setMounted] = useState(false);
  const systemPrefersHighContrast = useHighContrast();

  useEffect(() => {
    setMounted(true);

    // Load saved preference
    const saved = localStorage.getItem('contrast-mode') as ContrastMode;
    if (saved) {
      setContrastMode(saved);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const shouldUseHighContrast =
      contrastMode === 'high' ||
      (contrastMode === 'auto' && systemPrefersHighContrast);

    // Apply high contrast class to document
    if (shouldUseHighContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }

    // Save preference
    localStorage.setItem('contrast-mode', contrastMode);
  }, [contrastMode, systemPrefersHighContrast, mounted]);

  const handleContrastChange = (newMode: ContrastMode) => {
    setContrastMode(newMode);
  };

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="w-9 h-9">
        <SwatchIcon className="h-4 w-4" />
        <span className="sr-only">Toggle contrast mode</span>
      </Button>
    );
  }

  const getContrastIcon = () => {
    switch (contrastMode) {
      case 'high':
        return <SwatchIcon className="h-4 w-4" />;
      case 'normal':
        return <EyeIcon className="h-4 w-4" />;
      case 'auto':
        return <ComputerDesktopIcon className="h-4 w-4" />;
    }
  };

  const isActive = (mode: ContrastMode) => contrastMode === mode;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "w-9 h-9 relative overflow-hidden transition-all duration-300 ease-in-out",
            "hover:bg-accent hover:text-accent-foreground hover:scale-105 active:scale-95",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className
          )}
          aria-label={`Current contrast mode: ${contrastMode}. Click to change contrast settings.`}
        >
          {getContrastIcon()}
          <span className="sr-only">Toggle contrast mode</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[160px] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
      >
        <DropdownMenuItem
          onClick={() => handleContrastChange('normal')}
          className={cn(
            "cursor-pointer transition-colors duration-200 hover:bg-accent hover:text-accent-foreground",
            isActive('normal') ? 'bg-accent text-accent-foreground' : ''
          )}
        >
          <EyeIcon className="mr-2 h-4 w-4" />
          <span>Normal</span>
          {isActive('normal') && (
            <div className="ml-auto w-2 h-2 rounded-full bg-primary" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleContrastChange('high')}
          className={cn(
            "cursor-pointer transition-colors duration-200 hover:bg-accent hover:text-accent-foreground",
            isActive('high') ? 'bg-accent text-accent-foreground' : ''
          )}
        >
          <SwatchIcon className="mr-2 h-4 w-4" />
          <span>High Contrast</span>
          {isActive('high') && (
            <div className="ml-auto w-2 h-2 rounded-full bg-primary" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleContrastChange('auto')}
          className={cn(
            "cursor-pointer transition-colors duration-200 hover:bg-accent hover:text-accent-foreground",
            isActive('auto') ? 'bg-accent text-accent-foreground' : ''
          )}
        >
          <ComputerDesktopIcon className="mr-2 h-4 w-4" />
          <span>System</span>
          {isActive('auto') && (
            <div className="ml-auto w-2 h-2 rounded-full bg-primary" />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Hook to use high contrast mode state
export function useContrastMode() {
  const [contrastMode, setContrastMode] = useState<ContrastMode>('auto');
  const [isHighContrast, setIsHighContrast] = useState(false);
  const systemPrefersHighContrast = useHighContrast();

  useEffect(() => {
    const saved = localStorage.getItem('contrast-mode') as ContrastMode;
    if (saved) {
      setContrastMode(saved);
    }
  }, []);

  useEffect(() => {
    const shouldUseHighContrast =
      contrastMode === 'high' ||
      (contrastMode === 'auto' && systemPrefersHighContrast);

    setIsHighContrast(shouldUseHighContrast);
  }, [contrastMode, systemPrefersHighContrast]);

  return {
    contrastMode,
    isHighContrast,
    setContrastMode,
  };
}