import React from 'react'
import { cn } from '~/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '~/components/ui/avatar'
import { useTranslation } from '~/hooks/useTranslation'
import { AlertOctagon, MapPin, FileText } from 'lucide-react'

export interface ChatBubbleProps {
  messageId: string
  senderId?: string
  senderName?: string
  senderAvatar?: string
  content: string
  timestamp?: string
  isOwn?: boolean
  isSOSMessage?: boolean
  isSystemMessage?: boolean
  isAnnouncementMessage?: boolean
  isLocationMessage?: boolean
  attachments?: Array<{
    type: string
    asset_url?: string
    title?: string
    mime_type?: string
  }>
  reactionCounts?: Record<string, number>
  latestReactions?: Array<{
    type: string
    user: { name: string }
  }>
}

/**
 * ChatBubble
 * 
 * Renders individual chat messages with support for:
 * - SOS emergency messages (full-width red banner)
 * - System messages (centered, gray)
 * - Announcements (with pinned styling)
 * - Location pins (with mini map embed)
 * - Attachments (images, files)
 * - Message reactions
 * - Delivery status (own messages only)
 */
export function ChatBubble({
  messageId,
  senderId,
  senderName = 'Unknown',
  senderAvatar,
  content,
  timestamp,
  isOwn = false,
  isSOSMessage = false,
  isSystemMessage = false,
  isAnnouncementMessage = false,
  isLocationMessage = false,
  attachments = [],
  reactionCounts = {},
  latestReactions = [],
}: ChatBubbleProps) {
  const { t } = useTranslation()

  const formatTime = (dateString?: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // System message rendering
  if (isSystemMessage) {
    return (
      <div className="flex justify-center py-4 px-4">
        <div className="text-center">
          <p className="text-caption text-text-tertiary italic">{content}</p>
          <p className="text-xs text-text-tertiary mt-1">{formatTime(timestamp)}</p>
        </div>
      </div>
    )
  }

  // SOS message rendering - full width red banner
  if (isSOSMessage) {
    return (
      <div className="px-4 py-3 my-2 mx-2">
        <div className="bg-status-critical/20 border-l-4 border-status-critical rounded px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertOctagon className="size-5 text-status-critical mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-status-critical">
                {t('chat.sos-alert')}
              </p>
              <p className="text-sm text-text-primary mt-1">{content}</p>
              <p className="text-xs text-text-secondary mt-2">
                {t('chat.from')} {senderName} • {formatTime(timestamp)}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Regular message rendering
  return (
    <div
      className={cn('flex gap-3 px-4 py-2', isOwn ? 'justify-end' : 'justify-start')}
      key={messageId}
    >
      {/* Avatar (other users only) */}
      {!isOwn && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          {senderAvatar && <AvatarImage src={senderAvatar} alt={senderName} />}
          <AvatarFallback className="text-xs">
            {getInitials(senderName)}
          </AvatarFallback>
        </Avatar>
      )}

      {/* Message bubble */}
      <div
        className={cn(
          'flex flex-col gap-1 max-w-xs lg:max-w-md',
          isOwn && 'items-end'
        )}
      >
        {/* Sender name (other users only) */}
        {!isOwn && (
          <p className="text-xs font-medium text-text-secondary px-3">
            {senderName}
          </p>
        )}

        {/* Message content bubble */}
        <div
          className={cn(
            'rounded-lg px-4 py-2 break-words',
            isOwn
              ? 'bg-brand-primary text-white rounded-br-none'
              : 'bg-surface-secondary text-text-primary rounded-bl-none',
            isAnnouncementMessage && 'border-2 border-status-moderate'
          )}
        >
          {/* Announcement badge */}
          {isAnnouncementMessage && (
            <p className="text-xs font-semibold text-status-moderate mb-1">
              📌 {t('chat.official-announcement')}
            </p>
          )}

          {/* Message text */}
          <p className="text-sm">{content}</p>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {attachments.map((att, idx) => {
                if (att.type === 'image') {
                  return (
                    <img
                      key={idx}
                      src={att.asset_url}
                      alt="attachment"
                      className="max-w-xs rounded-md"
                    />
                  )
                }
                if (att.type === 'file') {
                  return (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded',
                        isOwn ? 'bg-white/20' : 'bg-surface-primary'
                      )}
                    >
                      <FileText className="size-4 flex-shrink-0" />
                      <p className="text-sm truncate">{att.title}</p>
                    </div>
                  )
                }
                return null
              })}
            </div>
          )}

          {/* Location embed */}
          {isLocationMessage && (
            <div className="mt-2 flex items-center gap-1 text-xs opacity-80">
              <MapPin className="size-3" />
              <span>{t('chat.location-shared')}</span>
            </div>
          )}
        </div>

        {/* Time & reactions */}
        <div className="flex items-center gap-2 px-2 text-xs text-text-tertiary">
          <span>{formatTime(timestamp)}</span>
          {Object.keys(reactionCounts).length > 0 && (
            <div className="flex items-center gap-1 text-xs">
              {Object.entries(reactionCounts).map(([emoji, count]) => (
                <span
                  key={emoji}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-surface-secondary"
                >
                  {emoji} <span className="text-text-secondary">{count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

ChatBubble.displayName = 'ChatBubble'
