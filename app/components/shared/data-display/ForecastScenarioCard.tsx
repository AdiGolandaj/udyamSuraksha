import { Card, CardContent, CardHeader } from '~/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible'
import { Progress } from '~/components/ui/progress'
import { Badge } from '~/components/ui/badge'
import { ChevronDown } from 'lucide-react'
import { cn } from '~/lib/utils'
import { RiskBadge } from './RiskBadge'

export interface ForecastScenarioCardProps {
  scenarioId: string
  disasterType: string
  probability: 'low' | 'medium' | 'high'
  estimatedLoss: number
  affectedItemCount: number
  estimatedDowntimeDays: number
  recoveryTimelineDays: number
  topAffectedItems: Array<{
    name: string
    estimatedDamage: number
  }>
  aiNarrative: string
  isExpanded?: boolean
}

const probabilityConfig: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-green-50', text: 'text-green-700' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-700' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700' },
}

export function ForecastScenarioCard({
  disasterType,
  probability,
  estimatedLoss,
  affectedItemCount,
  estimatedDowntimeDays,
  recoveryTimelineDays,
  topAffectedItems,
  aiNarrative,
  isExpanded = false,
}: ForecastScenarioCardProps) {
  const [open, setOpen] = React.useState(isExpanded)
  const probConfig = probabilityConfig[probability]
  const riskLevel = probability === 'high' ? 'critical' : probability === 'medium' ? 'high' : 'moderate'

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <div className="p-4 md:p-5 cursor-pointer hover:bg-surface-secondary/50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-h3 font-semibold">{disasterType}</h3>
                  <Badge
                    variant="outline"
                    className={`${probConfig.bg} ${probConfig.text} border-0 text-capitalize`}
                  >
                    {probability.charAt(0).toUpperCase() + probability.slice(1)} Probability
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-caption text-text-secondary">Estimated Loss</p>
                    <p className="text-h3 font-bold text-status-critical">
                      ₹{estimatedLoss.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-caption text-text-secondary">Affected Items</p>
                    <p className="text-h3 font-bold text-text-primary">
                      {affectedItemCount}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 md:gap-6 mb-3">
                  <div>
                    <p className="text-caption text-text-secondary mb-1">Est. Downtime</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-h2 font-semibold">{estimatedDowntimeDays}</span>
                      <span className="text-body-sm text-text-secondary">days</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-caption text-text-secondary mb-1">Recovery Timeline</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-h2 font-semibold">{recoveryTimelineDays}</span>
                      <span className="text-body-sm text-text-secondary">days</span>
                    </div>
                  </div>
                </div>
              </div>

              <ChevronDown
                className={cn(
                  'size-5 text-text-secondary transition-transform shrink-0 mt-1',
                  open && 'rotate-180',
                )}
              />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 md:pb-5 border-t border-border-default space-y-4">
            <div>
              <p className="text-caption font-medium text-text-secondary mb-2">AI Analysis</p>
              <p className="text-body text-text-primary">{aiNarrative}</p>
            </div>

            {topAffectedItems.length > 0 && (
              <div>
                <p className="text-caption font-medium text-text-secondary mb-2">
                  Top Affected Items
                </p>
                <div className="space-y-2">
                  {topAffectedItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-surface-tertiary rounded-lg">
                      <span className="text-body-sm font-medium">{item.name}</span>
                      <span className="text-body-sm text-status-critical font-semibold">
                        ₹{item.estimatedDamage.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

import React from 'react'
