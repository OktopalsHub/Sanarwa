import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChannelOption } from "./channel-options";

type ChannelConfig = Record<string, unknown>;

interface ChannelConfigFieldsProps {
  channel: ChannelOption;
  config: ChannelConfig;
  onChange: (config: ChannelConfig) => void;
}

export function ChannelConfigFields({ channel, config, onChange }: ChannelConfigFieldsProps) {
  const set = (key: string, value: unknown) => onChange({ [key]: value });

  if (channel.id === "email") {
    return (
      <>
        <div className="flex flex-col gap-2">
          <Label>From Name</Label>
          <Input
            placeholder="Your Company Name"
            value={(config.fromName as string) || ""}
            onChange={(event) => set("fromName", event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Reply-To Email</Label>
          <Input
            type="email"
            placeholder="noreply@yourcompany.com"
            value={(config.replyTo as string) || ""}
            onChange={(event) => set("replyTo", event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Email Priority</Label>
          <Select
            value={(config.priority as string) || "normal"}
            onValueChange={(value) => set("priority", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </>
    );
  }

  if (channel.id === "sms") {
    return (
      <>
        <div className="flex flex-col gap-2">
          <Label>Sender ID</Label>
          <Input
            placeholder="YourBrand"
            maxLength={11}
            value={(config.senderId as string) || ""}
            onChange={(event) => set("senderId", event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Max 11 characters. Some countries may not support custom sender IDs.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Message Type</Label>
          <Select
            value={(config.messageType as string) || "promotional"}
            onValueChange={(value) => set("messageType", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="promotional">Promotional</SelectItem>
              <SelectItem value="transactional">Transactional</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </>
    );
  }

  if (channel.id === "push") {
    return (
      <>
        <div className="flex flex-col gap-2">
          <Label>Badge Count</Label>
          <Input
            type="number"
            min="0"
            placeholder="1"
            value={(config.badge as number | string) || ""}
            onChange={(event) => set("badge", parseInt(event.target.value) || 0)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Sound</Label>
          <Select
            value={(config.sound as string) || "default"}
            onValueChange={(value) => set("sound", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </>
    );
  }

  if (channel.id === "in_app") {
    return (
      <>
        <div className="flex flex-col gap-2">
          <Label>Display Position</Label>
          <Select
            value={(config.position as string) || "top"}
            onValueChange={(value) => set("position", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top">Top</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="bottom">Bottom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Auto Dismiss (seconds)</Label>
          <Input
            type="number"
            min="0"
            placeholder="5"
            value={(config.autoDismiss as number | string) || ""}
            onChange={(event) => set("autoDismiss", parseInt(event.target.value) || 0)}
          />
        </div>
      </>
    );
  }

  if (channel.id === "voice") {
    return (
      <>
        <div className="flex flex-col gap-2">
          <Label>Voice</Label>
          <Select
            value={(config.voice as string) || "female"}
            onValueChange={(value) => set("voice", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="male">Male</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Language</Label>
          <Select
            value={(config.language as string) || "en-US"}
            onValueChange={(value) => set("language", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en-US">English (US)</SelectItem>
              <SelectItem value="en-GB">English (UK)</SelectItem>
              <SelectItem value="es-ES">Spanish</SelectItem>
              <SelectItem value="fr-FR">French</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </>
    );
  }

  return null;
}
