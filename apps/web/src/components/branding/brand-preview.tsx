"use client";

import { Mail, MessageSquare, Phone, Send } from "@/lib/icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandingConfig } from "@/contexts/branding-context";
import { cn } from "@/lib/utils";
import {
  BellIcon,
  CalendarIcon,
  CheckIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  StarIcon,
  UserIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";

interface BrandPreviewProps {
  branding: BrandingConfig;
  className?: string;
}

export function BrandPreview({ branding, className }: BrandPreviewProps) {
  // Create a style object for preview
  const previewStyle = {
    "--preview-primary": branding.colors.primary,
    "--preview-secondary": branding.colors.secondary,
    "--preview-accent": branding.colors.accent,
    "--preview-background": branding.colors.background,
    "--preview-foreground": branding.colors.foreground,
    "--preview-muted": branding.colors.muted || "#f1f5f9",
    "--preview-muted-foreground": branding.colors.mutedForeground || "#64748b",
    "--preview-border": branding.colors.border || "#e2e8f0",
    "--preview-destructive": branding.colors.destructive || "#ef4444",
    "--preview-font-family": branding.typography.fontFamily,
    "--preview-heading-font": branding.typography.headingFont || branding.typography.fontFamily,
  } as React.CSSProperties;

  return (
    <Card className={cn("p-6", className)} style={previewStyle}>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Brand Preview</h3>
          <p className="text-sm text-muted-foreground">
            See how your branding looks across different UI elements
          </p>
        </div>

        {/* Header Preview */}
        <div className="space-y-4">
          <h4 className="text-md font-medium">Header & Navigation</h4>
          <div
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: "var(--preview-background)",
              borderColor: "var(--preview-border)",
              fontFamily: "var(--preview-font-family)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {branding.logo.light && (
                  <img src={branding.logo.light} alt="Logo" className="h-8 w-auto" />
                )}
                <div
                  className="text-lg font-semibold"
                  style={{
                    color: "var(--preview-foreground)",
                    fontFamily: "var(--preview-heading-font)",
                  }}
                >
                  {branding.name}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  style={{
                    backgroundColor: "var(--preview-primary)",
                    color: "white",
                  }}
                >
                  <BellIcon className="h-4 w-4 mr-2" />
                  Notifications
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  style={{
                    borderColor: "var(--preview-border)",
                    color: "var(--preview-foreground)",
                  }}
                >
                  <UserIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Cards Preview */}
        <div className="space-y-4">
          <h4 className="text-md font-medium">Dashboard Cards</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Mail, label: "Email Campaigns", value: "1,234", change: "+12%" },
              { icon: MessageSquare, label: "SMS Sent", value: "5,678", change: "+8%" },
              { icon: Phone, label: "Voice Calls", value: "234", change: "+15%" },
            ].map((item, index) => (
              <div
                key={index}
                className="p-4 rounded-lg border"
                style={{
                  backgroundColor: "var(--preview-background)",
                  borderColor: "var(--preview-border)",
                  fontFamily: "var(--preview-font-family)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm" style={{ color: "var(--preview-muted-foreground)" }}>
                      {item.label}
                    </p>
                    <p
                      className="text-2xl font-bold"
                      style={{
                        color: "var(--preview-foreground)",
                        fontFamily: "var(--preview-heading-font)",
                      }}
                    >
                      {item.value}
                    </p>
                    <p className="text-sm" style={{ color: "var(--preview-primary)" }}>
                      {item.change}
                    </p>
                  </div>
                  <div
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: "var(--preview-muted)" }}
                  >
                    <item.icon className="h-6 w-6" style={{ color: "var(--preview-primary)" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Form Elements Preview */}
        <div className="space-y-4">
          <h4 className="text-md font-medium">Form Elements</h4>
          <div
            className="p-4 rounded-lg border space-y-4"
            style={{
              backgroundColor: "var(--preview-background)",
              borderColor: "var(--preview-border)",
              fontFamily: "var(--preview-font-family)",
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label style={{ color: "var(--preview-foreground)" }}>Campaign Name</Label>
                <Input
                  placeholder="Enter campaign name"
                  style={{
                    borderColor: "var(--preview-border)",
                    backgroundColor: "var(--preview-background)",
                    color: "var(--preview-foreground)",
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label style={{ color: "var(--preview-foreground)" }}>Send Date</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    style={{
                      borderColor: "var(--preview-border)",
                      backgroundColor: "var(--preview-background)",
                      color: "var(--preview-foreground)",
                    }}
                  />
                  <Button
                    style={{
                      backgroundColor: "var(--preview-primary)",
                      color: "white",
                    }}
                  >
                    <CalendarIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                style={{
                  backgroundColor: "var(--preview-primary)",
                  color: "white",
                }}
              >
                <BoltIcon className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
              <Button
                variant="outline"
                style={{
                  borderColor: "var(--preview-border)",
                  color: "var(--preview-foreground)",
                }}
              >
                Save Draft
              </Button>
            </div>
          </div>
        </div>

        {/* Status Badges Preview */}
        <div className="space-y-4">
          <h4 className="text-md font-medium">Status Indicators</h4>
          <div
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: "var(--preview-background)",
              borderColor: "var(--preview-border)",
              fontFamily: "var(--preview-font-family)",
            }}
          >
            <div className="flex flex-wrap gap-2">
              <Badge
                style={{
                  backgroundColor: "var(--preview-primary)",
                  color: "white",
                }}
              >
                <CheckIcon className="h-3 w-3 mr-1" />
                Active
              </Badge>
              <Badge
                variant="secondary"
                style={{
                  backgroundColor: "var(--preview-muted)",
                  color: "var(--preview-muted-foreground)",
                }}
              >
                Draft
              </Badge>
              <Badge
                style={{
                  backgroundColor: "var(--preview-accent)",
                  color: "white",
                }}
              >
                <StarIcon className="h-3 w-3 mr-1" />
                Featured
              </Badge>
              <Badge
                variant="destructive"
                style={{
                  backgroundColor: "var(--preview-destructive)",
                  color: "white",
                }}
              >
                Error
              </Badge>
            </div>
          </div>
        </div>

        {/* Email Template Preview */}
        <div className="space-y-4">
          <h4 className="text-md font-medium">Email Template Preview</h4>
          <div
            className="p-6 rounded-lg border"
            style={{
              backgroundColor: "var(--preview-background)",
              borderColor: "var(--preview-border)",
              fontFamily: "var(--preview-font-family)",
            }}
          >
            <div className="space-y-4">
              <div
                className="flex items-center gap-3 pb-4 border-b"
                style={{ borderColor: "var(--preview-border)" }}
              >
                {branding.logo.light && (
                  <img src={branding.logo.light} alt="Logo" className="h-6 w-auto" />
                )}
                <div
                  className="text-lg font-semibold"
                  style={{
                    color: "var(--preview-primary)",
                    fontFamily: "var(--preview-heading-font)",
                  }}
                >
                  Welcome to {branding.name}
                </div>
              </div>
              <div className="space-y-3">
                <p style={{ color: "var(--preview-foreground)" }}>
                  Thank you for joining our platform! We're excited to help you manage your
                  communications.
                </p>
                <Button
                  className="w-full"
                  style={{
                    backgroundColor: "var(--preview-primary)",
                    color: "white",
                  }}
                >
                  Get Started
                </Button>
                <p
                  className="text-sm text-center"
                  style={{ color: "var(--preview-muted-foreground)" }}
                >
                  If you have any questions, feel free to contact our support team.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
