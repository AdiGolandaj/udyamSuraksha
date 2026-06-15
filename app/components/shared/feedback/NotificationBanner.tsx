import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Progress } from '~/components/ui/progress';
import { X, AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { cn } from '~/lib/utils';

interface NotificationBannerProps {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  autoDismissMs?: number;
}

const typeStyles = {
  info: {
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-900',
    icon: Info,
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-900',
    icon: AlertTriangle,
  },
  error: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-900',
    icon: AlertCircle,
  },
  success: {
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-900',
    icon: CheckCircle2,
  },
};

export function NotificationBanner({
  type,
  message,
  action,
  onDismiss,
  autoDismissMs,
}: NotificationBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(100);
  const styles = typeStyles[type];
  const Icon = styles.icon;

  useEffect(() => {
    if (!autoDismissMs) return;

    const interval = setInterval(() => {
      setProgress((prev) => Math.max(0, prev - 100 / (autoDismissMs / 100)));
    }, 100);

    const timeout = setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, autoDismissMs);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [autoDismissMs, onDismiss]);

  if (!isVisible) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  return (
    <div className="animate-in slide-in-from-top duration-300 mb-4">
      <Alert className={cn('border', styles.bg)}>
        <div className="flex items-start gap-3 pb-2">
          <Icon className="h-5 w-5 mt-0.5" />
          <div className="flex-1">
            <AlertDescription className={cn('text-sm font-medium', styles.text)}>
              {message}
            </AlertDescription>
          </div>
          <div className="flex gap-2 ml-2">
            {action && (
              <Button
                variant="ghost"
                size="sm"
                onClick={action.onClick}
                className="h-8 px-2 text-sm"
              >
                {action.label}
              </Button>
            )}
            <button
              onClick={handleDismiss}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {autoDismissMs && (
          <Progress value={progress} className="h-0.5 mt-2" />
        )}
      </Alert>
    </div>
  );
}
