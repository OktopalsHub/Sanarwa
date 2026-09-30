import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/utils/toast";

export function CampaignTestDialog({
  open,
  emails,
  pending,
  onOpenChange,
  onEmailsChange,
  onSend,
}: {
  open: boolean;
  emails: string;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onEmailsChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Test Campaign</DialogTitle>
          <DialogDescription>
            Send a test version of this campaign to specific email addresses.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="test-emails">Email Addresses</Label>
          <Textarea
            id="test-emails"
            placeholder="Enter email addresses separated by commas"
            value={emails}
            onChange={(event) => onEmailsChange(event.target.value)}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Separate multiple email addresses with commas
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSend} disabled={pending || !emails.trim()}>
            {pending ? "Sending..." : "Send Test"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CampaignScheduleDialog({
  open,
  date,
  time,
  onOpenChange,
  onDateChange,
  onTimeChange,
  onSchedule,
}: {
  open: boolean;
  date: string;
  time: string;
  onOpenChange: (open: boolean) => void;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onSchedule: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Campaign</DialogTitle>
          <DialogDescription>
            Set a specific date and time to automatically start this campaign.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-date">Date</Label>
            <Input
              id="schedule-date"
              type="date"
              value={date}
              onChange={(event) => onDateChange(event.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-time">Time</Label>
            <Input
              id="schedule-time"
              type="time"
              value={time}
              onChange={(event) => onTimeChange(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSchedule} disabled={!date || !time}>
            Schedule Campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function parseTestEmails(value: string) {
  const emails = value
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
  if (emails.length === 0) {
    toast.error("Please enter at least one email address");
    return null;
  }
  const invalid = emails.filter((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  if (invalid.length > 0) {
    toast.error(`Invalid email addresses: ${invalid.join(", ")}`);
    return null;
  }
  return emails;
}
