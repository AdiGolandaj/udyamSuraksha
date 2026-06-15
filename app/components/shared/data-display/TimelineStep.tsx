import { Checkbox } from '~/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible'
import { cn } from '~/lib/utils'
import { Check, ChevronDown } from 'lucide-react'

export interface TimelineStepProps {
  stepNumber: number
  title: string
  description: string
  isCompleted?: boolean
  isActive?: boolean
  isOptional?: boolean
  onToggle?: (completed: boolean) => void
  children?: React.ReactNode
}

export function TimelineStep({
  stepNumber,
  title,
  description,
  isCompleted = false,
  isActive = false,
  isOptional = false,
  onToggle,
  children,
}: TimelineStepProps) {
  const [expanded, setExpanded] = React.useState(isActive)

  const handleCheckChange = (checked: boolean) => {
    onToggle?.(checked)
  }

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="flex gap-4">
        {/* Timeline dot */}
        <div className="relative flex flex-col items-center">
          <div
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-full border-2 font-semibold text-sm',
              isCompleted
                ? 'bg-status-safe border-status-safe text-white'
                : isActive
                  ? 'border-brand-primary animate-pulse'
                  : 'border-border-default bg-surface-primary text-text-secondary',
            )}
          >
            {isCompleted ? (
              <Check className="size-4" />
            ) : (
              <span>{stepNumber}</span>
            )}
          </div>

          {/* Vertical line connector (not on last step) */}
          {children && (
            <div className="w-0.5 bg-border-default flex-1 mt-2 min-h-12" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 pb-4">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer hover:bg-surface-secondary p-2 rounded-lg transition-colors">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {onToggle && (
                    <Checkbox
                      checked={isCompleted}
                      onCheckedChange={handleCheckChange}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  <h4
                    className={cn(
                      'text-body font-semibold',
                      isCompleted && 'line-through text-text-tertiary',
                    )}
                  >
                    {title}
                  </h4>
                  {isOptional && (
                    <span className="text-caption text-text-tertiary">(Optional)</span>
                  )}
                </div>
              </div>
              {children && (
                <ChevronDown
                  className={cn(
                    'size-4 text-text-secondary transition-transform',
                    expanded && 'rotate-180',
                  )}
                />
              )}
            </div>
          </CollapsibleTrigger>

          {/* Expanded content */}
          {!onToggle && (
            <p className="text-body-sm text-text-secondary mt-2">{description}</p>
          )}

          {/* Collapsible nested content */}
          {children && (
            <CollapsibleContent className="mt-3 ml-6">
              {description && (
                <p className="text-body-sm text-text-secondary mb-3">{description}</p>
              )}
              <div className="space-y-2">{children}</div>
            </CollapsibleContent>
          )}
        </div>
      </div>
    </Collapsible>
  )
}

import React from 'react'
