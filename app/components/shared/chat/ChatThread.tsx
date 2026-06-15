import React, { useEffect } from 'react'
import {
  useChannelStateContext,
  useChannelActionContext,
  MessageList,
  Window,
} from 'stream-chat-react'
import { Button } from '~/components/ui/button'
import { ScrollArea } from '~/components/ui/scroll-area'
import { useTranslation } from '~/hooks/useTranslation'
import { Phone, Video, Info } from 'lucide-react'
import { ChatBubble } from './ChatBubble'
import { ChatInput } from './ChatInput'
import { CallBar } from './CallBar'

export interface ChatThreadProps {
  groupId: string
  groupName?: string
  role: 'msme' | 'lrdb'
  userId: string
  groupType?: string
  onVoiceCall?: () => void
  onVideoCall?: () => void
  onSendSOS?: () => Promise<void>
}

/**
 * ChatThread
 * 
 * Main chat thread component displaying messages and input area.
 * Uses Stream SDK hooks to access channel state and render messages.
 * Includes header with group info and call buttons.
 */
export function ChatThread({
  groupId,
  groupName = 'Chat',
  role,
  userId,
  groupType,
  onVoiceCall,
  onVideoCall,
  onSendSOS,
}: ChatThreadProps) {
  const { t } = useTranslation()
  const { channel, messages, members } = useChannelStateContext()
  const { sendMessage, loadMore } = useChannelActionContext()

  // Handle infinite scroll - load more messages when scrolled to top
  const handleLoadMore = React.useCallback(async () => {
    if (loadMore) {
      await loadMore(20)
    }
  }, [loadMore])

  return (
    <Window>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-default bg-surface-primary">
        <div className="flex-1">
          <h2 className="text-h2 font-semibold text-text-primary">
            {groupName}
          </h2>
          <p className="text-caption text-text-secondary">
            {Object.keys(members ?? {}).length} {t('common.members')}
          </p>
        </div>

        {/* Call buttons */}
        <div className="flex items-center gap-2">
          {onVoiceCall && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onVoiceCall}
              title={t('chat.voice-call')}
            >
              <Phone className="size-5 text-brand-primary" />
            </Button>
          )}
          {onVideoCall && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onVideoCall}
              title={t('chat.video-call')}
            >
              <Video className="size-5 text-brand-primary" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1">
          <MessageList
            Message={CustomChatBubble}
            disableDateSeparator={false}
            messageActions={
              role === 'lrdb'
                ? ['pin', 'flag', 'delete', 'react']
                : ['react', 'flag']
            }
          />

          {/* Load more button at bottom */}
          {messages && messages.length > 20 && (
            <div className="flex justify-center p-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
              >
                {t('chat.load-older')}
              </Button>
            </div>
          )}
        </ScrollArea>

      </div>

      {/* Input area */}
      <ChatInput
        channelId={groupId}
        userId={userId}
        showSOSButton={role === 'msme'}
        onSendMessage={async (content) => {
          try {
            await sendMessage({ text: content })
          } catch (error) {
            console.error('Failed to send message:', error)
          }
        }}
        onSOS={onSendSOS}
      />
    </Window>
  )
}

/**
 * CustomChatBubble
 * 
 * Wrapper around ChatBubble to extract Stream message context
 * and pass to our custom rendering component.
 */
function CustomChatBubble({ message, ...props }: any) {
  const isSOS = message.custom?.isSOS
  const isAnnouncement = message.custom?.isAnnouncement
  const isSystem = message.type === 'system'
  const isLocation = message.custom?.isLocation

  return (
    <ChatBubble
      messageId={message.id}
      senderId={message.user?.id}
      senderName={message.user?.name}
      senderAvatar={message.user?.image}
      content={message.text}
      timestamp={message.created_at}
      isOwn={props.isOwn}
      isSOSMessage={isSOS}
      isSystemMessage={isSystem}
      isAnnouncementMessage={isAnnouncement}
      isLocationMessage={isLocation}
      attachments={message.attachments}
      reactionCounts={message.reaction_counts}
      latestReactions={message.latest_reactions}
      {...props}
    />
  )
}

ChatThread.displayName = 'ChatThread'
