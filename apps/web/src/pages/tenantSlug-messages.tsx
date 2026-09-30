'use client';

import { AppShell } from '@/components/layout';
import { MessageList } from '@/components/messages/message-list';

export default function MessagesPage() {
  return (
    <AppShell>
      <div className="p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
            <p className="text-muted-foreground">
              Delivery log across email, SMS, WhatsApp, push, and the rest of your channels.
            </p>
          </div>
          <MessageList />
        </div>
      </div>
    </AppShell>
  );
}
