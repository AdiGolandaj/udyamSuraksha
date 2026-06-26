import {
  json,
  type LoaderFunction,
  type MetaFunction,
} from '@remix-run/node'
import {
  useLoaderData,
  isRouteErrorResponse,
  useRouteError,
  useFetcher,
  useNavigate,
} from '@remix-run/react'
import React from 'react'
import { requireAuthenticatedUser } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import {
  PageHeader,
  SectionCard,
  AlertCard,
  EmptyState,
  LoadingSkeleton,
  ErrorCard,
} from '~/components/shared'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '~/components/ui/tabs'
import { useTranslation } from '~/hooks/useTranslation'
import { format, isToday, isYesterday, isThisWeek } from 'date-fns'
import { BellRing } from 'lucide-react'

interface AlertWithDetails {
  id: string
  title: string
  category: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  summary: string
  isRead: boolean
  createdAt: string
  affectedItems: Array<{
    name: string
    estimatedDamage: number
  }>
  primaryAction?: {
    title: string
    description: string
  }
}

interface AlertsListLoaderData {
  userId: string
  unreadCount: number
  allAlerts: AlertWithDetails[]
}

export const meta: MetaFunction = () => [
  { title: 'Alerts | DisasterShield' },
]

// Handles both old JSON-blob format and new plain-text summary
function parseSummary(raw: string): string {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.summary === 'string') return parsed.summary
  } catch {}
  return raw
}

// AlertCategory → SensitivityType mapping (different enums in schema)
const CATEGORY_SENSITIVITIES: Record<string, string[]> = {
  FLOOD:         ['WATER'],
  WIND:          ['FRAGILE'],
  POWER_OUTAGE:  ['PERISHABLE'],
  HEATWAVE:      ['HEAT', 'PERISHABLE'],
  LANDSLIDE:     ['WATER', 'FRAGILE'],
  TRANSPORT:     [],
  OTHER:         [],
}

export const loader: LoaderFunction = async ({ request, params }) => {
  try {
    const user = await requireAuthenticatedUser(request)

    if (user.id !== params.userId || user.role !== 'msme') {
      throw new Response('Unauthorized', { status: 403 })
    }

    // Get filter from URL search params
    const url = new URL(request.url)
    const filter = url.searchParams.get('filter') || 'all'

    // Fetch shop profile once — used to scope stock item queries per alert
    const shopProfile = await db.shopProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })

    // Fetch all alert recipients for this user
    let where: any = {
      userId: user.id,
    }

    if (filter === 'unread') {
      where.isRead = false
    } else if (filter === 'critical') {
      where.alert = {
        severity: 'CRITICAL',
      }
    } else if (['FLOOD', 'POWER', 'WIND'].includes(filter.toUpperCase())) {
      where.alert = {
        category: filter.toUpperCase(),
      }
    } else if (filter === 'resolved') {
      where.isRead = true
    }

    const alertRecipients = await db.alertRecipient.findMany({
      where,
      include: {
        alert: {
          include: {
            recipients: {
              where: { userId: user.id },
              include: {
                actionResults: true,
              },
            },
          },
        },
      },
      orderBy: { alert: { createdAt: 'desc' } },
    })

    // Fetch affected stock items per alert — scoped to this user's shop
    const alerts: AlertWithDetails[] = await Promise.all(
      alertRecipients.map(async recipient => {
        const alert = recipient.alert

        const sensitivityTypes = CATEGORY_SENSITIVITIES[alert.category] ?? []
        const affectedItems =
          shopProfile && sensitivityTypes.length > 0
            ? await db.stockItem.findMany({
                where: {
                  shopProfileId: shopProfile.id,
                  sensitivities: { some: { type: { in: sensitivityTypes as any[] } } },
                },
                select: { name: true, estimatedValueInr: true },
                orderBy: { estimatedValueInr: 'desc' },
                take: 3,
              })
            : shopProfile
              ? await db.stockItem.findMany({
                  where: { shopProfileId: shopProfile.id },
                  select: { name: true, estimatedValueInr: true },
                  orderBy: { estimatedValueInr: 'desc' },
                  take: 3,
                })
              : []

        return {
          id: alert.id,
          title: alert.title,
          category: alert.category.replace(/_/g, ' '),
          severity: alert.severity,
          summary: parseSummary(alert.summary),
          isRead: recipient.isRead,
          createdAt: alert.createdAt.toISOString(),
          affectedItems: affectedItems.map(item => ({
            name: item.name,
            estimatedDamage: item.estimatedValueInr ?? 0,
          })),
          primaryAction: alert.recipients[0]?.actionResults[0]
            ? {
                title: 'View Details',
                description: 'See all affected items and recommendations',
              }
            : undefined,
        }
      })
    )

    const unreadCount = alerts.filter(a => !a.isRead).length

    const loaderData: AlertsListLoaderData = {
      userId: user.id,
      unreadCount,
      allAlerts: alerts,
    }

    return json(loaderData)
  } catch (error) {
    if (error instanceof Response) {
      throw error
    }
    console.error('Alerts list loader error:', error)
    throw new Response('Internal Server Error', { status: 500 })
  }
}

