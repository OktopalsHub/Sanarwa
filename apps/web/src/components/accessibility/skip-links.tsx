"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface SkipLink {
  href: string;
  label: string;
}

const defaultSkipLinks: SkipLink[] = [
  { href: "#main-content", label: "Skip to main content" },
  { href: "#navigation", label: "Skip to navigation" },
  { href: "#search", label: "Skip to search" },
  { href: "#footer", label: "Skip to footer" },
];

interface SkipLinksProps {
  links?: SkipLink[];
  className?: string;
}

export function SkipLinks({ links = defaultSkipLinks, className }: SkipLinksProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab" && !event.shiftKey) {
        setIsVisible(true);
      }
    };

    const handleFocusOut = (event: FocusEvent) => {
      const skipLinksContainer = document.getElementById("skip-links");
      if (skipLinksContainer && !skipLinksContainer.contains(event.relatedTarget as Node)) {
        setIsVisible(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusout", handleFocusOut);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  const handleSkipLinkClick = (href: string) => {
    const target = document.querySelector(href);
    if (target) {
      const originalTabIndex = target.getAttribute("tabindex");
      target.setAttribute("tabindex", "-1");

      (target as HTMLElement).focus();

      target.scrollIntoView({ behavior: "smooth", block: "start" });

      setTimeout(() => {
        if (originalTabIndex !== null) {
          target.setAttribute("tabindex", originalTabIndex);
        } else {
          target.removeAttribute("tabindex");
        }
      }, 100);
    }

    setIsVisible(false);
  };

  return (
    <nav
      id="skip-links"
      className={cn(
        "fixed top-0 left-0 z-[9999] bg-foreground text-background shadow-lg",
        "transform transition-transform duration-200 ease-in-out",
        isVisible ? "translate-y-0" : "-translate-y-full",
        className,
      )}
      aria-label="Skip navigation links"
    >
      <ul className="flex flex-wrap gap-1 p-2">
        {links.map((link) => (
          <li key={link.href}>
            <button
              onClick={() => handleSkipLinkClick(link.href)}
              className={cn(
                "px-3 py-2 text-sm font-medium rounded-md",
                "bg-background text-foreground",
                "hover:bg-background/90 focus:bg-background/90",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                "transition-colors duration-200",
              )}
              tabIndex={isVisible ? 0 : -1}
            >
              {link.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function useSkipLinkTarget(id: string, label?: string) {
  useEffect(() => {
    const element = document.getElementById(id);
    if (element && label) {
      element.setAttribute("aria-label", label);
    }
  }, [id, label]);
}
