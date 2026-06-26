import { Badge } from '~/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { Clock, Droplets, Flame, ShieldOff, Thermometer, Wind, AlertTriangle } from 'lucide-react'
import type { SensitivityType } from '~/lib/constants'

export interface SensitivityTagProps {
  type: SensitivityType
  size?: 'sm' | 'md'
  showIcon?: boolean
}

const sensitivityConfig: Record<
  SensitivityType,
  { label: string; icon: React.ElementType; bg: string; text: string }
> = {
  water: {
    label: 'Water-sensitive',
    icon: Droplets,
    bg: 'bg-blue-50',
    text: 'text-blue-700',
  },
  heat: {
    label: 'Heat-sensitive',
    icon: Thermometer,
    bg: 'bg-orange-50',
    text: 'text-orange-800',
  },
  fragile: {
    label: 'Fragile',
    icon: AlertTriangle,
    bg: 'bg-purple-50',
    text: 'text-purple-700',
  },
  perishable: {
    label: 'Perishable',
    icon: Clock,
    bg: 'bg-green-50',
    text: 'text-green-700',
  },
  flammable: {
    label: 'Flammable',
    icon: Flame,
    bg: 'bg-red-50',
    text: 'text-red-700',
  },
  theft: {
    label: 'Theft-prone',
    icon: ShieldOff,
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
  },
  humidity: {
    label: 'Humidity-sensitive',
    icon: Wind,
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
  },
}

const sizeClasses: Record<string, string> = {
  sm: 'text-caption px-2 py-1',
  md: 'text-body-sm px-3 py-1.5',
}

export function SensitivityTag({
  type,
  size = 'md',
  showIcon = false,
}: SensitivityTagProps) {
  const config = sensitivityConfig[type]
  if (!config) return null
  const IconComponent = config.icon

  const badge = (
    <Badge
      variant="outline"
      className={`${config.bg} ${config.text} border-0 font-medium ${sizeClasses[size]} inline-flex items-center gap-1.5`}
    >
      {showIcon && <IconComponent className={size === 'sm' ? 'size-3' : 'size-4'} />}
      <span>{config.label}</span>
    </Badge>
  )

  if (size === 'sm') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top">{config.label}</TooltipContent>
      </Tooltip>
    )
  }

  return badge
}
