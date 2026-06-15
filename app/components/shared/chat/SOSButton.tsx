import React, { useState, useEffect } from 'react'
import { Button } from '~/components/ui/button'
import { useTranslation } from '~/hooks/useTranslation'
import { AlertOctagon } from 'lucide-react'
import { cn } from '~/lib/utils'

export interface SOSButtonProps {
  variant?: 'full' | 'icon'
  size?: 'sm' | 'md' | 'lg'
  onSOS?: () => Promise<void>
  disabled?: boolean
  cooldownSeconds?: number
}

/**
 * SOSButton
 * 
 * Emergency SOS button for MSME owners.
 * Features:
 * - Prominent red styling
 * - Confirmation dialog before sending
 * - 60-second cooldown to prevent spam
 * - Full-width or icon variant
 */
export function SOSButton({
  variant = 'full',
  size = 'md',
  onSOS,
  disabled = false,
  cooldownSeconds = 60,
}: SOSButtonProps) {
  const [isSending, setIsSending] = useState(false)
  const [isOnCooldown, setIsOnCooldown] = useState(false)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const { t } = useTranslation()

  // Countdown timer for cooldown
  useEffect(() => {
    if (!isOnCooldown) return

    const timer = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          setIsOnCooldown(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isOnCooldown])

  const handleSOS = async () => {
    setShowConfirm(false)
    setIsSending(true)

    try {
      if (onSOS) {
        await onSOS()
      }

      // Start cooldown
      setIsOnCooldown(true)
      setCooldownRemaining(cooldownSeconds)
    } catch (error) {
      console.error('SOS failed:', error)
    } finally {
      setIsSending(false)
    }
  }

  const isDisabled = disabled || isSending || isOnCooldown

  // Icon variant
  if (variant === 'icon') {
    return (
      <>
        <Button
          onClick={() => setShowConfirm(true)}
          disabled={isDisabled}
          className={cn(
            'h-10 w-10 bg-status-critical hover:bg-status-critical/90 text-white',
            isOnCooldown && 'opacity-50 cursor-not-allowed'
          )}
          size="icon"
          title={
            isOnCooldown
              ? `${t('chat.sos-cooldown')} (${cooldownRemaining}s)`
              : t('chat.send-sos')
          }
        >
          <AlertOctagon className="size-5" />
        </Button>

        {/* Confirmation Dialog */}
        {showConfirm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
              <div className="flex items-center gap-3">
                <AlertOctagon className="size-6 text-status-critical flex-shrink-0" />
                <h2 className="text-h2 font-semibold text-text-primary">
                  {t('chat.sos-confirm-title')}
                </h2>
              </div>

              <p className="text-body text-text-secondary">
                {t('chat.sos-confirm-message')}
              </p>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirm(false)}
                  disabled={isSending}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleSOS}
                  disabled={isSending}
                  className="bg-status-critical hover:bg-status-critical/90 text-white"
                >
                  {isSending ? t('common.sending') : t('chat.send-sos')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // Full width variant
  return (
    <>
      <Button
        onClick={() => setShowConfirm(true)}
        disabled={isDisabled}
        className={cn(
          'w-full bg-status-critical hover:bg-status-critical/90 text-white font-semibold',
          isOnCooldown && 'opacity-50 cursor-not-allowed',
          size === 'sm' && 'h-8 text-sm',
          size === 'md' && 'h-10 text-base',
          size === 'lg' && 'h-12 text-lg'
        )}
      >
        <AlertOctagon className={cn('mr-2', size === 'sm' && 'size-4')} />
        {isOnCooldown
          ? `${t('chat.sos-cooldown')} (${cooldownRemaining}s)`
          : t('chat.send-sos')}
      </Button>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <AlertOctagon className="size-6 text-status-critical flex-shrink-0" />
              <h2 className="text-h2 font-semibold text-text-primary">
                {t('chat.sos-confirm-title')}
              </h2>
            </div>

            <p className="text-body text-text-secondary">
              {t('chat.sos-confirm-message')}
            </p>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowConfirm(false)}
                disabled={isSending}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleSOS}
                disabled={isSending}
                className="bg-status-critical hover:bg-status-critical/90 text-white"
              >
                {isSending ? t('common.sending') : t('chat.send-sos')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

SOSButton.displayName = 'SOSButton'
