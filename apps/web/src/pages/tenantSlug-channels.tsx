"use client";

import { AppShell } from "@/components/layout";
import { ChannelCard } from "@/components/channels/channel-card";
import { WhatsAppEmbeddedSignup } from "@/components/whatsapp/whatsapp-embedded-signup";
import { WhatsAppTemplateManager } from "@/components/whatsapp/whatsapp-template-manager";
import { useChannels } from "@/lib/query/hooks/use-channels";
import { useTenant } from "@/contexts/tenant-context";
import { Card, CardContent, CardHeader } from "@sanarwa/ui/card";

export default function ChannelsPage() {
  const { selectedTenant } = useTenant();
  const tenantId = selectedTenant?.id;
  const { data: channels, isLoading } = useChannels(tenantId);

  const find = (providerId: string) =>
    channels?.find((c) => c.providerId === providerId) ?? {
      connected: false,
      connection: null,
    };

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-6">
          <Card className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-1/3" />
            </CardHeader>
            <CardContent>
              <div className="h-3 bg-muted rounded w-3/4" />
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">Channels</h1>
            <p className="text-muted-foreground">
              Connect your own Slack, Discord, Telegram and WhatsApp Business accounts. Credentials
              are stored encrypted per workspace — Sanarwa never shares a platform account.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChannelCard
              providerId="slack"
              title="Slack"
              description="Bot token or incoming webhook. Sends post to channels directly."
              fields={[
                {
                  key: "botToken",
                  label: "Bot token (xoxb-...)",
                  placeholder: "xoxb-...",
                  weight: "bot token",
                },
                {
                  key: "webhookUrl",
                  label: "Webhook URL (alternative)",
                  placeholder: "https://hooks.slack.com/services/...",
                },
                { key: "defaultChannel", label: "Default channel ID", placeholder: "C0123456789" },
              ]}
              helpUrl="https://docs.slack.dev/authentication/creating-your-first-app"
              helpLabel="Slack app setup"
              summary={find("slack") as any}
            />

            <ChannelCard
              providerId="discord"
              title="Discord"
              description="Posts through a Discord channel webhook."
              fields={[
                {
                  key: "webhookUrl",
                  label: "Webhook URL",
                  placeholder: "https://discord.com/api/webhooks/...",
                  required: true,
                },
                { key: "username", label: "Sender name (optional)", placeholder: "Sanarwa" },
                { key: "avatarUrl", label: "Avatar URL (optional)", placeholder: "https://..." },
              ]}
              helpUrl="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
              helpLabel="Discord webhooks"
              summary={find("discord") as any}
            />

            <ChannelCard
              providerId="telegram"
              title="Telegram"
              description="Bot token from @BotFather plus the chat you want to reach."
              fields={[
                {
                  key: "botToken",
                  label: "Bot token",
                  placeholder: "123456789:AAE...",
                  required: true,
                },
                {
                  key: "defaultChatId",
                  label: "Default chat ID (optional)",
                  placeholder: "-1001234567890",
                },
              ]}
              helpUrl="https://core.telegram.org/bots/tutorial"
              helpLabel="Telegram bots"
              summary={find("telegram") as any}
            />

            <WhatsAppEmbeddedSignup />
          </div>

          <WhatsAppTemplateManager />
        </div>
      </div>
    </AppShell>
  );
}
