import { Badge } from '~/components/ui/badge'
import { cn } from '~/lib/utils'
import { AlertOctagon, AlertTriangle, ShieldCheck, WifiOff } from 'lucide-react'
import type { RiskLevel } from '~/lib/constants'

export interface RiskBadgeProps {
  level: RiskLevel
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  showLabel?: boolean
  pulse?: boolean
  /** Optional numeric score (0-100), displayed alongside the badge */
  score?: number
}

const riskConfig: Record<
  RiskLevel,
  { icon: React.ElementType; label: string; bg: string; text: string }
> = {
  safe: {
    icon: ShieldCheck,
    label: 'Safe',
    bg: 'bg-status-safe-bg',
    text: 'text-status-safe',
  },
  moderate: {
    icon: AlertTriangle,
    label: 'Moderate Risk',
    bg: 'bg-status-moderate-bg',
    text: 'text-status-moderate',
  },
  high: {
    icon: AlertTriangle,
    label: 'High Risk',
    bg: 'bg-status-high-bg',
    text: 'text-status-high',
  },
  critical: {
    icon: AlertOctagon,
    label: 'Critical',
    bg: 'bg-status-critical-bg',
    text: 'text-status-critical',
  },
  offline: {
    icon: WifiOff,
    label: 'Offline',
    bg: 'bg-status-offline-bg',
    text: 'text-status-offline',
  },
}

const sizeClasses: Record<string, string> = {
  sm: 'text-caption px-2 py-1',
  md: 'text-body-sm px-3 py-1.5',
  lg: 'text-body px-4 py-2',
}

export function RiskBadge({
  level,
  size = 'md',
  showIcon = true,
  showLabel = true,
  pulse = false,
}: RiskBadgeProps) {
  const config = riskConfig[level]
  const IconComponent = config.icon

  return (
    <div
      className={cn('inline-flex items-center gap-1.5', pulse && 'animate-pulse')}
    >
      <div
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full font-medium',
          config.bg,
          config.text,
          sizeClasses[size],
        )}
      >
        {showIcon && <IconComponent className={size === 'sm' ? 'size-4' : 'size-5'} />}
        {showLabel && <span>{config.label}</span>}
      </div>
    </div>
  )
}
