"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowRightIcon, CheckCircleIcon, ArrowPathIcon, EnvelopeIcon } from '@heroicons/react/24/outline'
import { useState } from "react";

interface NewsletterSignupProps {
  variant?: "inline" | "card" | "minimal";
  className?: string;
}

export function NewsletterSignup({ variant = "card", className = "" }: NewsletterSignupProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);

    // Simulate API call
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setIsSubmitted(true);
      setEmail("");
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className={`${className} ${variant === "card" ? "p-6" : ""}`}>
        <div className="text-center">
          <div className="h-12 w-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="font-semibold mb-1">You&apos;re all set!</h3>
          <p className="text-sm text-muted-foreground">
            Thanks for subscribing. We&apos;ll keep you updated with the latest features and tips.
          </p>
        </div>
      </div>
    );
  }

  const content = (
    <div className={className}>
      <div className="space-y-4">
        {variant === "card" && (
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <EnvelopeIcon className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Stay Updated</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Get the latest features, tips, and developer resources delivered to your inbox.
            </p>
            <div className="flex items-center justify-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Weekly Updates
              </Badge>
              <Badge variant="secondary" className="text-xs">
                No Spam
              </Badge>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className={`flex gap-2 ${variant === "inline" ? "flex-row" : "flex-col sm:flex-row"}`}>
            <Input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
              disabled={isSubmitting}
            />
            <Button
              type="submit"
              disabled={isSubmitting || !email}
              className={variant === "minimal" ? "px-3" : ""}
            >
              {isSubmitting ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : variant === "minimal" ? (
                <ArrowRightIcon className="h-4 w-4" />
              ) : (
                "Subscribe"
              )}
            </Button>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {variant !== "minimal" && (
            <p className="text-xs text-muted-foreground">
              By subscribing, you agree to our privacy policy. Unsubscribe at any time.
            </p>
          )}
        </form>
      </div>
    </div>
  );

  if (variant === "card") {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          {content}
        </CardContent>
      </Card>
    );
  }

  return content;
}