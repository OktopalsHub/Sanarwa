import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SendSnippet } from "@/components/messages/send-snippet";
import type { MessageLogListItem } from "@/lib/api/messaging";
import Link from "@/compat/next-link";

function statusVariant(status: string) {
  if (status === "delivered") return "default" as const;
  if (status === "failed") return "destructive" as const;
  if (status === "sent") return "secondary" as const;
  return "outline" as const;
}

function formatTime(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function MessageEmpty({ basePath }: { basePath: string }) {
  return (
    <Empty className="border w-full">
      <EmptyHeader>
        <EmptyTitle>No messages yet</EmptyTitle>
        <EmptyDescription>Send from your app, then every delivery lands here.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-2xl">
        <SendSnippet />
        <div className="flex justify-center gap-2">
          <Button asChild variant="outline">
            <Link href={`${basePath}/providers`}>Add a provider</Link>
          </Button>
          <Button asChild>
            <Link href={`${basePath}/api-keys`}>Create API key</Link>
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}

export function MessageTable({
  records,
  onOpen,
}: {
  records: MessageLogListItem[];
  onOpen: (id: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Channel</TableHead>
          <TableHead>To</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Sent</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((row) => (
          <TableRow key={row.id} className="cursor-pointer" onClick={() => onOpen(row.id)}>
            <TableCell>
              <Badge variant="outline">{row.channel}</Badge>
            </TableCell>
            <TableCell className="font-medium">{row.to}</TableCell>
            <TableCell className="text-muted-foreground">{row.subject || "—"}</TableCell>
            <TableCell>
              <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {formatTime(row.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
