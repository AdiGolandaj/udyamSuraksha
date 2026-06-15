import { Card, CardContent, CardHeader } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Calendar, MapPin, BarChart3 } from 'lucide-react'
import { RiskBadge } from './RiskBadge'
import type { RiskLevel } from '~/lib/constants'

export interface ReportSummaryCardProps {
  reportId: string
  reportTitle: string
  disasterType: string
  affectedZone: string
  reportDate: string
  totalShopsAffected: number
  estimatedTotalLoss: number
  severity: RiskLevel
  status: 'draft' | 'published' | 'archived'
  href: string
}

const statusConfig: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-50', text: 'text-gray-700' },
  published: { bg: 'bg-green-50', text: 'text-green-700' },
  archived: { bg: 'bg-gray-100', text: 'text-gray-600' },
}

export function ReportSummaryCard({
  reportTitle,
  disasterType,
  affectedZone,
  reportDate,
  totalShopsAffected,
  estimatedTotalLoss,
  severity,
  status,
  href,
}: ReportSummaryCardProps) {
  const date = new Date(reportDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const config = statusConfig[status]

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-h3 font-semibold text-text-primary truncate">
              {reportTitle}
            </h3>
            <p className="text-body-sm text-text-secondary mt-1">{disasterType}</p>
          </div>
          <RiskBadge level={severity} size="sm" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex items-start gap-2">
            <MapPin className="size-4 text-text-secondary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-caption text-text-tertiary">Affected Zone</p>
              <p className="text-body-sm font-medium text-text-primary truncate">
                {affectedZone}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Calendar className="size-4 text-text-secondary mt-0.5 shrink-0" />
            <div>
              <p className="text-caption text-text-tertiary">Report Date</p>
              <p className="text-body-sm font-medium text-text-primary">{date}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-tertiary rounded-lg p-3">
            <p className="text-caption text-text-tertiary">Shops Affected</p>
            <p className="text-h2 font-bold text-text-primary">{totalShopsAffected}</p>
          </div>
          <div className="bg-surface-tertiary rounded-lg p-3">
            <p className="text-caption text-text-tertiary">Est. Total Loss</p>
            <p className="text-h3 font-bold text-status-critical">
              ₹{estimatedTotalLoss.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Badge
            variant="outline"
            className={`${config.bg} ${config.text} border-0 text-capitalize font-medium`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
          <Button variant="outline" size="sm" asChild>
            <a href={href}>View Report</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
