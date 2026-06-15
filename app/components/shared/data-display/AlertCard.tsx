import { Card, CardContent } from '~/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'
import { ChevronDown } from 'lucide-react'
import { RiskBadge } from './RiskBadge'
import { SensitivityTag } from './SensitivityTag'
import type { SensitivityType } from '~/lib/constants'

export interface AlertAction {
  label: string
  actionType: 'mark-secured' | 'notify-employees' | 'request-support' | 'confirm'
  isCompleted?: boolean
}

export interface AlertCardProps {
  alertId: string
  title: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: string
  issuedAt: string
  affectedItems: string[]
  summary: string
  actions?: AlertAction[]
  isRead?: boolean
  isExpanded?: boolean
  language?: 'en' | 'mr' | 'hi'
  onActionClick?: (actionType: string) => void
  href?: string
}

const severityToRiskLevel: Record<string, string> = {
  low: 'safe',
  medium: 'moderate',
  high: 'high',
  critical: 'critical',
}

const borderColors: Record<string, string> = {
  low: 'border-l-status-safe',
  medium: 'border-l-status-moderate',
  high: 'border-l-status-high',
  critical: 'border-l-status-critical',
}

export function AlertCard({
  alertId,
  title,
  severity,
  category,
  issuedAt,
  affectedItems,
  summary,
  actions,
  isRead = true,
  isExpanded = false,
  onActionClick,
  href,
}: AlertCardProps) {
  const [open, setOpen] = React.useState(isExpanded)
  const riskLevel = severityToRiskLevel[severity] as any
  const timeAgo = getRelativeTime(issuedAt)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card
        className={cn(
          'border-l-4',
          borderColors[severity],
          !isRead && 'bg-brand-primary-light',
        )}
      >
        <CollapsibleTrigger asChild>
          <div className="p-4 md:p-5 cursor-pointer hover:bg-surface-secondary/50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-h3 font-semibold text-text-primary truncate">
                    {title}
                  </h3>
                  <RiskBadge level={riskLevel} size="sm" />
                </div>
                <div className="flex items-center gap-2 mb-2 text-body-sm text-text-secondary">
                  <span>{category}</span>
                  <span>•</span>
                  <span>{timeAgo}</span>
                </div>
              </div>
              <ChevronDown
                className={cn(
                  'size-5 text-text-secondary transition-transform shrink-0',
                  open && 'rotate-180',
                )}
              />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 md:pb-5 border-t border-border-default">
            <div className="space-y-4">
              <p className="text-body text-text-primary">{summary}</p>

              {affectedItems.length > 0 && (
                <div>
                  <p className="text-caption font-medium text-text-secondary mb-2">
                    Affected Items:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {affectedItems.map((item, idx) => (
                      <SensitivityTag
                        key={idx}
                        type={inferSensitivityType(item)}
                        size="sm"
                        showIcon
                      />
                    ))}
                  </div>
                </div>
              )}

              {actions && actions.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {actions.map((action, idx) => (
                    <Button
                      key={idx}
                      variant="ghost"
                      size="sm"
                      disabled={action.isCompleted}
                      onClick={() => onActionClick?.(action.actionType)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

import React from 'react'

function getRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function inferSensitivityType(itemName: string): SensitivityType {
  const lower = itemName.toLowerCase()
  if (lower.includes('water')) return 'water'
  if (lower.includes('heat')) return 'heat'
  if (lower.includes('fragile')) return 'fragile'
  if (lower.includes('perishable')) return 'perishable'
  if (lower.includes('flammable')) return 'flammable'
  if (lower.includes('theft')) return 'theft'
  if (lower.includes('humidity')) return 'humidity'
  return 'water'
}
