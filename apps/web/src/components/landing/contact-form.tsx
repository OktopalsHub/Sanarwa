"use client";

import { Mail, MessageSquare, Phone, Send } from '@/lib/icons';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircleIcon, ArrowPathIcon, EnvelopeIcon, ChatBubbleLeftRightIcon, PhoneIcon } from '@heroicons/react/24/outline'
import { useState } from "react";

interface ContactFormProps {
  type?: "contact" | "demo" | "newsletter";
  onClose?: () => void;
}

export function ContactForm({ type = "contact", onClose }: ContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    role: "",
    phone: "",
    message: "",
    interestedChannels: [] as string[],
    newsletter: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));

    setIsSubmitting(false);
    setIsSubmitted(true);

    // Auto-close after success
    setTimeout(() => {
      onClose?.();
    }, 3000);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleChannelToggle = (channel: string) => {
    setFormData(prev => ({
      ...prev,
      interestedChannels: prev.interestedChannels.includes(channel)
        ? prev.interestedChannels.filter(c => c !== channel)
        : [...prev.interestedChannels, channel]
    }));
  };

  if (isSubmitted) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6 text-center">
          <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircleIcon className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Thank You!</h3>
          <p className="text-muted-foreground">
            {type === "demo"
              ? "We'll be in touch soon to schedule your demo."
              : type === "newsletter"
                ? "You've been subscribed to our newsletter."
                : "We've received your message and will get back to you soon."
            }
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {type === "demo" ? (
            <>
              <ChatBubbleLeftRightIcon className="h-5 w-5" />
              Schedule a Demo
            </>
          ) : type === "newsletter" ? (
            <>
              <EnvelopeIcon className="h-5 w-5" />
              Subscribe to Newsletter
            </>
          ) : (
            <>
              <EnvelopeIcon className="h-5 w-5" />
              Get in Touch
            </>
          )}
        </CardTitle>
        <CardDescription>
          {type === "demo"
            ? "See Notifi in action with a personalized demo"
            : type === "newsletter"
              ? "Stay updated with the latest features and updates"
              : "We'd love to hear from you. Send us a message!"
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                required
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                required
                placeholder="john@company.com"
              />
            </div>
          </div>

          {type !== "newsletter" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => handleInputChange("company", e.target.value)}
                    placeholder="Acme Inc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select onValueChange={(value) => handleInputChange("role", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="developer">Developer</SelectItem>
                      <SelectItem value="cto">CTO</SelectItem>
                      <SelectItem value="product-manager">Product Manager</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="founder">Founder</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {type === "demo" && (
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (Optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Interested Channels</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "email", label: "Email", icon: Mail },
                    { id: "sms", label: "SMS", icon: MessageSquare },
                    { id: "push", label: "Push", icon: Phone },
                    { id: "in-app", label: "In-App", icon: MessageSquare },
                  ].map(({ id, label, icon: Icon }) => (
                    <div key={id} className="flex items-center space-x-2">
                      <Checkbox
                        id={id}
                        checked={formData.interestedChannels.includes(id)}
                        onCheckedChange={() => handleChannelToggle(id)}
                      />
                      <Label htmlFor={id} className="flex items-center gap-1 text-sm">
                        <Icon className="h-3 w-3" />
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">
                  {type === "demo" ? "What would you like to see in the demo?" : "Message"}
                </Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => handleInputChange("message", e.target.value)}
                  placeholder={
                    type === "demo"
                      ? "Tell us about your use case and what you'd like to see..."
                      : "Tell us about your project or ask any questions..."
                  }
                  rows={3}
                />
              </div>
            </>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="newsletter"
              checked={formData.newsletter}
              onCheckedChange={(checked) =>
                setFormData(prev => ({ ...prev, newsletter: checked as boolean }))
              }
            />
            <Label htmlFor="newsletter" className="text-sm">
              Subscribe to our newsletter for updates and tips
            </Label>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" />
                {type === "demo" ? "Scheduling..." : "Sending..."}
              </>
            ) : (
              type === "demo" ? "Schedule Demo" : type === "newsletter" ? "Subscribe" : "Send Message"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}