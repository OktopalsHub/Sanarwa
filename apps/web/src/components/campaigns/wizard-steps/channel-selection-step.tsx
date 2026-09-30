'use client';

import { Bell, Mail, MessageCircle, MessageSquare, Phone, Send, User } from '@/lib/icons';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CommunicationChannel } from '@/lib/types/campaign';
import { BellIcon, ChevronDownIcon, ChevronUpIcon, EnvelopeIcon, ChatBubbleLeftRightIcon, PhoneIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { useState } from 'react';

interface ChannelSelectionStepProps {
  data?: {
    selectedChannels: CommunicationChannel[];
    channelConfigs: Partial<Record<CommunicationChannel, any>>;
  };
  onUpdate: (data: {
    selectedChannels: CommunicationChannel[];
    channelConfigs: Partial<Record<CommunicationChannel, any>>;
  }) => void;
}

const CHANNELS = [
  {
    id: 'email' as const,
    name: 'Email',
    description: 'Send rich HTML emails with attachments and tracking',
    icon: Mail,
    features: ['Rich HTML content', 'Attachments', 'Open/click tracking', 'Personalization'],
    popular: true,
  },
  {
    id: 'sms' as const,
    name: 'SMS',
    description: 'Send text messages for immediate delivery',
    icon: MessageSquare,
    features: ['Instant delivery', 'High open rates', 'Global reach', 'Character limit: 160'],
    popular: true,
  },
  {
    id: 'whatsapp' as const,
    name: 'WhatsApp',
    description: 'Send WhatsApp Business messages',
    icon: MessageCircle,
    features: ['Template messages', 'Session replies', 'Media', 'Read receipts'],
    popular: true,
  },
  {
    id: 'push' as const,
    name: 'Push Notifications',
    description: 'Send notifications to mobile and web apps',
    icon: Bell,
    features: ['Real-time delivery', 'Rich media', 'Action buttons', 'Targeting'],
    popular: false,
  },
  {
    id: 'in_app' as const,
    name: 'In-App Messages',
    description: 'Display messages within your application',
    icon: MessageCircle,
    features: ['Contextual messaging', 'Rich formatting', 'Interactive elements', 'User targeting'],
    popular: false,
  },
  {
    id: 'voice' as const,
    name: 'Voice Calls',
    description: 'Make automated voice calls with text-to-speech',
    icon: Phone,
    features: ['Text-to-speech', 'Voice recordings', 'Call tracking', 'Global numbers'],
    popular: false,
  },
];

export function ChannelSelectionStep({ data, onUpdate }: ChannelSelectionStepProps) {
  const [selectedChannels, setSelectedChannels] = useState<CommunicationChannel[]>(
    data?.selectedChannels || []
  );
  const [channelConfigs, setChannelConfigs] = useState<Partial<Record<CommunicationChannel, any>>>(
    data?.channelConfigs || {}
  );
  const [expandedConfigs, setExpandedConfigs] = useState<Set<CommunicationChannel>>(new Set());

  const handleChannelToggle = (channelId: CommunicationChannel, checked: boolean) => {
    let newSelectedChannels: CommunicationChannel[];

    if (checked) {
      newSelectedChannels = [...selectedChannels, channelId];
    } else {
      newSelectedChannels = selectedChannels.filter(id => id !== channelId);
      // Remove config when channel is deselected
      const newConfigs = { ...channelConfigs };
      delete newConfigs[channelId];
      setChannelConfigs(newConfigs);
    }

    setSelectedChannels(newSelectedChannels);
    onUpdate({
      selectedChannels: newSelectedChannels,
      channelConfigs: channelConfigs,
    });
  };

  const updateChannelConfig = (channelId: CommunicationChannel, config: any) => {
    const newConfigs = {
      ...channelConfigs,
      [channelId]: { ...channelConfigs[channelId], ...config },
    };
    setChannelConfigs(newConfigs);
    onUpdate({
      selectedChannels,
      channelConfigs: newConfigs,
    });
  };

  const toggleConfigExpanded = (channelId: CommunicationChannel) => {
    const newExpanded = new Set(expandedConfigs);
    if (newExpanded.has(channelId)) {
      newExpanded.delete(channelId);
    } else {
      newExpanded.add(channelId);
    }
    setExpandedConfigs(newExpanded);
  };

  const renderChannelConfig = (channel: typeof CHANNELS[0]) => {
    const config = channelConfigs[channel.id] || {};
    const isExpanded = expandedConfigs.has(channel.id);

    if (!selectedChannels.includes(channel.id)) return null;

    return (
      <div className="mt-4 border-t pt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleConfigExpanded(channel.id)}
          className="w-full justify-between p-0 h-auto"
        >
          <div className="flex items-center gap-2">
            <Cog6ToothIcon className="w-4 h-4" />
            <span>Configure {channel.name}</span>
          </div>
          {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
        </Button>

        {isExpanded && (
          <div className="mt-4 space-y-4 p-4 bg-muted/50 rounded-lg">
            {channel.id === 'email' && (
              <>
                <div className="space-y-2">
                  <Label>From Name</Label>
                  <Input
                    placeholder="Your Company Name"
                    value={config.fromName || ''}
                    onChange={(e) => updateChannelConfig(channel.id, { fromName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reply-To Email</Label>
                  <Input
                    type="email"
                    placeholder="noreply@yourcompany.com"
                    value={config.replyTo || ''}
                    onChange={(e) => updateChannelConfig(channel.id, { replyTo: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email Priority</Label>
                  <Select
                    value={config.priority || 'normal'}
                    onValueChange={(value) => updateChannelConfig(channel.id, { priority: value })}
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
            )}

            {channel.id === 'sms' && (
              <>
                <div className="space-y-2">
                  <Label>Sender ID</Label>
                  <Input
                    placeholder="YourBrand"
                    maxLength={11}
                    value={config.senderId || ''}
                    onChange={(e) => updateChannelConfig(channel.id, { senderId: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Max 11 characters. Some countries may not support custom sender IDs.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Message Type</Label>
                  <Select
                    value={config.messageType || 'promotional'}
                    onValueChange={(value) => updateChannelConfig(channel.id, { messageType: value })}
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
            )}

            {channel.id === 'push' && (
              <>
                <div className="space-y-2">
                  <Label>Badge Count</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="1"
                    value={config.badge || ''}
                    onChange={(e) => updateChannelConfig(channel.id, { badge: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sound</Label>
                  <Select
                    value={config.sound || 'default'}
                    onValueChange={(value) => updateChannelConfig(channel.id, { sound: value })}
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
            )}

            {channel.id === 'in_app' && (
              <>
                <div className="space-y-2">
                  <Label>Display Position</Label>
                  <Select
                    value={config.position || 'top'}
                    onValueChange={(value) => updateChannelConfig(channel.id, { position: value })}
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
                <div className="space-y-2">
                  <Label>Auto Dismiss (seconds)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="5"
                    value={config.autoDismiss || ''}
                    onChange={(e) => updateChannelConfig(channel.id, { autoDismiss: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </>
            )}

            {channel.id === 'voice' && (
              <>
                <div className="space-y-2">
                  <Label>Voice</Label>
                  <Select
                    value={config.voice || 'female'}
                    onValueChange={(value) => updateChannelConfig(channel.id, { voice: value })}
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
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select
                    value={config.language || 'en-US'}
                    onValueChange={(value) => updateChannelConfig(channel.id, { language: value })}
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
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">
        Select the communication channels you want to use for this campaign. You can configure each channel's specific settings after selection.
      </div>

      <div className="grid gap-4">
        {CHANNELS.map((channel) => {
          const Icon = channel.icon;
          const isSelected = selectedChannels.includes(channel.id);

          return (
            <Card
              key={channel.id}
              className={`transition-all ${isSelected
                ? 'ring-2 ring-primary border-primary bg-primary/5'
                : 'hover:border-primary/50'
                }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        handleChannelToggle(channel.id, checked as boolean)
                      }
                    />
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{channel.name}</CardTitle>
                          {channel.popular && (
                            <Badge variant="secondary" className="text-xs">
                              Popular
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="mt-1">
                          {channel.description}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  {channel.features.map((feature) => (
                    <Badge key={feature} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>

                {renderChannelConfig(channel)}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedChannels.length > 0 && (
        <Card className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="font-medium">
                {selectedChannels.length} channel{selectedChannels.length > 1 ? 's' : ''} selected
              </span>
            </div>
            <p className="text-sm text-green-600 dark:text-green-500 mt-1">
              Your campaign will be sent through: {selectedChannels.join(', ')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}