import { Card, CardContent, CardHeader } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { cn } from '~/lib/utils'
import { Phone, MapPin } from 'lucide-react'
import { RiskBadge } from './RiskBadge'
import type { RiskLevel } from '~/lib/constants'

export interface ShopCardProps {
  shopId: string
  shopName: string
  ownerName: string
  category: string
  location: string
  riskLevel: RiskLevel
  contactNumber?: string
  lastActive?: string
  isOffline?: boolean
  onContact?: () => void
  href: string
}

export function ShopCard({
  shopName,
  ownerName,
  category,
  location,
  riskLevel,
  lastActive,
  isOffline = false,
  onContact,
}: ShopCardProps) {
  const timeAgo = lastActive ? getRelativeTime(lastActive) : null

  return (
    <Card className={cn(isOffline && 'opacity-60')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-h3 font-semibold text-text-primary truncate">
              {shopName}
            </h3>
            <p className="text-body-sm text-text-secondary truncate">{ownerName}</p>
          </div>
          <RiskBadge level={riskLevel} size="sm" />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-2 text-body-sm">
          <p>
            <span className="text-text-secondary">Category:</span>
            <span className="ml-2 text-text-primary font-medium">{category}</span>
          </p>
          <div className="flex items-center gap-2 text-text-secondary">
            <MapPin className="size-4" />
            <span>{location}</span>
          </div>
          {timeAgo && (
            <p className="text-text-tertiary">Last active: {timeAgo}</p>
          )}
        </div>

        <Button
          onClick={onContact}
          size="sm"
          className="w-full"
          variant="default"
        >
          <Phone className="size-4 mr-2" />
          Contact
        </Button>
      </CardContent>
    </Card>
  )
}

function getRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
