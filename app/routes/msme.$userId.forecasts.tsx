import {
  json,
  type LoaderFunction,
  type ActionFunction,
  type MetaFunction,
} from '@remix-run/node'
import {
  useLoaderData,
  isRouteErrorResponse,
  useRouteError,
  useFetcher,
} from '@remix-run/react'
import { useState } from 'react'
import { requireAuthenticatedUser } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import { apiClient } from '~/lib/api.server'
import {
  PageHeader,
  SectionCard,
  ErrorCard,
} from '~/components/shared'
import { Button } from '~/components/ui/button'
import { Progress } from '~/components/ui/progress'
import { Slider } from '~/components/ui/slider'
import { useTranslation } from '~/hooks/useTranslation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { RefreshCw, TrendingDown, FileText, Download, Share2, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'

interface ForecastScenarioData {
  id: string
  disasterType: string
  probability: 'low' | 'medium' | 'high'
  estimatedLossInr: number
  recoveryTimelineDays: number
  affectedItems: Array<{
    itemName: string
    estimatedDamage: number
  }>
  narrative: string
}

interface ForecastsLoaderData {
  userId: string
  shopId: string
  scenarios: ForecastScenarioData[]
  worstCaseLoss: number
  mostLikelyScenario: string
  avgRecoveryTime: number
  insuranceReadinessScore: number
  hasDocumentedInventory: boolean
  hasBcpPlan: boolean
  actionedSuggestions: number
}

export const meta: MetaFunction = () => [
  { title: 'Estimates & Forecasts | DisasterShield' },
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

    const [forecastScenarios, bcpPlan, riskProfile, stockItems] = await Promise.all([
      db.forecastScenario.findMany({
        where: { shopProfileId: shopProfile.id },
        include: {
          affectedItems: true,
        },
      }),
      db.bCPPlan.findUnique({
        where: { shopProfileId: shopProfile.id },
      }),
      db.riskProfile.findUnique({
        where: { shopProfileId: shopProfile.id },
      }),
      db.stockItem.findMany({
        where: { shopProfileId: shopProfile.id },
      }),
    ])

    const scenarios = forecastScenarios.map(fs => ({
      id: fs.id,
      disasterType: fs.disasterType,
      probability: fs.probability.toLowerCase() as 'low' | 'medium' | 'high',
      estimatedLossInr: fs.estimatedLossInr,
      recoveryTimelineDays: fs.recoveryTimelineDays,
      affectedItems: fs.affectedItems.map(ai => ({
        itemName: ai.stockItemName,
        estimatedDamage: ai.estimatedDamageInr,
      })),
      narrative: fs.aiNarrative || 'Impact analysis generated from risk model.',
    }))

    const worstCaseLoss = Math.max(...scenarios.map(s => s.estimatedLossInr), 0)
    const mostLikelyScenario =
      scenarios.find(s => s.probability === 'high')?.disasterType || 'Unknown'
    const avgRecoveryTime =
      scenarios.length > 0
        ? Math.round(
            scenarios.reduce((sum, s) => sum + s.recoveryTimelineDays, 0) /
              scenarios.length
          )
        : 0

    const actionedSuggestions = riskProfile
      ? await db.riskSuggestion.count({
          where: {
            riskProfileId: riskProfile.id,
            isActioned: true,
          },
        })
      : 0

    // Calculate insurance readiness score
    const hasDocumentedInventory = stockItems.length > 0
    const hasBcpPlan = !!bcpPlan
    const suggestionScore =
      actionedSuggestions > 5 ? 30 : Math.round((actionedSuggestions / 5) * 30)
    const insuranceReadinessScore = (hasDocumentedInventory ? 35 : 0) +
      (hasBcpPlan ? 35 : 0) +
      suggestionScore

    const loaderData: ForecastsLoaderData = {
      userId: user.id,
      shopId: shopProfile.id,
      scenarios,
      worstCaseLoss,
      mostLikelyScenario,
      avgRecoveryTime,
      insuranceReadinessScore: Math.min(insuranceReadinessScore, 100),
      hasDocumentedInventory,
      hasBcpPlan,
      actionedSuggestions,
    }

    return json(loaderData)
  } catch (error) {
    console.error('Forecasts loader error:', error)
    throw error
  }
}

