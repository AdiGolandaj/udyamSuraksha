import React, { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Textarea } from '~/components/ui/textarea'
import { useTranslation } from '~/hooks/useTranslation'
import { Send, AlertOctagon, Loader2 } from 'lucide-react'
import { cn } from '~/lib/utils'
import { SOSButton } from './SOSButton'

export interface ChatInputProps {
  channelId: string
  userId: string
  showSOSButton?: boolean
  onSendMessage: (content: string) => Promise<void>
  onSOS?: () => Promise<void>
  disabled?: boolean
  placeholder?: string
}

/**
 * ChatInput
 * 
 * Message input component with:
 * - Auto-expanding textarea
 * - Send button
 * - SOS button (MSME only)
 * - Loading state
 * - Keyboard shortcuts (Enter to send, Shift+Enter for newline)
 */
export function ChatInput({
  channelId,
  userId,
  showSOSButton = false,
  onSendMessage,
  onSOS,
  disabled = false,
  placeholder,
}: ChatInputProps) {
  const [content, setContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const { t } = useTranslation()

  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // Auto-expand textarea based on content
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)

    // Reset height to auto to get the correct scrollHeight
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120)
      textareaRef.current.style.height = `${newHeight}px`
    }
  }

  // Handle sending message
  const handleSend = async () => {
    if (!content.trim() || isSending) return

    setIsSending(true)
    try {
      await onSendMessage(content.trim())
      setContent('')
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsSending(false)
    }
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (unless Shift is held)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-border-default bg-surface-primary p-4 space-y-3">
      {/* Input area */}
      <div className="flex items-end gap-3">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t('chat.message-placeholder')}
          disabled={isSending || disabled}
          className="resize-none min-h-[44px] max-h-[120px] rounded-lg"
          rows={1}
        />

        {/* Send button */}
        <Button
          onClick={handleSend}
          disabled={!content.trim() || isSending || disabled}
          size="icon"
          className="flex-shrink-0 h-10 w-10"
        >
          {isSending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Send className="size-5" />
          )}
        </Button>
      </div>

      {/* SOS Button for MSME */}
      {showSOSButton && (
        <div className="flex justify-end">
          <SOSButton onSOS={onSOS} />
        </div>
      )}
    </div>
  )
}

ChatInput.displayName = 'ChatInput'
