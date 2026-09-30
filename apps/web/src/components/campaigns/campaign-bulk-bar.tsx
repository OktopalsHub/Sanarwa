import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IconPlayerPause, IconPlayerPlay, IconPlayerStop, IconX } from "@tabler/icons-react";

interface CampaignBulkBarProps {
  count: number;
  canPause: boolean;
  canResume: boolean;
  canStop: boolean;
  pausePending: boolean;
  resumePending: boolean;
  stopPending: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onClear: () => void;
}

export function CampaignBulkBar({
  count,
  canPause,
  canResume,
  canStop,
  pausePending,
  resumePending,
  stopPending,
  onPause,
  onResume,
  onStop,
  onClear,
}: CampaignBulkBarProps) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium">
              {count} campaign{count === 1 ? "" : "s"} selected
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onPause}
                disabled={pausePending || !canPause}
              >
                <IconPlayerPause data-icon="inline-start" />
                Pause Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onResume}
                disabled={resumePending || !canResume}
              >
                <IconPlayerPlay data-icon="inline-start" />
                Resume Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onStop}
                disabled={stopPending || !canStop}
                className="text-destructive hover:text-destructive"
              >
                <IconPlayerStop data-icon="inline-start" />
                Stop Selected
              </Button>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={onClear}>
            <IconX data-icon="inline-start" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
