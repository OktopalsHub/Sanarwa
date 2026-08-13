'use client';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SendSnippet } from '@/components/messages/send-snippet';
import { Button } from '@/components/ui/button';
import { useTenantBasePath } from '@/hooks/use-tenant-slug';
import { messagingApi, type MessageLogListItem } from '@/lib/api/messaging';
import { projectApi } from '@/lib/api/project';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@/compat/next-navigation';
import { useState } from 'react';
import Link from '@/compat/next-link';

const CHANNELS = ['all', 'email', 'sms', 'whatsapp', 'push', 'in_app', 'voice'] as const;
const STATUSES = ['all', 'queued', 'sent', 'delivered', 'failed', 'cancelled'] as const;

function statusVariant(status: string) {
  if (status === 'delivered') return 'default';
  if (status === 'failed') return 'destructive';
  if (status === 'sent') return 'secondary';
  return 'outline';
}

function formatTime(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function MessageList() {
  const router = useRouter();
  const basePath = useTenantBasePath();
  const [channel, setChannel] = useState('all');
  const [status, setStatus] = useState('all');
  const [projectId, setProjectId] = useState('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'message-filter'],
    queryFn: () => projectApi.getProjects({ limit: 100 }),
  });
  const projects = projectsData?.data ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['messages', { channel, status, projectId, q, page }],
    queryFn: () =>
      messagingApi.list({
        page,
        limit: 25,
        channel: channel === 'all' ? undefined : channel,
        status: status === 'all' ? undefined : status,
        projectId: projectId === 'all' ? undefined : projectId,
        q: q || undefined,
      }),
  });

  const records: MessageLogListItem[] = data?.records ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          placeholder="Search recipient or tracking id"
          value={q}
          onChange={(event) => {
            setPage(1);
            setQ(event.target.value);
          }}
          className="md:max-w-sm"
        />
        <Select
          value={channel}
          onValueChange={(value) => {
            setPage(1);
            setChannel(value);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            {CHANNELS.map((item) => (
              <SelectItem key={item} value={item}>
                {item === 'all' ? 'All channels' : item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) => {
            setPage(1);
            setStatus(value);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((item) => (
              <SelectItem key={item} value={item}>
                {item === 'all' ? 'All statuses' : item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={projectId}
          onValueChange={(value) => {
            setPage(1);
            setProjectId(value);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-md border bg-muted/40" />
      ) : records.length === 0 ? (
        <div className="space-y-4 rounded-md border border-dashed p-8 text-center">
          <h3 className="text-lg font-semibold">No messages yet</h3>
          <p className="text-sm text-muted-foreground">
            Send from your app, then every delivery lands here.
          </p>
          <SendSnippet />
          <div className="flex justify-center gap-2">
            <Button asChild variant="outline">
              <Link href={`${basePath}/providers`}>Add a provider</Link>
            </Button>
            <Button asChild>
              <Link href={`${basePath}/api-keys`}>Create API key</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
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
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`${basePath}/messages/${row.id}`)}
                >
                  <TableCell>
                    <Badge variant="outline">{row.channel}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{row.to}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.subject || '—'}
                  </TableCell>
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
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {data?.totalItems ?? 0} message{(data?.totalItems ?? 0) === 1 ? '' : 's'}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= (data?.pageCount ?? 1)}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
