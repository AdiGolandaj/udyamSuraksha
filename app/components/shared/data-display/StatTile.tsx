import { Skeleton } from '~/components/ui/skeleton'
import { cn } from '~/lib/utils'
import { TrendChip } from './TrendChip'
import type { ComponentType } from 'react'

export interface StatTileProps {
  label?: string
  /** Alias for label */
  title?: string
  value: string | number
  icon?: ComponentType<{ className?: string }>
  unit?: string
  trend?: {
    value: number
    direction: 'up' | 'down'
    label: string
    invertColor?: boolean
  }
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  isLoading?: boolean
  onClick?: () => void
}

const variantClasses: Record<string, string> = {
  default: 'bg-surface-secondary',
  success: 'bg-status-safe-bg',
  warning: 'bg-status-moderate-bg',
  danger: 'bg-status-critical-bg',
  info: 'bg-brand-secondary-light',
}

export function StatTile({
  label,
  title,
  value,
  icon: Icon,
  unit,
  trend,
  variant = 'default',
  isLoading,
  onClick,
}: StatTileProps) {
  const resolvedLabel = label ?? title

  if (isLoading) {
    return <Skeleton className="h-32 rounded-xl" />
  }

  return (
    <div
      className={cn(
        'rounded-xl p-4 md:p-5',
        variantClasses[variant],
        onClick && 'cursor-pointer hover:shadow-sm transition-shadow',
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-text-secondary text-caption font-medium">{resolvedLabel}</span>
        {Icon && <Icon className="size-5 text-text-secondary" />}
      </div>

      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-1">
          <span className="text-h2 font-semibold text-text-primary">{value}</span>
          {unit && <span className="text-body-sm text-text-secondary">{unit}</span>}
        </div>

        {trend && (
          <TrendChip
            value={trend.value}
            direction={trend.direction}
            label={trend.label}
            invertColor={trend.invertColor}
            size="sm"
          />
        )}
      </div>
    </div>
  )
}
