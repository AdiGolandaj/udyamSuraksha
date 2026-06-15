import React from 'react'
import { cn } from '~/lib/utils'
import { AlertCircle, Trash2 } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { useTranslation } from '~/hooks/useTranslation'

export interface ChatGroupListItemProps {
  group: {
    id: string
    name: string
    streamChannelId: string
    groupType: 'LOCAL_MSME' | 'LRDB_COORDINATION' | 'DIRECT_MESSAGE' | 'SOS_EMERGENCY'
    unreadCount?: number
    isSOSActive?: boolean
    memberCount?: number
  }
  isActive?: boolean
  onClick: () => void
  onDelete?: () => void
  role: 'msme' | 'lrdb'
}

/**
 * ChatGroupListItem
 * 
 * Renders a single chat group in the sidebar list.
 * Shows unread badge, SOS indicator, and delete button (LRDB only).
 */
export function ChatGroupListItem({
  group,
  isActive = false,
  onClick,
  onDelete,
  role,
}: ChatGroupListItemProps) {
  const { t } = useTranslation()
  const [showDelete, setShowDelete] = React.useState(false)

  const getGroupIcon = () => {
    switch (group.groupType) {
      case 'SOS_EMERGENCY':
        return '🚨'
      case 'LRDB_COORDINATION':
        return '👥'
      case 'DIRECT_MESSAGE':
        return '💬'
      case 'LOCAL_MSME':
      default:
        return '🏪'
    }
  }

  const getGroupTypeLabel = () => {
    switch (group.groupType) {
      case 'SOS_EMERGENCY':
        return t('chat.sos-emergency')
      case 'LRDB_COORDINATION':
        return t('chat.lrdb-group')
      case 'DIRECT_MESSAGE':
        return t('chat.direct-message')
      case 'LOCAL_MSME':
        return t('chat.local-msme')
      default:
        return ''
    }
  }

  return (
    <div
      className={cn(
        'group flex items-center justify-between gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors relative',
        isActive
          ? 'bg-brand-primary bg-opacity-10 border border-brand-primary'
          : 'hover:bg-surface-primary border border-transparent'
      )}
      onClick={onClick}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <span className="text-lg shrink-0">{getGroupIcon()}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className={cn(
                  'text-sm font-medium truncate',
                  isActive ? 'text-brand-primary' : 'text-text-primary'
                )}
              >
                {group.name}
              </h3>
              {group.isSOSActive && (
                <AlertCircle className="size-3 text-status-critical shrink-0 animate-pulse" />
              )}
            </div>
            <p className="text-xs text-text-tertiary truncate">
              {getGroupTypeLabel()}
              {group.memberCount && ` • ${group.memberCount} ${t('common.members')}`}
            </p>
          </div>
        </div>
      </div>

      {/* Unread Badge */}
      {(group.unreadCount ?? 0) > 0 && (
        <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-status-critical text-white text-xs font-bold">
          {(group.unreadCount ?? 0) > 99 ? '99+' : group.unreadCount}
        </div>
      )}

      {/* Delete Button (LRDB only, shown on hover) */}
      {role === 'lrdb' && onDelete && showDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-status-critical hover:bg-status-critical/10"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          title={t('common.delete')}
        >
          <Trash2 className="size-3" />
        </Button>
      )}
    </div>
  )
}

ChatGroupListItem.displayName = 'ChatGroupListItem'
