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
} from '@remix-run/react'
import { useState } from 'react'
import { requireAuthenticatedUser } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import { apiClient } from '~/lib/api.server'
import {
  PageHeader,
  SectionCard,
  SensitivityTag,
  RiskBadge,
  TimelineStep,
  TrendChip,
  ErrorCard,
} from '~/components/shared'
import { Button } from '~/components/ui/button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Progress } from '~/components/ui/progress'
import { Trash2, Edit, ArrowLeft, Sparkles } from 'lucide-react'
import { useTranslation } from '~/hooks/useTranslation'
import { format } from 'date-fns'
import { Grid } from '@mui/material'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from '@mui/x-charts'

interface StockItemDetailLoaderData {
  userId: string
  shopId: string
  item: {
    id: string
    name: string
    category: string
    quantity: number
    unit: string
    estimatedValue: number
    storageLocation?: string
    expiryDate?: string
    vulnerabilityScore: number
    sensitivities: string[]
    notes?: string
  }
  recommendations: Array<{
    id: string
    title: string
  }>
  disasterScenarios: Array<{
    disasterType: string
    estimatedDamage: number
  }>
}

export const meta: MetaFunction = ({ data }: any) => [
  { title: `${data?.item?.name || 'Stock Item'} | DisasterShield` },
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

    const stockItem = await db.stockItem.findUnique({
      where: { id: params.itemId },
      include: {
        sensitivities: true,
      },
    })

    if (!stockItem || stockItem.shopProfileId !== shopProfile.id) {
      throw new Response('Stock item not found', { status: 404 })
    }

    // Fetch forecast scenarios affecting this item
    const forecastAffectedItems = await db.forecastAffectedItem.findMany({
      where: {
        stockItemName: stockItem.name,
        forecastScenario: {
          shopProfileId: shopProfile.id,
        },
      },
      include: {
        forecastScenario: true,
      },
    })

    const loaderData: StockItemDetailLoaderData = {
      userId: user.id,
      shopId: shopProfile.id,
      item: {
        id: stockItem.id,
        name: stockItem.name,
        category: stockItem.category,
        quantity: stockItem.quantity,
        unit: stockItem.unit,
        estimatedValue: stockItem.estimatedValueInr,
        storageLocation: stockItem.storageLocation,
        expiryDate: stockItem.expiryDate?.toISOString().split('T')[0],
        vulnerabilityScore: stockItem.vulnerabilityScore,
        sensitivities: stockItem.sensitivities.map(s => s.type.toLowerCase()),
        notes: stockItem.notes || undefined,
      },
      recommendations: [
        {
          id: '1',
          title: 'Move this item to a shelf at least 60cm above ground level to reduce flood damage risk.',
        },
        {
          id: '2',
          title: 'Store in a cool, dry area away from direct sunlight to minimize heat sensitivity.',
        },
        {
          id: '3',
          title: 'Keep away from electrical outlets and water sources.',
        },
      ],
      disasterScenarios: forecastAffectedItems.map(fai => ({
        disasterType: fai.forecastScenario.disasterType,
        estimatedDamage: fai.estimatedDamageInr,
      })),
    }

    return json(loaderData)
  } catch (error) {
    if (error instanceof Response) {
      throw error
    }
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

    const shopProfile = await db.shopProfile.findUnique({
      where: { userId: user.id },
    })

    if (!shopProfile) {
      throw new Response('Shop profile not found', { status: 404 })
    }

    const intent = new URL(request.url).searchParams.get('intent')

    if (intent === 'delete') {
      await db.stockItem.delete({
        where: { id: params.itemId },
      })

      // Recompute risk
      await apiClient.post('/risk/score', {
        shopId: shopProfile.id,
      })

      return json({ success: true, redirect: `/msme/${user.id}/stock` })
    }

    throw new Response('Invalid intent', { status: 400 })
  } catch (error) {
    if (error instanceof Response) {
      throw error
    }
    console.error('Stock item action error:', error)
    throw new Response('Failed to process request', { status: 400 })
  }
}

