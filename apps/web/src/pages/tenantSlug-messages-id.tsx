'use client';

import { AppShell } from '@/components/layout';
import { MessageDetail } from '@/components/messages/message-detail';
import { useParams } from '@tanstack/react-router';

export default function MessageDetailPage() {
  const { id = '' } = useParams({ strict: false }) as { id?: string };

  return (
    <AppShell>
      <div className="p-6">
        <div className="mx-auto max-w-7xl">
          <MessageDetail messageId={id} />
        </div>
      </div>
    </AppShell>
  );
}
