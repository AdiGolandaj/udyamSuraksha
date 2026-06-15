import { Alert, AlertDescription } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { cn } from '~/lib/utils';
import { useTranslation } from '~/hooks/useTranslation';

interface ErrorCardProps {
  title?: string;
  message?: string;
  /** Raw error — message is derived when message prop is omitted */
  error?: unknown;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorCard({
  title,
  message,
  error,
  onRetry,
  compact = false,
}: ErrorCardProps) {
  const { t } = useTranslation();
  const resolvedMessage = message ?? (error instanceof Error ? error.message : 'An unexpected error occurred');

  return (
    <Alert variant="destructive" className={cn('bg-red-50 border-red-200', compact && 'p-3')}>
      <div className="flex items-start gap-3">
        <AlertCircle className={cn('text-red-600 shrink-0', compact ? 'h-4 w-4 mt-0.5' : 'h-5 w-5 mt-1')} />
        <div className="flex-1">
          {title && (
            <h3 className={cn('font-semibold text-red-900', compact ? 'text-sm' : 'text-base')}>
              {title}
            </h3>
          )}
          <AlertDescription className={cn('text-red-800 mt-1', compact && 'text-sm')}>
            {resolvedMessage}
          </AlertDescription>
          {onRetry && (
            <Button
              variant="outline"
              size={compact ? 'sm' : 'default'}
              onClick={onRetry}
              className={cn('mt-3 border-red-300 hover:bg-red-100', compact && 'h-8 text-sm')}
            >
              {t('common.retry')}
            </Button>
          )}
        </div>
      </div>
    </Alert>
  );
}
