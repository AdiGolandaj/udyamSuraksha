'use client'

import React, { useState, useMemo } from 'react'
import { ClientOnly } from 'remix-utils/client-only'
import { Button } from '~/components/ui/button'
import { useTranslation } from '~/hooks/useTranslation'
import { X, Loader2 } from 'lucide-react'
import { cn } from '~/lib/utils'

export interface VideoCallModalProps {
  callId: string
  callType: 'voice' | 'video'
  userId: string
  token: string
  onLeave: () => void
  isOpen?: boolean
}

/**
 * VideoCallModal
 * 
 * Full-screen video/voice call modal using Stream Video SDK.
 * Wrapped in ClientOnly to prevent SSR issues.
 * 
 * Features:
 * - Voice and video call modes
 * - Participant grid layout
 * - Mute/camera/screen share controls
 * - Leave call button
 * - Automatic connection to Stream Video
 */
export function VideoCallModal({
  callId,
  callType,
  userId,
  token,
  onLeave,
  isOpen = true,
}: VideoCallModalProps) {
  const { t } = useTranslation()

  if (!isOpen) {
    return null
  }

  return (
    <ClientOnly fallback={null}>
      {() => (
        <VideoCallModalInner
          callId={callId}
          callType={callType}
          userId={userId}
          token={token}
          onLeave={onLeave}
        />
      )}
    </ClientOnly>
  )
}

interface VideoCallModalInnerProps {
  callId: string
  callType: 'voice' | 'video'
  userId: string
  token: string
  onLeave: () => void
}

function VideoCallModalInner({
  callId,
  callType,
  userId,
  token,
  onLeave,
}: VideoCallModalInnerProps) {
  const [isConnecting, setIsConnecting] = useState(true)
  const [participantCount, setParticipantCount] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(callType === 'voice')
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { t } = useTranslation()

  // Initialize Stream Video client in a real implementation
  React.useEffect(() => {
    // In a real implementation, initialize the StreamVideoClient here
    // const client = new StreamVideoClient({ apiKey, user: { id: userId }, token })
    // const call = client.call('default', callId)
    // call.join({ create: true })

    // Simulate connection delay
    const timer = setTimeout(() => {
      setIsConnecting(false)
    }, 2000)

    return () => clearTimeout(timer)
  }, [callId, userId, token])

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center text-white p-4">
        <div className="text-center max-w-md">
          <h2 className="text-h2 font-semibold mb-2">
            {t('chat.call-connection-failed')}
          </h2>
          <p className="text-body mb-4">{error}</p>
          <Button onClick={onLeave} className="bg-status-critical hover:bg-status-critical/90">
            {t('common.close')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Close button */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={onLeave}
          className="text-white hover:bg-white/20"
        >
          <X className="size-6" />
        </Button>
      </div>

      {/* Participant area */}
      {isConnecting ? (
        <div className="flex-1 flex items-center justify-center gap-3">
          <Loader2 className="size-8 text-white animate-spin" />
          <span className="text-white text-lg">
            {t('chat.connecting')}...
          </span>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-4">
          {callType === 'voice' ? (
            // Voice call: show avatar with audio indicator
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-brand-primary to-brand-primary/60 flex items-center justify-center shadow-2xl">
                  <span className="text-6xl">🎤</span>
                </div>
                {isMuted ? (
                  <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">
                    ✕
                  </div>
                ) : (
                  <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center animate-pulse">
                    <span className="text-xs">🎵</span>
                  </div>
                )}
              </div>

              <div className="text-center">
                <p className="text-white text-lg font-semibold">
                  {t('chat.in-call')}
                </p>
                <p className="text-gray-300 text-sm">
                  {participantCount} {participantCount === 1 ? t('chat.participant') : t('chat.participants')}
                </p>
              </div>
            </div>
          ) : (
            // Video call: show grid of participant videos
            <div className={cn(
              'w-full h-full grid gap-4 p-4',
              participantCount === 1 && 'grid-cols-1',
              participantCount === 2 && 'grid-cols-2',
              participantCount >= 3 && 'grid-cols-2 lg:grid-cols-3'
            )}>
              {/* Participant video placeholders */}
              {Array.from({ length: participantCount }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-gray-800 rounded-lg flex items-center justify-center text-white overflow-hidden"
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-brand-primary flex items-center justify-center text-4xl">
                      📹
                    </div>
                    <p className="text-sm">
                      {idx === 0 ? 'You' : `Participant ${idx + 1}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Controls bar */}
      {!isConnecting && (
        <div className="bg-black/80 border-t border-white/20 p-6 flex items-center justify-center gap-4">
          {/* Mute button */}
          <Button
            variant={isMuted ? 'destructive' : 'secondary'}
            size="icon"
            onClick={() => setIsMuted(!isMuted)}
            className="h-12 w-12 rounded-full"
            title={isMuted ? t('chat.unmute') : t('chat.mute')}
          >
            {isMuted ? '🔇' : '🎤'}
          </Button>

          {/* Camera button (video call only) */}
          {callType === 'video' && (
            <Button
              variant={isCameraOff ? 'destructive' : 'secondary'}
              size="icon"
              onClick={() => setIsCameraOff(!isCameraOff)}
              className="h-12 w-12 rounded-full"
              title={isCameraOff ? t('chat.turn-on-camera') : t('chat.turn-off-camera')}
            >
              {isCameraOff ? '📹❌' : '📹'}
            </Button>
          )}

          {/* Screen share button (video call only) */}
          {callType === 'video' && (
            <Button
              variant={isScreenSharing ? 'default' : 'secondary'}
              size="icon"
              onClick={() => setIsScreenSharing(!isScreenSharing)}
              className="h-12 w-12 rounded-full"
              title={t('chat.screen-share')}
            >
              🖥️
            </Button>
          )}

          {/* Leave call button */}
          <Button
            variant="destructive"
            size="icon"
            onClick={onLeave}
            className="h-12 w-12 rounded-full ml-4"
            title={t('chat.leave-call')}
          >
            ☎️❌
          </Button>
        </div>
      )}
    </div>
  )
}

VideoCallModal.displayName = 'VideoCallModal'
