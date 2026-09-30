"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tenant } from "@/lib/types/tenant";
import {
  CheckIcon,
  CreditCardIcon,
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  StarIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { toast } from "sonner";

interface TenantBillingSettingsProps {
  tenant: Tenant;
}

interface PlanFeature {
  name: string;
  included: boolean;
  limit?: string;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: "month" | "year";
  features: PlanFeature[];
  popular?: boolean;
  current?: boolean;
}

const plans: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    interval: "month",
    features: [
      { name: "Up to 1,000 messages/month", included: true },
      { name: "Email & SMS channels", included: true },
      { name: "Basic templates", included: true },
      { name: "Up to 3 team members", included: true },
      { name: "Community support", included: true },
      { name: "Advanced analytics", included: false },
      { name: "Custom branding", included: false },
      { name: "API access", included: false },
      { name: "Priority support", included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    interval: "month",
    popular: true,
    features: [
      { name: "Up to 50,000 messages/month", included: true },
      { name: "All communication channels", included: true },
      { name: "Advanced workflow builder", included: true },
      { name: "Up to 25 team members", included: true },
      { name: "Advanced analytics", included: true },
      { name: "Custom branding", included: true },
      { name: "API access", included: true },
      { name: "Priority support", included: true },
      { name: "A/B testing", included: true },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 199,
    interval: "month",
    features: [
      { name: "Unlimited messages", included: true },
      { name: "All communication channels", included: true },
      { name: "Advanced workflow builder", included: true },
      { name: "Unlimited team members", included: true },
      { name: "Advanced analytics", included: true },
      { name: "Custom branding", included: true },
      { name: "API access", included: true },
      { name: "Dedicated support", included: true },
      { name: "Custom integrations", included: true },
      { name: "SLA guarantee", included: true },
    ],
  },
];

// Mock usage data - in real app this would come from API
const mockUsageData = {
  messages: {
    used: 2847,
    limit: 50000,
    percentage: 5.7,
  },
  members: {
    used: 8,
    limit: 25,
    percentage: 32,
  },
  apiCalls: {
    used: 15420,
    limit: 100000,
    percentage: 15.4,
  },
};

export function TenantBillingSettings({ tenant }: TenantBillingSettingsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const currentPlan = plans.find((plan) => plan.id === tenant.subscription) || plans[0];

  const handleUpgrade = async (planId: string) => {
    setIsLoading(true);
    try {
      // In a real app, this would redirect to Stripe or handle payment
      const response = await fetch(`/api/billing/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tenantId: tenant.id, planId }),
      });

      if (!response.ok) {
        throw new Error("Failed to initiate upgrade");
      }

      const { checkoutUrl } = await response.json();
      window.location.href = checkoutUrl;
    } catch (error) {
      toast.error("Failed to upgrade subscription");
      console.error("Upgrade error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/billing/portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tenantId: tenant.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to access billing portal");
      }

      const { portalUrl } = await response.json();
      window.open(portalUrl, "_blank");
    } catch (error) {
      toast.error("Failed to access billing portal");
      console.error("Billing portal error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadInvoice = async () => {
    try {
      const response = await fetch(`/api/billing/invoices/latest`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to download invoice");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${tenant.slug || tenant.id}-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Invoice downloaded successfully");
    } catch (error) {
      toast.error("Failed to download invoice");
      console.error("Invoice download error:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Subscription</CardTitle>
          <CardDescription>
            You are currently on the {currentPlan?.name || "Free"} plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold">{currentPlan?.name || "Free"}</h3>
              <p className="text-muted-foreground">
                ${currentPlan?.price || 0}/{currentPlan?.interval || "month"}
              </p>
            </div>
            {tenant.subscription && tenant.subscription !== "free" && (
              <div className="flex gap-2">
                <Button onClick={handleManageBilling} variant="outline" disabled={isLoading}>
                  <CreditCardIcon className="mr-2 h-4 w-4" />
                  Manage Billing
                </Button>
                <Button onClick={handleDownloadInvoice} variant="outline" disabled={isLoading}>
                  <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
                  Download Invoice
                </Button>
              </div>
            )}
          </div>

          {/* Usage Statistics */}
          <div className="space-y-4">
            <h4 className="font-medium">Usage This Month</h4>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Messages Sent</span>
                  <span>
                    {mockUsageData.messages.used.toLocaleString()} /{" "}
                    {mockUsageData.messages.limit.toLocaleString()}
                  </span>
                </div>
                <Progress value={mockUsageData.messages.percentage} className="h-2" />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Team Members</span>
                  <span>
                    {mockUsageData.members.used} / {mockUsageData.members.limit}
                  </span>
                </div>
                <Progress value={mockUsageData.members.percentage} className="h-2" />
              </div>

              {tenant.subscription && tenant.subscription !== "free" && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>API Calls</span>
                    <span>
                      {mockUsageData.apiCalls.used.toLocaleString()} /{" "}
                      {mockUsageData.apiCalls.limit.toLocaleString()}
                    </span>
                  </div>
                  <Progress value={mockUsageData.apiCalls.percentage} className="h-2" />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>
            Choose the plan that best fits your organization's needs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-lg border p-6 ${
                  plan.popular ? "border-primary shadow-md" : "border-border"
                } ${plan.id === tenant.subscription ? "bg-muted/50" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                      <StarIcon className="h-3 w-3" />
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/{plan.interval}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckIcon
                        className={`h-4 w-4 mt-0.5 ${
                          feature.included ? "text-green-500" : "text-muted-foreground"
                        }`}
                      />
                      <span
                        className={`text-sm ${
                          feature.included ? "" : "text-muted-foreground line-through"
                        }`}
                      >
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isLoading || plan.id === tenant.subscription}
                  className="w-full"
                  variant={plan.id === tenant.subscription ? "secondary" : "default"}
                >
                  {plan.id === tenant.subscription ? (
                    "Current Plan"
                  ) : plan.id === "free" ? (
                    "Downgrade"
                  ) : (
                    <>
                      <BoltIcon className="mr-2 h-4 w-4" />
                      Upgrade to {plan.name}
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Billing Information */}
      {tenant.subscription && tenant.subscription !== "free" && (
        <Card>
          <CardHeader>
            <CardTitle>Billing Information</CardTitle>
            <CardDescription>Manage your payment methods and billing details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Next billing date</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <Button onClick={handleManageBilling} variant="outline" disabled={isLoading}>
                <ArrowTopRightOnSquareIcon className="mr-2 h-4 w-4" />
                Manage in Stripe
              </Button>
            </div>

            <Separator />

            <div className="text-sm text-muted-foreground">
              <p>
                Your subscription will automatically renew on the next billing date. You can cancel
                or modify your subscription at any time through the billing portal.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
