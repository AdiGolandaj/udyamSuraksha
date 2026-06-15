import { Switch } from '~/components/ui/switch';
import { Label } from '~/components/ui/label';
import { Separator } from '~/components/ui/separator';
import { useTranslation } from '~/hooks/useTranslation';
import { Bell, MessageSquare, Mail, Smartphone } from 'lucide-react';
import React from 'react';

interface NotificationChannel {
  key: 'app' | 'sms' | 'whatsapp' | 'email';
  label: string;
  description: string;
  icon: React.ElementType;
}

const DEFAULT_CHANNELS: NotificationChannel[] = [
  {
    key: 'app',
    label: 'In-App',
    description: 'Notifications within DisasterShield',
    icon: Bell,
  },
  {
    key: 'email',
    label: 'Email',
    description: 'Receive alerts via email',
    icon: Mail,
  },
  {
    key: 'sms',
    label: 'SMS',
    description: 'Receive alerts via SMS',
    icon: Smartphone,
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    description: 'Receive alerts via WhatsApp',
    icon: MessageSquare,
  },
];

interface NotificationToggleGroupProps {
  channels?: NotificationChannel[];
  enabled: Record<string, boolean>;
  onChange: (key: string, value: boolean) => void;
}

export function NotificationToggleGroup({
  channels = DEFAULT_CHANNELS,
  enabled,
  onChange,
}: NotificationToggleGroupProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{t('settings.notifications')}</h3>
        <p className="text-xs text-text-secondary">{t('settings.notificationDescription')}</p>
      </div>
      <Separator />
      <div className="space-y-4">
        {channels.map((channel, index) => {
          const IconComponent = channel.icon;
          return (
            <div key={channel.key}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <IconComponent className="h-5 w-5 text-text-secondary mt-0.5" />
                  <div className="space-y-1">
                    <Label htmlFor={channel.key} className="text-sm font-medium cursor-pointer">
                      {channel.label}
                    </Label>
                    <p className="text-xs text-text-secondary">{channel.description}</p>
                  </div>
                </div>
                <Switch
                  id={channel.key}
                  checked={enabled[channel.key] ?? false}
                  onCheckedChange={(value) => onChange(channel.key, value)}
                />
              </div>
              {index < channels.length - 1 && <Separator className="mt-4" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