export const action: ActionFunction = async ({ request, params }) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 })
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

    const formData = await request.formData()
    const intent = formData.get('intent') as string

    if (intent === 'refresh-forecasts') {
      try {
        // Delete existing forecast scenarios
        await db.forecastScenario.deleteMany({
          where: { shopProfileId: shopProfile.id },
        })

        // Call Python backend to regenerate forecasts
        const response = await apiClient.post('/forecasts/estimate', {
          userId: user.id,
          shopProfileId: shopProfile.id,
        })

        // Create new forecast scenarios from response
        if (response.scenarios && Array.isArray(response.scenarios)) {
          for (const scenario of response.scenarios) {
            await db.forecastScenario.create({
              data: {
                shopProfileId: shopProfile.id,
                disasterType: scenario.disasterType,
                probability: scenario.probability.toUpperCase(),
                estimatedLossInr: scenario.estimatedLossInr,
                recoveryTimelineDays: scenario.recoveryTimelineDays,
                aiNarrative: scenario.narrative,
                affectedItemCount: 0,
                estimatedDowntimeDays: scenario.recoveryTimelineDays,
              },
            })
          }
        }

        return json({ success: true, message: 'Forecasts refreshed successfully' })
      } catch (error) {
        console.error('Forecast refresh error:', error)
        return json(
          { error: 'Failed to refresh forecasts' },
          { status: 500 }
        )
      }
    }

    return json({ error: 'Unknown intent' }, { status: 400 })
  } catch (error) {
    console.error('Forecasts action error:', error)
    return json({ error: 'Action failed' }, { status: 500 })
  }
}

