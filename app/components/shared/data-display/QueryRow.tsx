import { TableRow, TableCell } from '~/components/ui/table'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent } from '~/components/ui/card'
import type { PriorityLevel, QueryStatus } from '~/lib/constants'

export interface QueryRowProps {
  queryId: string
  shopName: string
  shopId: string
  queryType: string
  priority: PriorityLevel
  status: QueryStatus
  submittedAt: string
  href: string
}

const priorityConfig: Record<PriorityLevel, { bg: string; text: string }> = {
  low: { bg: 'bg-green-50', text: 'text-green-700' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-700' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700' },
  critical: { bg: 'bg-red-50', text: 'text-red-700' },
}

const statusConfig: Record<QueryStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-gray-50', text: 'text-gray-700' },
  'under-review': { bg: 'bg-blue-50', text: 'text-blue-700' },
  assigned: { bg: 'bg-purple-50', text: 'text-purple-700' },
  resolved: { bg: 'bg-green-50', text: 'text-green-700' },
  escalated: { bg: 'bg-red-50', text: 'text-red-700' },
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

function formatPriorityLabel(priority: PriorityLevel): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1)
}

function formatStatusLabel(status: QueryStatus): string {
  return status.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export function QueryRow({
  shopName,
  queryType,
  priority,
  status,
  submittedAt,
  href,
}: QueryRowProps) {
  const timeAgo = getRelativeTime(submittedAt)
  const priorityConfig_ = priorityConfig[priority]
  const statusConfig_ = statusConfig[status]

  return (
    <>
      {/* Desktop Table Row */}
      <TableRow className="hidden md:table-row cursor-pointer hover:bg-surface-secondary">
        <TableCell className="text-body-sm">{shopName}</TableCell>
        <TableCell className="text-body-sm">{queryType}</TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={`${priorityConfig_.bg} ${priorityConfig_.text} border-0`}
          >
            {formatPriorityLabel(priority)}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={`${statusConfig_.bg} ${statusConfig_.text} border-0`}
          >
            {formatStatusLabel(status)}
          </Badge>
        </TableCell>
        <TableCell className="text-body-sm text-text-tertiary">{timeAgo}</TableCell>
      </TableRow>

      {/* Mobile Card */}
      <div className="md:hidden">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div>
                <p className="text-caption text-text-secondary">Shop</p>
                <p className="text-body font-medium">{shopName}</p>
              </div>
              <div>
                <p className="text-caption text-text-secondary">Query Type</p>
                <p className="text-body font-medium">{queryType}</p>
              </div>
              <div className="flex gap-2">
                <Badge
                  variant="outline"
                  className={`${priorityConfig_.bg} ${priorityConfig_.text} border-0`}
                >
                  {formatPriorityLabel(priority)}
                </Badge>
                <Badge
                  variant="outline"
                  className={`${statusConfig_.bg} ${statusConfig_.text} border-0`}
                >
                  {formatStatusLabel(status)}
                </Badge>
              </div>
              <p className="text-caption text-text-tertiary">{timeAgo}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
