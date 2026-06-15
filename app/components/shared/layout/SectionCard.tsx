import { ReactNode, ComponentType } from 'react'
import { ChevronDown } from 'lucide-react'

import { Card } from '~/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import { cn } from '~/lib/utils'

export interface SectionCardProps {
  title?: string
  subtitle?: string
  icon?: ComponentType<{ className?: string }>
  headerAction?: ReactNode
  /** Alias for headerAction */
  action?: ReactNode
  children: ReactNode
  className?: string
  noPadding?: boolean
  collapsible?: boolean
  defaultOpen?: boolean
  /** Accepts MUI sx prop (unused, for API compatibility) */
  sx?: object
}

export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  headerAction,
  action,
  children,
  className,
  noPadding = false,
  collapsible = false,
  defaultOpen = true,
}: SectionCardProps) {
  const resolvedHeaderAction = headerAction ?? action
  const cardContent = (
    <>
      {/* Header */}
      {(title || resolvedHeaderAction) && (
        <div className="flex items-start justify-between gap-4 border-b border-border-default px-6 py-4">
          <div className="flex items-start gap-3 flex-1">
            {Icon && <Icon className="h-5 w-5 text-brand-primary mt-0.5 flex-shrink-0" />}
            <div>
              {title && <h3 className="text-h3 font-semibold text-text-primary">{title}</h3>}
              {subtitle && <p className="mt-1 text-body-sm text-text-secondary">{subtitle}</p>}
            </div>
          </div>
          {resolvedHeaderAction && <div className="flex-shrink-0">{resolvedHeaderAction}</div>}
        </div>
      )}

      {/* Content */}
      <div className={cn(
        !noPadding && 'px-6 py-4',
        'space-y-4'
      )}>
        {children}
      </div>
    </>
  )

  if (collapsible) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <Collapsible defaultOpen={defaultOpen}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between gap-4 border-b border-border-default px-6 py-4 hover:bg-surface-tertiary transition-colors">
              <div className="flex items-start gap-3 flex-1 text-left">
                {Icon && <Icon className="h-5 w-5 text-brand-primary mt-0.5 flex-shrink-0" />}
                <div>
                  {title && <h3 className="text-h3 font-semibold text-text-primary">{title}</h3>}
                  {subtitle && <p className="mt-1 text-body-sm text-text-secondary">{subtitle}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {resolvedHeaderAction && <div>{resolvedHeaderAction}</div>}
                <ChevronDown className="h-5 w-5 text-text-secondary transition-transform data-[state=open]:rotate-180" />
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className={cn(
              !noPadding && 'px-6 py-4',
              'space-y-4'
            )}>
              {children}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    )
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      {cardContent}
    </Card>
  )
}
