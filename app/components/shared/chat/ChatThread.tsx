import React from 'react'
import {
  useChannelStateContext,
  useChannelActionContext,
  MessageList,
  Window,
} from 'stream-chat-react'
import { Button } from '~/components/ui/button'
import { useTranslation } from '~/hooks/useTranslation'
import { Phone, Video } from 'lucide-react'
import { ChatBubble } from './ChatBubble'
import { ChatInput } from './ChatInput'

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
  const { channel } = useChannelStateContext()
  const { sendMessage } = useChannelActionContext()

  // channel.data.member_count is populated by ch.watch() and is reliable
  const memberCount = (channel?.data as any)?.member_count ?? 0

  return (
    <Window>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-default bg-surface-primary">
        <div className="flex-1">
          <h2 className="text-h2 font-semibold text-text-primary">
            {groupName}
          </h2>
          <p className="text-caption text-text-secondary">
            {memberCount} {t('common.members')}
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

      {/*
        MessageList from stream-chat-react manages its own scroll container
        internally (via InfiniteScroll). Do NOT wrap it in ScrollArea or any
        other overflow container — doing so collapses the list to 0 height.
        Window provides the correct flex-column layout.
      */}
      <MessageList
        Message={CustomChatBubble}
        disableDateSeparator={false}
        messageActions={
          role === 'lrdb'
            ? ['pin', 'flag', 'delete', 'react']
            : ['react', 'flag']
        }
      />

      {/* Input area */}
      <ChatInput
        channelId={groupId}
        userId={userId}
        showSOSButton={role === 'msme'}
        onSendMessage={async (content) => {
          console.log('[ChatThread] onSendMessage invoked', { groupId, userId, contentLength: content.length })
          try {
            console.log('[ChatThread] Calling Stream sendMessage...', { channelName: channel?.data?.name })
            await sendMessage({ text: content })
            console.log('[ChatThread] Stream sendMessage succeeded')
          } catch (error) {
            console.error('[ChatThread] Stream sendMessage failed:', error)
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
  if (!message) return null

  const isSOS = message.custom?.isSOS ?? false
  const isAnnouncement = message.custom?.isAnnouncement ?? false
  const isSystem = message.type === 'system'
  const isLocation = message.custom?.isLocation ?? false

  return (
    <ChatBubble
      messageId={message.id ?? ''}
      senderId={message.user?.id}
      senderName={message.user?.name}
      senderAvatar={message.user?.image}
      content={message.text ?? ''}
      timestamp={message.created_at ?? new Date().toISOString()}
      isOwn={props.isOwn ?? false}
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
