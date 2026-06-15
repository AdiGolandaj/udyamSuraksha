import {
  json,
  type LoaderFunction,
  type MetaFunction,
  type ActionFunction,
} from '@remix-run/node'
import {
  useLoaderData,
  isRouteErrorResponse,
  useRouteError,
  useFetcher,
  useNavigate,
} from '@remix-run/react'
import { requireAuthenticatedUser } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import {
  PageHeader,
  SectionCard,
  RiskBadge,
  TimelineStep,
  SensitivityTag,
  ErrorCard,
} from '~/components/shared'
import { Button } from '~/components/ui/button'
import { Progress } from '~/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '~/components/ui/alert-dialog'
import { useTranslation } from '~/hooks/useTranslation'
import { format } from 'date-fns'
import { Grid } from '@mui/material'
import { ArrowLeft, Phone, MessageCircle } from 'lucide-react'

interface AffectedStockItem {
  id: string
  name: string
  sensitivity: string
  estimatedDamage: number
  status: 'AT_RISK' | 'MONITOR' | 'SAFE'
}

interface AlertAction {
  id: string
  title: string
  description: string
  isCompleted: boolean
}

interface AlertDetailLoaderData {
  userId: string
  shopId: string
  alert: {
    id: string
    title: string
    category: string
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    summary: string
    isRead: boolean
    createdAt: string
    updatedAt: string
  }
  affectedItems: AffectedStockItem[]
  recommendedActions: AlertAction[]
  completedActionsCount: number
}

export const meta: MetaFunction = ({ data }: any) => [
  { title: `${data?.alert?.title || 'Alert'} | DisasterShield` },
]

