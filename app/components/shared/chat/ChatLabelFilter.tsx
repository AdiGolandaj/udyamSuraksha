import React from 'react'
import { Button } from '~/components/ui/button'
import { useTranslation } from '~/hooks/useTranslation'
import { X } from 'lucide-react'
import { cn } from '~/lib/utils'

export interface Label {
  id: string
  name: string
}

export interface ChatLabelFilterProps {
  labels: Label[]
  selectedLabels: string[]
  onLabelsChange: (labelIds: string[]) => void
}

/**
 * ChatLabelFilter
 * 
 * Filter component for LRDB officers to filter groups by labels.
 * Displays as a scrollable pill list below the search bar.
 */
export function ChatLabelFilter({
  labels,
  selectedLabels,
  onLabelsChange,
}: ChatLabelFilterProps) {
  const { t } = useTranslation()

  const toggleLabel = (labelId: string) => {
    const next = selectedLabels.includes(labelId)
      ? selectedLabels.filter((id) => id !== labelId)
      : [...selectedLabels, labelId]
    onLabelsChange(next)
  }

  if (labels.length === 0) {
    return null
  }

  return (
    <div className="border-b border-border-default px-4 py-3 space-y-2">
      <p className="text-caption font-medium text-text-secondary">
        {t('chat.filter-by-label')}
      </p>
      <div className="flex flex-wrap gap-2">
        {labels.map((label) => {
          const isSelected = selectedLabels.includes(label.id)
          return (
            <button
              key={label.id}
              onClick={() => toggleLabel(label.id)}
              className={cn(
                'inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors border',
                isSelected
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'bg-surface-primary text-text-secondary border-border-default hover:border-brand-primary'
              )}
            >
              <span>{label.name}</span>
              {isSelected && (
                <X className="size-3 cursor-pointer hover:opacity-70" />
              )}
            </button>
          )
        })}
      </div>

      {/* Clear all button */}
      {selectedLabels.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onLabelsChange([])}
          className="text-xs h-6"
        >
          {t('common.clear-all')}
        </Button>
      )}
    </div>
  )
}

ChatLabelFilter.displayName = 'ChatLabelFilter'
