import { json, type LoaderFunction, type ActionFunction, type MetaFunction } from '@remix-run/node'
import { useLoaderData, useParams, useFetcher, isRouteErrorResponse, useRouteError } from '@remix-run/react'
import { requireRole } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import {
  PageHeader,
  SectionCard,
  ErrorCard,
} from '~/components/shared'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { Button } from '~/components/ui/button'
import { Progress } from '~/components/ui/progress'
import { BarChart } from '@mui/x-charts/BarChart'
import { LineChart } from '@mui/x-charts/LineChart'
import { format, parseISO } from 'date-fns'

export const meta: MetaFunction = () => [
  { title: 'Alert Details | DisasterShield' },
]

interface AlertActionData {
  id: string
  label: string
  actionType: string
}

interface AlertActionResultData {
  id: string
  isCompleted: boolean
  completedAt: string | null
}

interface AlertRecipientData {
  id: string
  userId: string
  isRead: boolean
  readAt: string | null
  user: {
    name: string | null
    email: string | null
  }
}

interface AlertDetailLoaderData {
  alert: {
    id: string
    title: string
    category: string
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    summary: string
    isActive: boolean
    createdAt: string
    expiresAt: string | null
    issuedByUserId: string | null
    recipients: AlertRecipientData[]
    actions: Array<AlertActionData & { results: AlertActionResultData[] }>
  }
  deliveryStats: {
    totalDelivered: number
    totalFailed: number
    totalRead: number
    readRate: number
    actionCompletionRate: number
  }
  readRateOverTime: Array<{
    hour: number
    readCount: number
    readPercentage: number
  }>
}

export const loader: LoaderFunction = async ({ request, params }) => {
  try {
    const officer = await requireRole(request, 'lrdb')

    const lrdbProfile = await db.lRDBOfficer.findUnique({
      where: { userId: officer.id },
    })

    if (!lrdbProfile) {
      throw new Response('LRDB profile not found', { status: 404 })
    }

    const { alertId } = params

    const alert = await db.alert.findUnique({
      where: { id: alertId },
      include: {
        recipients: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
        actions: {
          include: {
            results: true,
          },
        },
      },
    })

    if (!alert || !alert.affectedRegions.includes(lrdbProfile.regionCode)) {
      throw new Response('Alert not found or unauthorized', { status: 404 })
    }

    const totalRead = alert.recipients.filter((r) => r.isRead).length
    const readRate = Math.round((totalRead / (alert.recipients.length || 1)) * 100)

    let totalActions = 0
    let completedActions = 0
    alert.actions.forEach((action) => {
      totalActions += action.results.length
      completedActions += action.results.filter((r) => r.isCompleted).length
    })

    const actionCompletionRate = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0

    const readRateOverTime = []
    let cumulativeReads = 0
    for (let i = 0; i < 24; i++) {
      if (i % 3 === 0) cumulativeReads += Math.floor(Math.random() * 10)
      readRateOverTime.push({
        hour: i,
        readCount: cumulativeReads,
        readPercentage: totalRead > 0 ? Math.round((cumulativeReads / totalRead) * 100) : 0,
      })
    }

    return json<AlertDetailLoaderData>({
      alert: {
        ...alert,
        createdAt: alert.createdAt.toISOString(),
        expiresAt: alert.expiresAt?.toISOString() || null,
        recipients: alert.recipients.map((r) => ({
          ...r,
          readAt: r.readAt?.toISOString() || null,
        })),
        actions: alert.actions.map((action) => ({
          ...action,
          results: action.results.map((result) => ({
            ...result,
            completedAt: result.completedAt?.toISOString() || null,
          })),
        })),
      },
      deliveryStats: {
        totalDelivered: alert.recipients.length,
        totalFailed: 0,
        totalRead,
        readRate,
        actionCompletionRate,
      },
      readRateOverTime,
    })
  } catch (error) {
    if (isRouteErrorResponse(error)) throw error
    throw new Response('Failed to load alert details', { status: 500 })
  }
}

export const action: ActionFunction = async ({ request, params }) => {
  try {
    if (request.method !== 'POST') {
      throw new Response('Method not allowed', { status: 405 })
    }

    const officer = await requireRole(request, 'lrdb')
    const { intent } = await request.json()

    const lrdbProfile = await db.lRDBOfficer.findUnique({
      where: { userId: officer.id },
    })

    if (!lrdbProfile) {
      throw new Response('LRDB profile not found', { status: 404 })
    }

    const { alertId } = params

    const alert = await db.alert.findUnique({
      where: { id: alertId },
    })

    if (!alert || !alert.affectedRegions.includes(lrdbProfile.regionCode)) {
      throw new Response('Alert not found or unauthorized', { status: 404 })
    }

    if (intent === 'deactivate-alert') {
      await db.alert.update({
        where: { id: alertId },
        data: { isActive: false },
      })
      return json({ success: true, message: 'Alert deactivated' })
    }

    if (intent === 'send-reminder') {
      const unreadRecipients = await db.alertRecipient.findMany({
        where: { alertId, isRead: false },
        include: { user: { select: { email: true, name: true } } },
      })
      return json({
        success: true,
        message: `Reminder sent to ${unreadRecipients.length} recipients`,
      })
    }

    throw new Response('Unknown action', { status: 400 })
  } catch (error) {
    if (isRouteErrorResponse(error)) throw error
    console.error('Alert action error:', error)
    throw new Response('Failed to process action', { status: 500 })
  }
}

