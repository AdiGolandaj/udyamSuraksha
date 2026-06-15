import { cn } from '~/lib/utils';

interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'degraded' | 'active';
  label?: string;
  pulse?: boolean;
  size?: 'sm' | 'md';
}

const statusStyles = {
  online: 'bg-emerald-500',
  offline: 'bg-gray-500',
  degraded: 'bg-amber-500',
  active: 'bg-blue-500',
};

const sizeStyles = {
  sm: 'h-2 w-2',
  md: 'h-3 w-3',
};

export function StatusIndicator({
  status,
  label,
  pulse = false,
  size = 'md',
}: StatusIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div
          className={cn(
            'rounded-full',
            sizeStyles[size],
            statusStyles[status],
            pulse && 'animate-pulse',
          )}
        />
        {pulse && (
          <div
            className={cn(
              'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full',
              'animate-pulse',
              size === 'sm' ? 'h-4 w-4' : 'h-6 w-6',
              statusStyles[status],
              'opacity-50',
            )}
          />
        )}
      </div>
      {label && <span className="text-sm text-text-secondary">{label}</span>}
    </div>
  );
}
