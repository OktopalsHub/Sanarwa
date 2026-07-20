"use client";

import { Bell, Mail, MessageSquare, Phone, Send, Smartphone } from '@/lib/icons';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BellIcon, CheckCircleIcon, ClockIcon, EnvelopeIcon, ChatBubbleLeftRightIcon, PauseIcon, PhoneIcon, PlayIcon, PaperAirplaneIcon, DevicePhoneMobileIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from "react";

interface DemoStep {
  id: string;
  title: string;
  description: string;
  channel: "email" | "sms" | "push" | "in-app" | "voice";
  status: "pending" | "sending" | "delivered" | "read";
  delay: number;
}

const demoSteps: DemoStep[] = [
  {
    id: "welcome-email",
    title: "Welcome Email",
    description: "Send a personalized welcome email to new users",
    channel: "email",
    status: "pending",
    delay: 1000,
  },
  {
    id: "sms-verification",
    title: "SMS Verification",
    description: "Send verification code via SMS",
    channel: "sms",
    status: "pending",
    delay: 2000,
  },
  {
    id: "push-notification",
    title: "Push Notification",
    description: "Welcome push notification for mobile app",
    channel: "push",
    status: "pending",
    delay: 3000,
  },
  {
    id: "in-app-message",
    title: "In-App Message",
    description: "Show onboarding tips in the app",
    channel: "in-app",
    status: "pending",
    delay: 4000,
  },
  {
    id: "voice-call",
    title: "Voice Confirmation",
    description: "Optional voice call for high-value customers",
    channel: "voice",
    status: "pending",
    delay: 5000,
  },
];

const channelIcons = {
  email: Mail,
  sms: MessageSquare,
  push: Bell,
  "in-app": Smartphone,
  voice: Phone,
};

const channelColors = {
  email: "bg-blue-500",
  sms: "bg-green-500",
  push: "bg-orange-500",
  "in-app": "bg-purple-500",
  voice: "bg-red-500",
};

export function FeatureDemo() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState(demoSteps);
  const [completedSteps, setCompletedSteps] = useState(0);

  useEffect(() => {
    if (!isPlaying) return;

    const timer = setTimeout(() => {
      if (currentStep < steps.length) {
        // Update current step status
        setSteps(prev => prev.map((step, index) => {
          if (index === currentStep) {
            return { ...step, status: "sending" as const };
          }
          return step;
        }));

        // After a short delay, mark as delivered
        setTimeout(() => {
          setSteps(prev => prev.map((step, index) => {
            if (index === currentStep) {
              return { ...step, status: "delivered" as const };
            }
            return step;
          }));

          setCompletedSteps(prev => prev + 1);
          setCurrentStep(prev => prev + 1);
        }, 1500);
      } else {
        setIsPlaying(false);
      }
    }, steps[currentStep]?.delay || 1000);

    return () => clearTimeout(timer);
  }, [isPlaying, currentStep, steps]);

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStep(0);
    setCompletedSteps(0);
    setSteps(demoSteps.map(step => ({ ...step, status: "pending" as const })));
  };

  const getStatusIcon = (status: DemoStep["status"]) => {
    switch (status) {
      case "pending":
        return <ClockIcon className="h-4 w-4 text-muted-foreground" />;
      case "sending":
        return <PaperAirplaneIcon className="h-4 w-4 text-primary animate-pulse" />;
      case "delivered":
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case "read":
        return <CheckCircleIcon className="h-4 w-4 text-green-600" />;
    }
  };

  const getStatusText = (status: DemoStep["status"]) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "sending":
        return "Sending...";
      case "delivered":
        return "Delivered";
      case "read":
        return "Read";
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlayIcon className="h-5 w-5" />
          Interactive Demo: Multi-Channel Workflow
        </CardTitle>
        <CardDescription>
          Watch how Notifi orchestrates communications across multiple channels
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Demo Controls */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handlePlay}
            disabled={isPlaying || completedSteps === steps.length}
            size="sm"
          >
            <PlayIcon className="h-4 w-4 mr-1" />
            {completedSteps === steps.length ? "Complete" : "Start Demo"}
          </Button>
          <Button
            onClick={handlePause}
            disabled={!isPlaying}
            variant="outline"
            size="sm"
          >
            <PauseIcon className="h-4 w-4 mr-1" />
            Pause
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
            size="sm"
          >
            <ArrowPathIcon className="h-4 w-4 mr-1" />
            Reset
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{completedSteps}/{steps.length} completed</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(completedSteps / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Demo Steps */}
        <div className="space-y-3">
          {steps.map((step, index) => {
            const Icon = channelIcons[step.channel];
            const isActive = index === currentStep && isPlaying;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-4 p-4 rounded-lg border transition-all duration-300 ${isActive
                    ? "border-primary bg-primary/5 shadow-md"
                    : step.status === "delivered"
                      ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
                      : "border-border"
                  }`}
              >
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${channelColors[step.channel]} text-white`}>
                  <Icon className="h-5 w-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{step.title}</h4>
                    <Badge variant="outline" className="text-xs">
                      {step.channel.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusIcon(step.status)}
                  <span className="text-sm font-medium">
                    {getStatusText(step.status)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Demo Results */}
        {completedSteps === steps.length && (
          <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircleIcon className="h-5 w-5 text-green-600" />
              <h4 className="font-medium text-green-800 dark:text-green-200">
                Workflow Complete!
              </h4>
            </div>
            <p className="text-sm text-green-700 dark:text-green-300">
              All 5 communication channels have been successfully triggered.
              In a real scenario, this would result in higher engagement and better user experience.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}