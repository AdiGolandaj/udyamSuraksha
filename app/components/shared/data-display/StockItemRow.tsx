import { TableRow, TableCell } from '~/components/ui/table'
import { Card, CardContent } from '~/components/ui/card'
import { Progress } from '~/components/ui/progress'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/dropdown-menu'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { MoreVertical } from 'lucide-react'
import { SensitivityTag } from './SensitivityTag'
import type { SensitivityType } from '~/lib/constants'
import { cn } from '~/lib/utils'

export interface StockItemRowProps {
  itemId: string
  name: string
  category: string
  quantity: number
  unit: string
  estimatedValue: number
  sensitivities: SensitivityType[]
  vulnerabilityScore: number
  expiryDate?: string
  storageLocation?: string
  onEdit?: () => void
  onDelete?: () => void
  href: string
}

function getVulnerabilityColor(score: number): string {
  if (score < 40) return 'bg-status-safe'
  if (score < 70) return 'bg-status-moderate'
  return 'bg-status-critical'
}

function isExpiringSoon(expiryDate?: string): boolean {
  if (!expiryDate) return false
  const expiry = new Date(expiryDate)
  const now = new Date()
  const daysUntil = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return daysUntil <= 7
}

export function StockItemRow({
  name,
  category,
  quantity,
  unit,
  estimatedValue,
  sensitivities,
  vulnerabilityScore,
  expiryDate,
  storageLocation,
  onEdit,
  onDelete,
}: StockItemRowProps) {
  const expiringSoon = isExpiringSoon(expiryDate)
  const visibleSensitivities = sensitivities.slice(0, 3)
  const hiddenSensitivities = sensitivities.slice(3)

  return (
    <>
      {/* Desktop Table Row */}
      <TableRow
        className={cn(
          'hover:bg-surface-secondary transition-colors',
          expiringSoon && 'bg-status-critical-bg',
        )}
      >
        <TableCell className="text-body-sm font-medium">{name}</TableCell>
        <TableCell className="text-body-sm text-text-secondary">{category}</TableCell>
        <TableCell className="text-body-sm">
          {quantity} {unit}
        </TableCell>
        <TableCell className="text-body-sm">₹{estimatedValue.toLocaleString()}</TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {visibleSensitivities.map((sens) => (
              <SensitivityTag key={sens} type={sens} size="sm" showIcon />
            ))}
            {hiddenSensitivities.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="bg-surface-tertiary text-text-secondary">
                    +{hiddenSensitivities.length}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {hiddenSensitivities.map((s) => (
                    <div key={s}>{s}</div>
                  ))}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TableCell>
        <TableCell className="hidden md:table-cell">
          <div className="flex items-center gap-2">
            <Progress value={vulnerabilityScore} className="w-16 h-2" />
            <span className="text-body-sm text-text-secondary">{vulnerabilityScore}%</span>
          </div>
        </TableCell>
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>}
              {onDelete && (
                <DropdownMenuItem onClick={onDelete} className="text-status-critical">
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {/* Mobile Card */}
      <div className="md:hidden">
        <Card className={cn(expiringSoon && 'border-l-4 border-l-status-critical')}>
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-h3 font-semibold">{name}</p>
                  <p className="text-body-sm text-text-secondary">{category}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onEdit && <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>}
                    {onDelete && (
                      <DropdownMenuItem onClick={onDelete} className="text-status-critical">
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="grid grid-cols-2 gap-2 text-body-sm">
                <div>
                  <p className="text-text-tertiary">Quantity</p>
                  <p className="font-medium">{quantity} {unit}</p>
                </div>
                <div>
                  <p className="text-text-tertiary">Value</p>
                  <p className="font-medium">₹{estimatedValue.toLocaleString()}</p>
                </div>
              </div>

              {sensitivities.length > 0 && (
                <div>
                  <p className="text-caption text-text-tertiary mb-2">Sensitivities</p>
                  <div className="flex flex-wrap gap-1">
                    {sensitivities.map((sens) => (
                      <SensitivityTag key={sens} type={sens} size="sm" showIcon />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-caption text-text-tertiary mb-1">Vulnerability</p>
                <div className="flex items-center gap-2">
                  <Progress value={vulnerabilityScore} className="flex-1 h-2" />
                  <span className="text-caption font-medium">{vulnerabilityScore}%</span>
                </div>
              </div>

              {expiryDate && (
                <p className={cn('text-caption font-medium', expiringSoon && 'text-status-critical')}>
                  {expiringSoon ? '⚠️ Expires soon' : `Expires: ${new Date(expiryDate).toLocaleDateString()}`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
