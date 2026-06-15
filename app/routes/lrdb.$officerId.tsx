import { json, type LoaderFunction, type MetaFunction } from '@remix-run/node'
import { useLoaderData, Outlet, isRouteErrorResponse, useRouteError } from '@remix-run/react'
import { requireRole } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import { AppShell, ErrorCard } from '~/components/shared'
import type { SessionUser } from '~/lib/auth.server'

export const meta: MetaFunction = () => [
  { title: 'LRDB Dashboard | DisasterShield' },
]

interface LrdbLayoutLoaderData {
  officerId: string
  officer: SessionUser
  lrdbProfile: {
    id: string
    userId: string
    regionCode: string
    district: string
    taluka: string
    designation: string
  }
}

export const loader: LoaderFunction = async ({ request, params }) => {
  try {
    // Require LRDB role
    const officer = await requireRole(request, 'lrdb')

    // Ensure officer ID matches params
    if (officer.id !== params.officerId) {
      throw new Response('Unauthorized', { status: 403 })
    }

    // Fetch LRDB officer profile with all required data
    const lrdbProfile = await db.lRDBOfficer.findUnique({
      where: { userId: officer.id },
      include: { user: true },
    })

    if (!lrdbProfile) {
      throw new Response('LRDB profile not found', { status: 404 })
    }

    return json<LrdbLayoutLoaderData>({
      officerId: officer.id,
      officer,
      lrdbProfile: {
        id: lrdbProfile.id,
        userId: lrdbProfile.userId,
        regionCode: lrdbProfile.regionCode,
        district: lrdbProfile.district,
        taluka: lrdbProfile.taluka ?? '',
        designation: lrdbProfile.designation || 'LRDB Officer',
      },
    })
  } catch (error) {
    console.error('LRDB Layout Loader Error:', error)
    throw error
  }
}

export default function LrdbLayout() {
  const { officer, lrdbProfile } = useLoaderData<typeof loader>()

  return (
    <AppShell
      role="lrdb"
      userId={officer.id}
      userName={officer.name}
      userAvatar={officer.avatar}
      userEmail={officer.email}
    >
      <Outlet context={{ ...lrdbProfile }} />
    </AppShell>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    return (
      <ErrorCard
        title={`${error.status} Error`}
        message={error.statusText || 'An error occurred'}
      />
    )
  }

  return <ErrorCard title="Error" message="An unexpected error occurred" />
}