export default function ForecastsPage() {
  const data = useLoaderData<ForecastsLoaderData>()
  const t = useTranslation()
  const fetcher = useFetcher()
  const [investmentAmount, setInvestmentAmount] = useState(5000)
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null)

  const getProbabilityColor = (probability: string) => {
    switch (probability) {
      case 'high':
        return 'bg-red-100 text-red-900'
      case 'medium':
        return 'bg-amber-100 text-amber-900'
      case 'low':
        return 'bg-green-100 text-green-900'
      default:
        return 'bg-gray-100 text-gray-900'
    }
  }

  const chartData = data.scenarios.map(s => ({
    name: s.disasterType,
    loss: s.estimatedLossInr,
    probability: s.probability,
  }))

  const savingsPercentage = Math.min((investmentAmount / data.worstCaseLoss) * 100, 100)
  const estimatedSavings = Math.round(
    (savingsPercentage / 100) * data.worstCaseLoss * 0.4
  )

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Estimates & Forecasts"
        subtitle="Financial impact of potential disasters on your business"
        action={
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="refresh-forecasts" />
            <Button
              type="submit"
              variant="outline"
              disabled={fetcher.state === 'submitting'}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {fetcher.state === 'submitting' ? 'Refreshing...' : 'Refresh Forecasts'}
            </Button>
          </fetcher.Form>
        }
      />

      {/* Summary Tiles */}
      <div className="grid gap-4 md:grid-cols-3">
        <SectionCard>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Worst Case Loss</p>
            <p className="text-2xl font-bold">
              ₹{(data.worstCaseLoss / 100000).toFixed(1)}L
            </p>
          </div>
        </SectionCard>
        <SectionCard>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Most Likely Scenario</p>
            <p className="text-2xl font-bold">{data.mostLikelyScenario}</p>
          </div>
        </SectionCard>
        <SectionCard>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Avg Recovery Time</p>
            <p className="text-2xl font-bold">{data.avgRecoveryTime} days</p>
          </div>
        </SectionCard>
      </div>

      {/* Total Loss Projection Chart */}
      <SectionCard title="Potential Loss by Disaster Type">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip
                formatter={(value: any) => `₹${(value / 100000).toFixed(1)}L`}
              />
              <Bar
                dataKey="loss"
                fill="hsl(var(--primary))"
                name="Estimated Loss"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* Scenario Cards */}
      <SectionCard title="Detailed Scenarios">
        <div className="space-y-3">
          {data.scenarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No forecast scenarios available. Run a full forecast to generate scenarios.
            </p>
          ) : (
            data.scenarios.map(scenario => (
              <div
                key={scenario.id}
                className="rounded-lg border p-4 transition-all"
              >
                <button
                  onClick={() =>
                    setExpandedScenario(
                      expandedScenario === scenario.id ? null : scenario.id
                    )
                  }
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{scenario.disasterType}</h4>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getProbabilityColor(
                            scenario.probability
                          )}`}
                        >
                          {scenario.probability.charAt(0).toUpperCase() +
                            scenario.probability.slice(1)}{' '}
                          Probability
                        </span>
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-3">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Estimated Loss
                          </p>
                          <p className="font-semibold">
                            ₹{(scenario.estimatedLossInr / 100000).toFixed(1)}L
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Recovery Time
                          </p>
                          <p className="font-semibold">
                            {scenario.recoveryTimelineDays} days
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Affected Items
                          </p>
                          <p className="font-semibold">
                            {scenario.affectedItems.length} items
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-muted-foreground">
                      {expandedScenario === scenario.id ? '−' : '+'}
                    </div>
                  </div>
                </button>

                {expandedScenario === scenario.id && (
                  <div className="mt-4 space-y-3 border-t pt-4">
                    <div>
                      <p className="mb-2 text-sm font-semibold">Top Affected Items:</p>
                      <div className="space-y-1 text-sm">
                        {scenario.affectedItems.slice(0, 3).map((item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between rounded bg-muted p-2"
                          >
                            <span>{item.itemName}</span>
                            <span className="font-semibold">
                              ₹{(item.estimatedDamage / 1000).toFixed(0)}K
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-semibold">Impact Analysis:</p>
                      <p className="text-sm text-muted-foreground">
                        {scenario.narrative}
                      </p>
                    </div>
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                      <p className="text-xs font-semibold text-green-900">
                        💡 Preventive Savings
                      </p>
                      <p className="mt-1 text-sm text-green-800">
                        Taking our recommended actions could reduce this loss by up to
                        40%
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </SectionCard>

      {/* Insurance Readiness */}
      <SectionCard title="Insurance Readiness">
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Insurance Readiness Score</p>
              <p className="text-lg font-bold">
                {data.insuranceReadinessScore}/100
              </p>
            </div>
            <Progress
              value={data.insuranceReadinessScore}
              className="h-3"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-2">
              {data.hasDocumentedInventory ? (
                <CheckCircle2 className="mt-1 h-4 w-4 text-green-600" />
              ) : (
                <div className="mt-1 h-4 w-4 rounded-full bg-gray-300" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {data.hasDocumentedInventory
                    ? '✓ Documented Inventory'
                    : 'Documented Inventory'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.hasDocumentedInventory
                    ? 'You have documented your stock items'
                    : 'Add stock items to document your inventory'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              {data.hasBcpPlan ? (
                <CheckCircle2 className="mt-1 h-4 w-4 text-green-600" />
              ) : (
                <div className="mt-1 h-4 w-4 rounded-full bg-gray-300" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {data.hasBcpPlan ? '✓ Business Continuity Plan' : 'Business Continuity Plan'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.hasBcpPlan
                    ? 'You have a generated BCP'
                    : 'Generate a BCP in the Safety Plan section'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              {data.actionedSuggestions > 0 ? (
                <CheckCircle2 className="mt-1 h-4 w-4 text-green-600" />
              ) : (
                <div className="mt-1 h-4 w-4 rounded-full bg-gray-300" />
              )}
              <div>
                <p className="text-sm font-medium">
                  Risk Improvements ({data.actionedSuggestions}/5)
                </p>
                <p className="text-xs text-muted-foreground">
                  Action risk suggestions to improve your insurance readiness
                </p>
              </div>
            </div>
          </div>

          <Button className="w-full" variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download Inventory Report
          </Button>
        </div>
      </SectionCard>

      {/* Prevention Investment Calculator */}
      <SectionCard title="Prevention vs Loss Calculator">
        <div className="space-y-4">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <label className="text-sm font-medium">
                Investment Amount: ₹{investmentAmount.toLocaleString()}
              </label>
              <span className="text-xs text-muted-foreground">₹0 – ₹50,000</span>
            </div>
            <Slider
              value={[investmentAmount]}
              onValueChange={(value) => setInvestmentAmount(value[0])}
              min={0}
              max={50000}
              step={500}
              className="w-full"
            />
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-900">
              <span className="font-semibold">Potential Savings:</span> Investing₹
              {investmentAmount.toLocaleString()} in prevention could save up to ₹
              {estimatedSavings.toLocaleString()} in flood damage
            </p>
          </div>

          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Worst Case Loss:</span>
              <span className="font-semibold">
                ₹{data.worstCaseLoss.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between rounded bg-muted p-2">
              <span className="text-muted-foreground">Coverage After Investment:</span>
              <span className="font-semibold">
                ₹{(data.worstCaseLoss - estimatedSavings).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ROI:</span>
              <span className="font-semibold text-green-600">
                {savingsPercentage > 0
                  ? Math.round((estimatedSavings / investmentAmount) * 100)
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()
  return <ErrorCard error={error} />
}
