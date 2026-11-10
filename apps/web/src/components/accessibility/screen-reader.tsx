"use client";

import { ScreenReaderUtils } from "@/lib/utils/accessibility";
import React, { useEffect, useRef, useState } from "react";

interface ScreenReaderOnlyProps {
  children: React.ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
}

export function ScreenReaderOnly({
  children,
  as: Component = "span",
  className = "",
}: ScreenReaderOnlyProps) {
  const ElementType = Component as keyof React.JSX.IntrinsicElements;
  return <ElementType className={`sr-only ${className}`}>{children}</ElementType>;
}

interface LiveRegionProps {
  children?: React.ReactNode;
  priority?: "polite" | "assertive" | "off";
  atomic?: boolean;
  relevant?: "additions" | "removals" | "text" | "all";
  className?: string;
}

export function LiveRegion({
  children,
  priority = "polite",
  atomic = true,
  relevant = "all",
  className = "",
}: LiveRegionProps) {
  return (
    <div
      aria-live={priority}
      aria-atomic={atomic}
      aria-relevant={relevant}
      className={`sr-only ${className}`}
    >
      {children}
    </div>
  );
}

interface StatusProps {
  message: string;
  type?: "error" | "success" | "warning" | "info";
  visible?: boolean;
  className?: string;
}

export function Status({ message, type = "info", visible = true, className = "" }: StatusProps) {
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (visible && message) {
      setAnnouncement(message);
      const timer = setTimeout(() => setAnnouncement(""), 1000);
      return () => clearTimeout(timer);
    }

    return () => {};
  }, [message, visible]);

  const getAriaRole = () => {
    switch (type) {
      case "error":
        return "alert";
      case "success":
      case "warning":
      case "info":
        return "status";
      default:
        return "status";
    }
  };

  if (!visible) return null;

  return (
    <>
      <div
        role={getAriaRole()}
        aria-live={type === "error" ? "assertive" : "polite"}
        className={className}
      >
        {message}
      </div>

      <LiveRegion priority={type === "error" ? "assertive" : "polite"}>{announcement}</LiveRegion>
    </>
  );
}

interface ProgressAnnouncerProps {
  value: number;
  max?: number;
  label?: string;
  announceInterval?: number;
  className?: string;
}

export function ProgressAnnouncer({
  value,
  max = 100,
  label = "Progress",
  announceInterval = 10,
  className = "",
}: ProgressAnnouncerProps) {
  const [lastAnnounced, setLastAnnounced] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const percentage = Math.round((value / max) * 100);

    if (percentage - lastAnnounced >= announceInterval || percentage === 100) {
      const message = `${label}: ${percentage}% complete`;
      setAnnouncement(message);
      setLastAnnounced(percentage);

      const timer = setTimeout(() => setAnnouncement(""), 1000);
      return () => clearTimeout(timer);
    }

    return () => {};
  }, [value, max, label, announceInterval, lastAnnounced]);

  return <LiveRegion className={className}>{announcement}</LiveRegion>;
}

interface LoadingAnnouncerProps {
  isLoading: boolean;
  loadingMessage?: string;
  completeMessage?: string;
  errorMessage?: string;
  error?: boolean;
  className?: string;
}

export function LoadingAnnouncer({
  isLoading,
  loadingMessage = "Loading...",
  completeMessage = "Loading complete",
  errorMessage = "Loading failed",
  error = false,
  className = "",
}: LoadingAnnouncerProps) {
  const [announcement, setAnnouncement] = useState("");
  const previousLoadingRef = useRef(isLoading);

  useEffect(() => {
    const wasLoading = previousLoadingRef.current;
    previousLoadingRef.current = isLoading;

    if (isLoading && !wasLoading) {
      setAnnouncement(loadingMessage);
    } else if (!isLoading && wasLoading) {
      setAnnouncement(error ? errorMessage : completeMessage);
    }

    if (announcement) {
      const timer = setTimeout(() => setAnnouncement(""), 1000);
      return () => clearTimeout(timer);
    }

    return () => {};
  }, [isLoading, error, loadingMessage, completeMessage, errorMessage, announcement]);

  return (
    <LiveRegion priority={error ? "assertive" : "polite"} className={className}>
      {announcement}
    </LiveRegion>
  );
}

interface FieldDescriptionProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export function FieldDescription({ id, children, className = "" }: FieldDescriptionProps) {
  return (
    <div id={id} className={`text-sm text-muted-foreground ${className}`} role="note">
      {children}
    </div>
  );
}

interface ErrorMessageProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export function ErrorMessage({ id, children, className = "" }: ErrorMessageProps) {
  return (
    <div
      id={id}
      role="alert"
      aria-live="assertive"
      className={`text-sm text-destructive ${className}`}
    >
      {children}
    </div>
  );
}

interface BreadcrumbProps {
  items: Array<{
    label: string;
    href?: string;
    current?: boolean;
  }>;
  className?: string;
}

export function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center space-x-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <span className="mx-2 text-muted-foreground" aria-hidden="true">
                /
              </span>
            )}
            {item.current ? (
              <span aria-current="page" className="font-medium text-foreground">
                {item.label}
              </span>
            ) : item.href ? (
              <a
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </a>
            ) : (
              <span className="text-muted-foreground">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function useAnnouncement() {
  const announce = (message: string, priority: "polite" | "assertive" = "polite") => {
    ScreenReaderUtils.announce(message, priority.toUpperCase() as "POLITE" | "ASSERTIVE");
  };

  return { announce };
}

export function useFieldDescription(fieldId: string, description?: string) {
  const descriptionId = `${fieldId}-description`;

  useEffect(() => {
    if (description) {
      ScreenReaderUtils.describedBy(fieldId, description);
    }
  }, [fieldId, description]);

  return descriptionId;
}