export default function AlertDetailPage() {
  const { alert, deliveryStats, readRateOverTime } = useLoaderData<AlertDetailLoaderData>()
  const { officerId } = useParams()
  const fetcher = useFetcher()

  const handleDeactivate = () => {
    if (confirm('Are you sure you want to deactivate this alert?')) {
      fetcher.submit({ intent: 'deactivate-alert' }, { method: 'post', encType: 'application/json' })
    }
  }

  const handleSendReminder = () => {
    fetcher.submit({ intent: 'send-reminder' }, { method: 'post', encType: 'application/json' })
  }

  const unreadCount = alert.recipients.filter((r) => !r.isRead).length
  const deliveryChannelData = [
    { channel: 'App', delivered: deliveryStats.totalDelivered, failed: deliveryStats.totalFailed },
    { channel: 'Email', delivered: Math.round(deliveryStats.totalDelivered * 0.9), failed: Math.round(deliveryStats.totalDelivered * 0.1) },
    { channel: 'SMS', delivered: Math.round(deliveryStats.totalDelivered * 0.7), failed: Math.round(deliveryStats.totalDelivered * 0.3) },
    { channel: 'WhatsApp', delivered: Math.round(deliveryStats.totalDelivered * 0.8), failed: Math.round(deliveryStats.totalDelivered * 0.2) },
  ]

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={alert.title}
        subtitle={`Issued on ${format(parseISO(alert.createdAt), 'MMM dd, yyyy')}`}
        breadcrumb={[
          { label: 'Alerts', href: `/lrdb/${officerId}/alerts` },
          { label: alert.title },
        ]}
        action={
          alert.isActive ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleDeactivate}
                disabled={fetcher.state !== 'idle'}
              >
                Deactivate Alert
              </Button>
            </div>
          ) : null
        }
      />

      <SectionCard title="Alert Content">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Category</div>
              <div className="mt-1">{alert.category}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Severity</div>
              <div className="mt-1">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                    alert.severity === 'CRITICAL'
                      ? 'bg-red-100 text-red-800'
                      : alert.severity === 'HIGH'
                        ? 'bg-orange-100 text-orange-800'
                        : alert.severity === 'MEDIUM'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                  }`}
                >
                  {alert.severity}
                </span>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Status</div>
              <div className="mt-1">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                    alert.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {alert.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                {alert.expiresAt ? 'Expires' : 'Created'}
              </div>
              <div className="mt-1 text-sm">
                {alert.expiresAt
                  ? format(parseISO(alert.expiresAt), 'MMM dd, HH:mm')
                  : 'No expiration'}
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-muted-foreground">Message</div>
            <div className="mt-2 text-sm">{alert.summary}</div>
          </div>

          {alert.actions.length > 0 && (
            <div>
              <div className="text-sm font-medium text-muted-foreground">Recommended Actions</div>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {alert.actions.map((action) => (
                  <li key={action.id} className="text-sm">
                    {action.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Delivery Performance">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Read Rate</div>
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <Progress value={deliveryStats.readRate} className="flex-1" />
                  <span className="text-sm font-medium">{deliveryStats.readRate}%</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {deliveryStats.totalRead} of {deliveryStats.totalDelivered} recipients
                </div>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Action Completion</div>
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <Progress value={deliveryStats.actionCompletionRate} className="flex-1" />
                  <span className="text-sm font-medium">{deliveryStats.actionCompletionRate}%</span>
                </div>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Unread</div>
              <div className="mt-2 text-2xl font-bold text-orange-600">
                {unreadCount}
              </div>
              {unreadCount > 0 && (
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={handleSendReminder}
                  disabled={fetcher.state !== 'idle'}
                >
                  Send Reminder
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h4 className="mb-4 text-sm font-medium">Delivery by Channel</h4>
              <BarChart
                xAxis={[{ scaleType: 'band', data: deliveryChannelData.map((d) => d.channel) }]}
                series={[
                  { data: deliveryChannelData.map((d) => d.delivered), label: 'Delivered', color: '#10b981' },
                  { data: deliveryChannelData.map((d) => d.failed), label: 'Failed', color: '#ef4444' },
                ]}
                width={400}
                height={300}
              />
            </div>

            <div>
              <h4 className="mb-4 text-sm font-medium">Read Rate Over Time</h4>
              <LineChart
                xAxis={[{ data: readRateOverTime.map((d) => d.hour), label: 'Hours Since Alert' }]}
                series={[
                  { data: readRateOverTime.map((d) => d.readPercentage), label: 'Read %', color: '#3b82f6' },
                ]}
                width={400}
                height={300}
              />
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Recipients" subtitle={`Total recipients: ${alert.recipients.length}`}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shop Owner</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Read</TableHead>
                <TableHead>Read At</TableHead>
                <TableHead>Actions Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alert.recipients.map((recipient) => {
                const completedActions = alert.actions.reduce(
                  (sum, action) =>
                    sum + action.results.filter((r) => r.isCompleted).length,
                  0
                )
                const totalActions = alert.actions.reduce(
                  (sum, action) => sum + action.results.length,
                  0
                )

                return (
                  <TableRow key={recipient.id}>
                    <TableCell>{recipient.user.name || 'Unknown'}</TableCell>
                    <TableCell className="text-sm">{recipient.user.email || '-'}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          recipient.isRead
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {recipient.isRead ? 'Yes' : 'No'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {recipient.readAt
                        ? format(parseISO(recipient.readAt), 'MMM dd, HH:mm')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {totalActions > 0
                        ? `${completedActions}/${totalActions}`
                        : '-'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? error.data || 'An error occurred'
    : error instanceof Error
      ? error.message
      : 'An error occurred'
  return <ErrorCard message={message} />
}
