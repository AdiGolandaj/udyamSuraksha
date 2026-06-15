import React from 'react'
import { Button } from '~/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '~/components/ui/avatar'
import { useTranslation } from '~/hooks/useTranslation'
import { Phone, PhoneOff } from 'lucide-react'
import { cn } from '~/lib/utils'

export interface CallBarProps {
  callerId: string
  callerName: string
  callerAvatar?: string
  callType: 'voice' | 'video'
  onJoin: () => void
  onDecline: () => void
  onTimeout?: () => void
  timeoutSeconds?: number
}

/**
 * CallBar
 * 
 * Incoming call notification banner displayed at the top of ChatThread.
 * Shows caller info and Join/Decline buttons.
 * Auto-declines after timeout (30 seconds default).
 */
export function CallBar({
  callerId,
  callerName,
  callerAvatar,
  callType,
  onJoin,
  onDecline,
  onTimeout,
  timeoutSeconds = 30,
}: CallBarProps) {
  const [timeRemaining, setTimeRemaining] = React.useState(timeoutSeconds)
  const { t } = useTranslation()

  // Auto-decline on timeout
  React.useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          onTimeout?.()
          onDecline()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [onDecline, onTimeout])

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="bg-gradient-to-r from-brand-primary to-brand-primary/80 text-white p-4 shadow-lg animate-pulse">
      <div className="flex items-center justify-between gap-4 max-w-6xl mx-auto">
        {/* Caller info */}
        <div className="flex items-center gap-3 flex-1">
          <Avatar className="h-10 w-10">
            {callerAvatar && <AvatarImage src={callerAvatar} alt={callerName} />}
            <AvatarFallback>{getInitials(callerName)}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <p className="text-sm font-semibold">{callerName}</p>
            <p className="text-xs opacity-90">
              {callType === 'video'
                ? t('chat.incoming-video-call')
                : t('chat.incoming-voice-call')}
              {timeRemaining && ` (${timeRemaining}s)`}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onDecline}
            className="bg-white/20 border-white/30 text-white hover:bg-white/30"
          >
            <PhoneOff className="size-4 mr-1" />
            {t('chat.decline')}
          </Button>
          <Button
            size="sm"
            onClick={onJoin}
            className="bg-white text-brand-primary hover:bg-white/90 font-semibold"
          >
            <Phone className="size-4 mr-1" />
            {t('chat.join')}
          </Button>
        </div>
      </div>
    </div>
  )
}

CallBar.displayName = 'CallBar'
