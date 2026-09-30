import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { IconChevronDown, IconChevronUp, IconSettings } from "@tabler/icons-react";
import { ChannelConfigFields } from "./channel-config-fields";
import type { ChannelOption } from "./channel-options";

interface ChannelCardProps {
  channel: ChannelOption;
  selected: boolean;
  expanded: boolean;
  config: Record<string, unknown>;
  onToggle: (checked: boolean) => void;
  onExpand: () => void;
  onConfigChange: (config: Record<string, unknown>) => void;
}

export function ChannelCard({
  channel,
  selected,
  expanded,
  config,
  onToggle,
  onExpand,
  onConfigChange,
}: ChannelCardProps) {
  const Icon = channel.icon;

  return (
    <Card
      className={cn(
        "transition-all",
        selected ? "ring-2 ring-primary border-primary bg-primary/5" : "hover:border-primary/50",
      )}
    >
      <CardHeader>
        <div className="flex items-start gap-4">
          <Checkbox checked={selected} onCheckedChange={(checked) => onToggle(Boolean(checked))} />
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "rounded-lg p-2",
                selected ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              <Icon className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{channel.name}</CardTitle>
                {channel.popular ? (
                  <Badge variant="secondary" className="text-xs">
                    Popular
                  </Badge>
                ) : null}
              </div>
              <CardDescription className="mt-1">{channel.description}</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-2">
          {channel.features.map((feature) => (
            <Badge key={feature} variant="outline" className="text-xs">
              {feature}
            </Badge>
          ))}
        </div>
        {selected ? (
          <div className="mt-4 border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onExpand}
              className="h-auto w-full justify-between p-0"
            >
              <span className="flex items-center gap-2">
                <IconSettings data-icon="inline-start" />
                Configure {channel.name}
              </span>
              {expanded ? <IconChevronUp /> : <IconChevronDown />}
            </Button>
            {expanded ? (
              <div className="mt-4 flex flex-col gap-4 rounded-lg bg-muted/50 p-4">
                <ChannelConfigFields channel={channel} config={config} onChange={onConfigChange} />
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
