"use client";

import { User } from "@/lib/icons";

import { Card } from "@/components/ui/card";
import {
  SignalIcon,
  ArrowRightIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  DevicePhoneMobileIcon,
  UserIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

interface JourneyStep {
  id: string;
  type: string;
  timestamp: Date;
  details: Record<string, any>;
  channel?: string;
  status?: string;
}

interface UserJourneyMapProps {
  steps: JourneyStep[];
  userIdentifier: string;
}

export function UserJourneyMap({ steps, userIdentifier }: UserJourneyMapProps) {
  const getIcon = (type: string, channel?: string) => {
    if (type.includes("notification")) {
      if (channel === "EMAIL") return <EnvelopeIcon className="h-5 w-5" />;
      if (channel === "SMS") return <ChatBubbleLeftRightIcon className="h-5 w-5" />;
      return <DevicePhoneMobileIcon className="h-5 w-5" />;
    }
    if (type.includes("login")) return <UserIcon className="h-5 w-5" />;
    return <SignalIcon className="h-5 w-5" />;
  };

  const getStatusColor = (status?: string) => {
    if (status === "success" || status === "delivered" || status === "opened")
      return "text-emerald-500";
    if (status === "failed" || status === "bounced") return "text-red-500";
    return "text-blue-500";
  };

  return (
    <Card className="glass border-border/50 p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">User Journey</h3>
          <p className="text-muted-foreground text-sm">Timeline for {userIdentifier}</p>
        </div>
        <div className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-medium">
          {steps.length} Interactions
        </div>
      </div>

      <div className="relative">
        {/* Vertical line */}
        <div className="bg-border absolute left-6 top-0 h-full w-0.5 -translate-x-1/2 transform" />

        <div className="space-y-8">
          {steps.map((step, index) => (
            <div key={step.id} className="relative flex items-start gap-6">
              {/* Icon bubble */}
              <div
                className={`relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border bg-background shadow-sm ${getStatusColor(
                  step.status,
                )}`}
              >
                {getIcon(step.type, step.channel)}
                {step.status === "success" && (
                  <div className="bg-background absolute -bottom-1 -right-1 rounded-full">
                    <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                  </div>
                )}
                {step.status === "failed" && (
                  <div className="bg-background absolute -bottom-1 -right-1 rounded-full">
                    <XCircleIcon className="h-4 w-4 text-red-500" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="glass border-border/50 flex-1 rounded-lg border p-4 transition-all hover:shadow-md">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h4 className="font-medium capitalize">{step.type.replace(/_/g, " ")}</h4>
                    <p className="text-muted-foreground text-sm">
                      {new Date(step.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {step.channel && (
                    <span className="bg-muted inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
                      {step.channel}
                    </span>
                  )}
                </div>

                {Object.keys(step.details).length > 0 && (
                  <div className="bg-muted/30 mt-3 rounded p-3 text-sm">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {Object.entries(step.details).map(([key, value]) => (
                        <div key={key} className="flex flex-col">
                          <span className="text-muted-foreground text-xs uppercase">{key}</span>
                          <span className="truncate font-medium">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Connector arrow for all but last item */}
              {index < steps.length - 1 && (
                <div className="absolute left-6 top-12 flex h-8 w-0.5 -translate-x-1/2 transform items-center justify-center">
                  <ArrowRightIcon className="text-muted-foreground/30 h-4 w-4 rotate-90" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
