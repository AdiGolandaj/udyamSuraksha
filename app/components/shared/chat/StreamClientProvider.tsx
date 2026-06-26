'use client'

import React, { useEffect, useState } from 'react'
import { StreamChat } from 'stream-chat'
import { Chat } from 'stream-chat-react'
import { ClientOnly } from 'remix-utils/client-only'
import { useTranslation } from '~/hooks/useTranslation'
import 'stream-chat-react/dist/css/v2/index.css'

export interface StreamClientProviderProps {
  apiKey: string
  userId: string
  token: string
  userData: {
    id: string
    name: string
    image?: string
    role: string
    regionCode: string
    [key: string]: string | undefined
  }
  children: React.ReactNode
}

/**
 * StreamClientProvider
 * 
 * Initializes the Stream Chat client with user credentials and provides
 * the Chat context to child components. Wrapped in ClientOnly to prevent
 * SSR issues with the Stream SDK.
 */
export function StreamClientProvider({
  apiKey,
  userId,
  token,
  userData,
  children,
}: StreamClientProviderProps) {
  const [client, setClient] = useState<StreamChat | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { t } = useTranslation()

  useEffect(() => {
    let isMounted = true

    const initializeClient = async () => {
      try {
        const streamClient = StreamChat.getInstance(apiKey)

        // Reuse the existing connection when navigating between chat pages
        if (streamClient.userID === userId) {
          console.log('[StreamClientProvider] Reusing existing connection', { userId })
          if (isMounted) {
            setClient(streamClient)
            setError(null)
          }
          return
        }

        // If connected as a different user, disconnect first
        if (streamClient.userID) {
          console.log('[StreamClientProvider] Disconnecting previous user', { previousUserId: streamClient.userID })
          await streamClient.disconnectUser()
        }

        console.log('[StreamClientProvider] Connecting user...', { userId, apiKey: apiKey.slice(0, 8) + '...' })
        await streamClient.connectUser(userData, token)
        console.log('[StreamClientProvider] User connected successfully', { userId, connectionId: streamClient.wsConnection?.connectionID })

        if (isMounted) {
          setClient(streamClient)
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          console.error('[StreamClientProvider] Connection error:', err)
          setError(t('chat.connection-error'))
        }
      }
    }

    initializeClient()

    return () => {
      isMounted = false
      // Do not disconnect on unmount — the singleton connection is shared
      // across chat list and chat group pages to avoid connect/disconnect races.
    }
  }, [apiKey, userId, token]) // userData excluded: object identity changes on every render

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center max-w-md">
          <h2 className="text-h2 text-text-primary mb-2">
            {t('chat.unavailable')}
          </h2>
          <p className="text-body text-text-secondary mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90"
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <ClientOnly
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-pulse text-text-secondary">
            {t('common.loading')}
          </div>
        </div>
      }
    >
      {() =>
        client ? (
          <Chat client={client} theme="str-chat__theme-light">
            {children}
          </Chat>
        ) : (
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-pulse text-text-secondary">
              {t('common.loading')}
            </div>
          </div>
        )
      }
    </ClientOnly>
  )
}
