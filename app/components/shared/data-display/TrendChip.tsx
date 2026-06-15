import { cn } from '~/lib/utils'
import { TrendingDown, TrendingUp } from 'lucide-react'

export interface TrendChipProps {
  value: number
  unit?: string
  direction: 'up' | 'down'
  label?: string
  invertColor?: boolean
  size?: 'sm' | 'md'
}

export function TrendChip({
  value,
  unit = '',
  direction,
  label,
  invertColor = false,
  size = 'md',
}: TrendChipProps) {
  const isUp = direction === 'up'
  const isGood = invertColor ? !isUp : isUp

  const colorClass = isGood ? 'text-status-safe' : 'text-status-critical'
  const sizeClass = size === 'sm' ? 'text-caption' : 'text-body-sm'

  const IconComponent = isUp ? TrendingUp : TrendingDown
  const iconSize = size === 'sm' ? 'size-3' : 'size-4'

  return (
    <div className={cn('inline-flex items-center gap-1', colorClass, sizeClass)}>
      <IconComponent className={iconSize} />
      <span className="font-medium">
        {isUp ? '+' : '-'}
        {value}
        {unit}
      </span>
      {label && <span className="text-text-tertiary text-caption">{label}</span>}
    </div>
  )
}
