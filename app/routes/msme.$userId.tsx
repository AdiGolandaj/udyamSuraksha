import { json, type LoaderFunction, type MetaFunction } from '@remix-run/node'
import { useLoaderData, Outlet, isRouteErrorResponse, useRouteError } from '@remix-run/react'
import { requireAuthenticatedUser } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import { AppShell, ErrorCard } from '~/components/shared'

export const meta: MetaFunction = () => [
  { title: 'MSME Dashboard | DisasterShield' },
]

interface MsmeLoaderData {
  userId: string
  userName: string
  userEmail: string
  userAvatar?: string
  language: 'en' | 'mr' | 'hi'
  unreadAlertCount: number
  unreadChatCount: number
}

export const loader: LoaderFunction = async ({ request, params }) => {
  try {
    // Require authentication
    const user = await requireAuthenticatedUser(request)

    // Ensure user matches params
    if (user.id !== params.userId) {
      throw new Response('Unauthorized', { status: 403 })
    }

    // Check if user has MSME role
    if (user.role !== 'msme') {
      throw new Response('Not Found', { status: 404 })
    }

    // Fetch user data and counts
    const userData = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        language: true,
        alertRecipients: {
          where: { isRead: false },
          select: { id: true },
        },
        chatGroupMembers: {
          select: {
            chatGroup: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    })

    if (!userData) {
      throw new Response('User not found', { status: 404 })
    }

    // Count unread alerts
    const unreadAlertCount = userData.alertRecipients.length

    // Count unread chat groups (placeholder - actual logic depends on Stream)
    const unreadChatCount = 0

    const loaderData: MsmeLoaderData = {
      userId: userData.id,
      userName: userData.name,
      userEmail: userData.email,
      userAvatar: userData.avatarUrl || undefined,
      language: userData.language as 'en' | 'mr' | 'hi',
      unreadAlertCount,
      unreadChatCount,
    }

    return json(loaderData)
  } catch (error) {
    if (error instanceof Response) {
      throw error
    }
    throw new Response('Internal Server Error', { status: 500 })
  }
}

export default function MsmeLayout() {
  const {
    userId,
    userName,
    userEmail,
    userAvatar,
    language,
    unreadAlertCount,
    unreadChatCount,
  } = useLoaderData<MsmeLoaderData>()

  return (
    <AppShell
      role="msme"
      userId={userId}
      userName={userName}
      userEmail={userEmail}
      userAvatar={userAvatar}
      language={language}
      unreadAlertCount={unreadAlertCount}
      unreadChatCount={unreadChatCount}
    >
      <Outlet />
    </AppShell>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    return (
      <AppShell
        role="msme"
        userId="unknown"
        userName="Guest"
        userEmail=""
        language="en"
      >
        <ErrorCard
          title={`Error ${error.status}`}
          message={error.statusText || 'An unexpected error occurred'}
          compact={false}
        />
      </AppShell>
    )
  }

  return (
    <AppShell
      role="msme"
      userId="unknown"
      userName="Guest"
      userEmail=""
      language="en"
    >
      <ErrorCard
        title="Error"
        message="An unexpected error occurred. Please try again."
        compact={false}
      />
    </AppShell>
  )
}
