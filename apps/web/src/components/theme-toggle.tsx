"use client";

import { ComputerDesktopIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline'
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { createThemeTransition, prefersReducedMotion } from "@/lib/utils/theme";

export function ThemeToggle() {
  const { setTheme, resolvedTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeChange = (newTheme: string) => {
    // Create smooth transition if user doesn't prefer reduced motion
    if (!prefersReducedMotion()) {
      createThemeTransition();
    }
    setTheme(newTheme);
  };

  if (!mounted) {
    return (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="w-9 h-9">
          <SunIcon className="h-4 w-4" />
          <span className="sr-only">Toggle theme</span>
        </Button>
        <Button variant="ghost" size="icon" className="w-9 h-9">
          <ComputerDesktopIcon className="h-4 w-4" />
          <span className="sr-only">Toggle contrast</span>
        </Button>
      </div>
    );
  }

  const getThemeIcon = () => {
    if (theme === 'system') {
      return <ComputerDesktopIcon className="h-4 w-4" />;
    }
    return resolvedTheme === 'dark' ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />;
  };

  const isActive = (themeOption: string) => theme === themeOption;

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="w-9 h-9 relative overflow-hidden transition-all duration-300 ease-in-out hover:bg-accent hover:text-accent-foreground hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`Current theme: ${theme}. Click to change theme.`}
          >
            <div className="relative w-4 h-4">
              <SunIcon
                className={`h-4 w-4 absolute inset-0 transition-all duration-500 ease-in-out ${resolvedTheme === "light" && theme !== 'system'
                  ? "rotate-0 scale-100 opacity-100"
                  : "rotate-90 scale-0 opacity-0"
                  }`}
              />
              <MoonIcon
                className={`h-4 w-4 absolute inset-0 transition-all duration-500 ease-in-out ${resolvedTheme === "dark" && theme !== 'system'
                  ? "rotate-0 scale-100 opacity-100"
                  : "-rotate-90 scale-0 opacity-0"
                  }`}
              />
              <ComputerDesktopIcon
                className={`h-4 w-4 absolute inset-0 transition-all duration-500 ease-in-out ${theme === 'system'
                  ? "rotate-0 scale-100 opacity-100"
                  : "rotate-180 scale-0 opacity-0"
                  }`}
              />
            </div>
            <span className="sr-only">Toggle theme</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-[140px] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <DropdownMenuItem
            onClick={() => handleThemeChange("light")}
            className={`cursor-pointer transition-colors duration-200 hover:bg-accent hover:text-accent-foreground ${isActive('light') ? 'bg-accent text-accent-foreground' : ''
              }`}
          >
            <SunIcon className="mr-2 h-4 w-4" />
            <span>Light</span>
            {isActive('light') && (
              <div className="ml-auto w-2 h-2 rounded-full bg-primary" />
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleThemeChange("dark")}
            className={`cursor-pointer transition-colors duration-200 hover:bg-accent hover:text-accent-foreground ${isActive('dark') ? 'bg-accent text-accent-foreground' : ''
              }`}
          >
            <MoonIcon className="mr-2 h-4 w-4" />
            <span>Dark</span>
            {isActive('dark') && (
              <div className="ml-auto w-2 h-2 rounded-full bg-primary" />
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleThemeChange("system")}
            className={`cursor-pointer transition-colors duration-200 hover:bg-accent hover:text-accent-foreground ${isActive('system') ? 'bg-accent text-accent-foreground' : ''
              }`}
          >
            <ComputerDesktopIcon className="mr-2 h-4 w-4" />
            <span>System</span>
            {isActive('system') && (
              <div className="ml-auto w-2 h-2 rounded-full bg-primary" />
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

    </div>
  );
}