function groupAlertsByDate(alerts: AlertWithDetails[]) {
  const groups: Record<string, AlertWithDetails[]> = {
    'Today': [],
    'Yesterday': [],
    'This Week': [],
    'Older': [],
  }

  alerts.forEach(alert => {
    const alertDate = new Date(alert.createdAt)
    if (isToday(alertDate)) {
      groups['Today'].push(alert)
    } else if (isYesterday(alertDate)) {
      groups['Yesterday'].push(alert)
    } else if (isThisWeek(alertDate)) {
      groups['This Week'].push(alert)
    } else {
      groups['Older'].push(alert)
    }
  })

  return groups
}

function AlertListByDate({ alerts, onNavigate }: { alerts: AlertWithDetails[]; onNavigate: (alertId: string) => void }) {
  const groups = groupAlertsByDate(alerts)

  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([groupName, groupAlerts]) => {
        if (groupAlerts.length === 0) return null

        return (
          <div key={groupName}>
            <div className="px-2 py-2 text-sm font-medium text-muted-foreground border-b">
              {groupName}
            </div>
            <div className="space-y-2 mt-2">
              {groupAlerts.map(alert => (
                <AlertCard
                  key={alert.id}
                  alertId={alert.id}
                  title={alert.title}
                  severity={alert.severity.toLowerCase() as any}
                  category={alert.category}
                  isRead={alert.isRead}
                  summary={alert.summary}
                  affectedItems={alert.affectedItems.slice(0, 2).map(i => i.name)}
                  issuedAt={alert.createdAt}
                  isExpanded={false}
                  onViewDetails={() => onNavigate(alert.id)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function MsmeAlerts() {
  const { t } = useTranslation()
  const data = useLoaderData<AlertsListLoaderData>()
  const navigate = useNavigate()

  const [filter, setFilter] = React.useState('all')

  const filteredAlerts = React.useMemo(() => {
    if (filter === 'unread') return data.allAlerts.filter(a => !a.isRead)
    if (filter === 'critical') return data.allAlerts.filter(a => a.severity === 'CRITICAL')
    if (['FLOOD', 'POWER', 'WIND'].includes(filter)) {
      return data.allAlerts.filter(a => a.category.toUpperCase().includes(filter))
    }
    if (filter === 'resolved') return data.allAlerts.filter(a => a.isRead)
    return data.allAlerts
  }, [data.allAlerts, filter])

  return (
    <div className="min-h-screen bg-surface-secondary p-4 md:p-6">
      {/* Page Header */}
      <PageHeader
        title="Alerts"
        subtitle="Disaster warnings personalised to your shop"
        action={
          data.unreadCount > 0 && (
            <div className="inline-block px-3 py-1 bg-danger text-white rounded-full text-sm font-medium">
              {data.unreadCount} unread
            </div>
          )
        }
      />

      {/* Filter Tabs */}
      <div className="mb-6">
        <Tabs value={filter} onValueChange={setFilter} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="critical">Critical</TabsTrigger>
            <TabsTrigger value="FLOOD">Flood</TabsTrigger>
            <TabsTrigger value="POWER">Power</TabsTrigger>
            <TabsTrigger value="WIND">Wind</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Alert List */}
      {filteredAlerts.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title="No alerts"
          description="No alerts yet. You will be notified when a disaster risk is detected for your shop."
        />
      ) : (
        <AlertListByDate
          alerts={filteredAlerts}
          onNavigate={(alertId) => navigate(`/msme/${data.userId}/alerts/${alertId}`)}
        />
      )}
    </div>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()
  return (
    <div className="min-h-screen bg-surface-secondary p-4 md:p-6">
      <ErrorCard
        title="Error loading alerts"
        message={
          isRouteErrorResponse(error) ? error.statusText : 'Failed to load your alerts'
        }
      />
    </div>
  )
}