export const loader: LoaderFunction = async ({ request, params }) => {
  try {
    const user = await requireAuthenticatedUser(request)

    if (user.id !== params.userId || user.role !== 'msme') {
      throw new Response('Unauthorized', { status: 403 })
    }

    const shopProfile = await db.shopProfile.findUnique({
      where: { userId: user.id },
    })

    if (!shopProfile) {
      throw new Response('Shop profile not found', { status: 404 })
    }

    // Fetch the alert recipient record
    const alertRecipient = await db.alertRecipient.findUnique({
      where: {
        alertId_userId: {
          alertId: params.alertId!,
          userId: user.id,
        },
      },
      include: {
        alert: {
          include: {
            recipients: {
              where: { userId: user.id },
              include: {
                actionResults: {
                  include: {
                    alertAction: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!alertRecipient) {
      throw new Response('Alert not found', { status: 404 })
    }

    // Mark as read if not already
    if (!alertRecipient.isRead) {
      await db.alertRecipient.update({
        where: {
          alertId_userId: {
            alertId: params.alertId!,
            userId: user.id,
          },
        },
        data: { isRead: true },
      })
    }

    const alert = alertRecipient.alert

    // Fetch affected stock items
    const affectedItems = await db.stockItem.findMany({
      where: {
        shopProfileId: shopProfile.id,
        sensitivities: {
          some: {
            type: alert.category as any,
          },
        },
      },
      include: {
        sensitivities: true,
      },
      take: 10,
    })

    // Get forecast damage for each item
    const affectedItemsData: AffectedStockItem[] = await Promise.all(
      affectedItems.map(async item => {
        const forecast = await db.forecastAffectedItem.findFirst({
          where: {
            stockItemName: item.name,
            forecastScenario: {
              shopProfileId: shopProfile.id,
            },
          },
        })

        return {
          id: item.id,
          name: item.name,
          sensitivity: item.sensitivities[0]?.type.toLowerCase() || 'unknown',
          estimatedDamage: forecast?.estimatedDamageInr || 0,
          status: forecast?.estimatedDamageInr ? 'AT_RISK' : 'MONITOR',
        }
      })
    )

    // Get alert actions and their completion status
    const recipient = alert.recipients[0]
    const recommendedActions: AlertAction[] = (recipient?.actionResults || []).map((result: any) => ({
      id: result.id,
      title: result.alertAction.label,
      description: result.alertAction.actionType,
      isCompleted: result.isCompleted,
    }))

    const completedActionsCount = recommendedActions.filter(a => a.isCompleted).length

    const loaderData: AlertDetailLoaderData = {
      userId: user.id,
      shopId: shopProfile.id,
      alert: {
        id: alert.id,
        title: alert.title,
        category: alert.category.replace(/_/g, ' '),
        severity: alert.severity,
        summary: alert.summary,
        isRead: true, // Just marked as read
        createdAt: alert.createdAt.toISOString(),
        updatedAt: alert.updatedAt.toISOString(),
      },
      affectedItems: affectedItemsData,
      recommendedActions,
      completedActionsCount,
    }

    return json(loaderData)
  } catch (error) {
    if (error instanceof Response) {
      throw error
    }
    console.error('Alert detail loader error:', error)
    throw new Response('Internal Server Error', { status: 500 })
  }
}

export const action: ActionFunction = async ({ request, params }) => {
  if (request.method !== 'POST') {
    throw new Response('Method not allowed', { status: 405 })
  }

  try {
    const user = await requireAuthenticatedUser(request)

    if (user.id !== params.userId || user.role !== 'msme') {
      throw new Response('Unauthorized', { status: 403 })
    }

    const formData = await request.formData()
    const intent = formData.get('intent')

    if (intent === 'complete-action') {
      const actionResultId = formData.get('actionResultId') as string
      const isCompleted = formData.get('isCompleted') === 'true'

      await db.alertActionResult.update({
        where: { id: actionResultId },
        data: {
          isCompleted,
          completedAt: isCompleted ? new Date() : null,
        },
      })

      return json({ success: true })
    }

    throw new Response('Invalid intent', { status: 400 })
  } catch (error) {
    if (error instanceof Response) {
      throw error
    }
    console.error('Alert detail action error:', error)
    throw new Response('Failed to process alert action', { status: 400 })
  }
}

export default function MsmeAlertDetail() {
  const { t } = useTranslation()
  const data = useLoaderData<AlertDetailLoaderData>()
  const navigate = useNavigate()
  const fetcher = useFetcher()

  const handleToggleAction = (actionResultId: string, isCompleted: boolean) => {
    fetcher.submit(
      {
        intent: 'complete-action',
        actionResultId,
        isCompleted: (!isCompleted).toString(),
      },
      { method: 'POST' }
    )
  }

  return (
    <div className="min-h-screen bg-surface-secondary p-4 md:p-6">
      {/* Back Button */}
      <button
        onClick={() => navigate(`/msme/${data.userId}/alerts`)}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Alerts
      </button>

      {/* Alert Header */}
      <PageHeader
        title={data.alert.title}
        subtitle={`${data.alert.category} • ${format(new Date(data.alert.createdAt), 'MMM d, yyyy h:mm a')}`}
        action={<RiskBadge level={data.alert.severity.toLowerCase() as any} />}
      />

      {/* Alert Summary */}
      <SectionCard title="Alert Details" className="mb-6">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p>{data.alert.summary}</p>
        </div>
      </SectionCard>

      {/* Affected Stock Items */}
      <SectionCard title="Your Affected Stock Items" className="mb-6">
        {data.affectedItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No stock items match this alert category
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Sensitivity</TableHead>
                  <TableHead>Est. Damage</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.affectedItems.map(item => (
                  <TableRow
                    key={item.id}
                    onClick={() => navigate(`/msme/${data.userId}/stock/${item.id}`)}
                    className="cursor-pointer hover:bg-muted/50 transition"
                  >
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <SensitivityTag type={item.sensitivity as any} />
                    </TableCell>
                    <TableCell>₹{item.estimatedDamage.toLocaleString('en-IN')}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${
                          item.status === 'AT_RISK'
                            ? 'bg-danger/10 text-danger'
                            : item.status === 'MONITOR'
                              ? 'bg-warning/10 text-warning'
                              : 'bg-success/10 text-success'
                        }`}
                      >
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      {/* Recommended Actions */}
      <SectionCard title="What To Do Now" className="mb-6">
        {data.recommendedActions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No recommended actions for this alert
          </div>
        ) : (
          <>
            <Progress
              value={
                data.recommendedActions.length > 0
                  ? (data.completedActionsCount / data.recommendedActions.length) * 100
                  : 0
              }
              className="h-2 mb-4"
            />
            <div className="text-sm text-muted-foreground mb-6">
              {data.completedActionsCount} of {data.recommendedActions.length} actions completed
            </div>

            <div className="space-y-3">
              {data.recommendedActions.map((action, idx) => (
                <TimelineStep
                  key={action.id}
                  stepNumber={idx + 1}
                  title={action.title}
                  description={action.description}
                  isCompleted={action.isCompleted}
                  onToggle={() => handleToggleAction(action.id, action.isCompleted)}
                />
              ))}
            </div>
          </>
        )}
      </SectionCard>

      {/* Emergency Support */}
      <SectionCard title="Need Help?">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button variant="outline" className="gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="flex items-center gap-2 w-full justify-center">
                  <Phone className="w-4 h-4" />
                  Request Support from LRDB
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Request Emergency Support</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your LRDB officer will be notified and can provide immediate assistance.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex gap-3 justify-end">
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction>Send Request</AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          </Button>

          <Button variant="outline" className="gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="flex items-center gap-2 w-full justify-center">
                  <MessageCircle className="w-4 h-4" />
                  Ask Community for Help
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Send SOS to Community</AlertDialogTitle>
                  <AlertDialogDescription>
                    Alert nearby business owners in your community group for mutual aid and resource sharing.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex gap-3 justify-end">
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction>Send SOS</AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          </Button>
        </div>
      </SectionCard>
    </div>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()
  return (
    <div className="min-h-screen bg-surface-secondary p-4 md:p-6">
      <ErrorCard
        title="Error loading alert"
        message={
          isRouteErrorResponse(error) ? error.statusText : 'Failed to load the alert details'
        }
      />
    </div>
  )
}