function DisasterImpactSimulation({
  scenarios,
}: {
  scenarios: Array<{ disasterType: string; estimatedDamage: number }>
}) {
  const { t } = useTranslation()
  const [selectedDisaster, setSelectedDisaster] = useState<string>(
    scenarios[0]?.disasterType || ''
  )
  const selectedScenario = scenarios.find(s => s.disasterType === selectedDisaster)

  if (scenarios.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        {t('stock.detail.noDisasterData')}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <Select value={selectedDisaster} onValueChange={setSelectedDisaster}>
        <SelectTrigger className="w-full sm:w-64">
          <SelectValue placeholder={t('stock.detail.selectDisaster')} />
        </SelectTrigger>
        <SelectContent>
          {scenarios.map(scenario => (
            <SelectItem key={scenario.disasterType} value={scenario.disasterType}>
              {scenario.disasterType}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedScenario && (
        <div className="p-4 bg-surface-secondary rounded-lg">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-text-secondary">
              {t('stock.detail.estimatedDamage')}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                ₹{selectedScenario.estimatedDamage.toLocaleString()}
              </span>
              <TrendChip
                value={Math.round(
                  (selectedScenario.estimatedDamage / 100000) * 100
                )}
                unit="%"
                direction="up"
                invertColor
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function StockItemDetail() {
  const { t } = useTranslation()
  const { userId, shopId, item, recommendations, disasterScenarios } =
    useLoaderData<StockItemDetailLoaderData>()

  const vulnerabilityColor =
    item.vulnerabilityScore > 70
      ? 'bg-red-500'
      : item.vulnerabilityScore > 40
        ? 'bg-yellow-500'
        : 'bg-green-500'

  const vulnerabilityLevel =
    item.vulnerabilityScore > 70
      ? 'high'
      : item.vulnerabilityScore > 40
        ? 'moderate'
        : 'safe'

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Section 3.6: Item Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          asChild
        >
          <a href={`/msme/${userId}/stock`}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('stock.detail.backToStock')}
          </a>
        </Button>

        <PageHeader
          title={item.name}
          subtitle={item.category}
          breadcrumb={[
            {
              label: t('stock.detail.breadcrumb.stock'),
              href: `/msme/${userId}/stock`,
            },
            {
              label: item.name,
            },
          ]}
          action={
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('stock.detail.delete')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t('stock.detail.deleteConfirm.title')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('stock.detail.deleteConfirm.description')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex gap-2 justify-end">
                  <AlertDialogCancel>
                    {t('stock.detail.deleteConfirm.cancel')}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground"
                    formAction={`?intent=delete`}
                    asChild
                  >
                    <form method="POST">
                      <button type="submit">
                        {t('stock.detail.deleteConfirm.confirm')}
                      </button>
                    </form>
                  </AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          }
        />
      </div>

      {/* Section 3.7: Item Detail Card */}
      <SectionCard title={t('stock.detail.details')}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-text-secondary">
                  {t('stock.detail.quantity')}
                </p>
                <p className="text-lg font-semibold">
                  {item.quantity} {item.unit}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">
                  {t('stock.detail.estimatedValue')}
                </p>
                <p className="text-lg font-semibold">
                  ₹{item.estimatedValue.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">
                  {t('stock.detail.storageLocation')}
                </p>
                <p className="text-lg font-semibold">
                  {item.storageLocation || t('stock.detail.notProvided')}
                </p>
              </div>
            </div>
          </Grid>
          <Grid item xs={12} sm={6}>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-text-secondary">
                  {t('stock.detail.vulnerabilityScore')}
                </p>
                <RiskBadge
                  level={vulnerabilityLevel as any}
                  size="md"
                  showLabel
                />
              </div>
              <div>
                <p className="text-sm text-text-secondary mb-2">
                  {t('stock.detail.sensitivities')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {item.sensitivities.map(sensitivity => (
                    <SensitivityTag
                      key={sensitivity}
                      type={sensitivity as any}
                      size="md"
                      showIcon
                    />
                  ))}
                </div>
              </div>
              {item.expiryDate && (
                <div>
                  <p className="text-sm text-text-secondary">
                    {t('stock.detail.expiryDate')}
                  </p>
                  <p className="text-lg font-semibold">{item.expiryDate}</p>
                </div>
              )}
            </div>
          </Grid>
        </Grid>
      </SectionCard>

      {/* Section 3.8: AI Storage Recommendations */}
      <SectionCard
        title={t('stock.detail.recommendations.title')}
        icon={Sparkles}
      >
        <div className="space-y-3">
          {recommendations.map((rec, index) => (
            <TimelineStep
              key={rec.id}
              stepNumber={index + 1}
              title={rec.title}
              description=""
              isCompleted={false}
            />
          ))}
        </div>
      </SectionCard>

      {/* Section 3.9: Disaster Impact Simulation */}
      <SectionCard title={t('stock.detail.disasterImpact.title')}>
        <DisasterImpactSimulation scenarios={disasterScenarios} />
      </SectionCard>
    </div>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    return (
      <div className="p-4 sm:p-6">
        <ErrorCard
          title={`Error ${error.status}`}
          message={error.statusText || 'An unexpected error occurred'}
        />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <ErrorCard
        title="Error"
        message="An unexpected error occurred. Please try again."
      />
    </div>
  )
}
