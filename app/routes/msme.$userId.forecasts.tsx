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

interface StockItemReport {
  name: string
  category: string
  quantity: number
  unit: string
  estimatedValueInr: number
  storageLocation: string | null
  expiryDate: string | null
  vulnerabilityScore: number
  disasterSensitivities: string[]
  notes: string | null
}

interface ForecastsLoaderData {
  userId: string
  shopId: string
  shopName: string
  scenarios: ForecastScenarioData[]
  worstCaseLoss: number
  mostLikelyScenario: string
  avgRecoveryTime: number
  insuranceReadinessScore: number
  hasDocumentedInventory: boolean
  hasBcpPlan: boolean
  actionedSuggestions: number
  stockItems: StockItemReport[]
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
        include: { sensitivities: true },
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
      shopName: shopProfile.shopName,
      scenarios,
      worstCaseLoss,
      mostLikelyScenario,
      avgRecoveryTime,
      insuranceReadinessScore: Math.min(insuranceReadinessScore, 100),
      hasDocumentedInventory,
      hasBcpPlan,
      actionedSuggestions,
      stockItems: stockItems.map(item => ({
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        estimatedValueInr: item.estimatedValueInr,
        storageLocation: item.storageLocation,
        expiryDate: item.expiryDate ? item.expiryDate.toISOString() : null,
        vulnerabilityScore: item.vulnerabilityScore,
        disasterSensitivities: item.sensitivities.map(s => s.type),
        notes: item.notes,
      })),
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

// ─── Prevention catalog ───────────────────────────────────────────────────────
const PREVENTION_CATALOG: Record<string, Array<{
  label: string
  description: string
  allocation: number
}>> = {
  FLOOD: [
    { label: 'Waterproofing & Sealing', description: 'Seal doors, windows, and entry points against water ingress', allocation: 0.35 },
    { label: 'Elevated Storage Racks', description: 'Raise shelves and stock above the expected flood waterline', allocation: 0.30 },
    { label: 'Drainage Pump & Sump', description: 'Submersible pump with automatic float switch for rapid draining', allocation: 0.25 },
    { label: 'Emergency Supplies', description: 'Sandbags, waterproof covers, and tarpaulins for rapid response', allocation: 0.10 },
  ],
  POWER_OUTAGE: [
    { label: 'Generator / Inverter', description: 'Diesel or LPG generator to run critical equipment during cuts', allocation: 0.50 },
    { label: 'UPS Systems', description: 'Protect computers, POS terminals, and refrigeration on outage', allocation: 0.25 },
    { label: 'LED Emergency Lighting', description: 'Keep the shop safe and operational when grid power fails', allocation: 0.15 },
    { label: 'Fuel & Battery Reserve', description: 'Stockpile adequate fuel or battery banks for extended outages', allocation: 0.10 },
  ],
  WINDSTORM: [
    { label: 'Roof Reinforcement', description: 'Secure roofing sheets, ridges, and joints with storm clips', allocation: 0.40 },
    { label: 'Window & Door Protection', description: 'Storm shutters or impact-resistant glass to prevent breach', allocation: 0.30 },
    { label: 'Signage & Fixture Anchoring', description: 'Bolt down boards, AC units, and all outdoor fixtures', allocation: 0.20 },
    { label: 'Emergency Tarps & Fasteners', description: 'Heavy-duty cover for rapid deployment after a roof breach', allocation: 0.10 },
  ],
  EARTHQUAKE: [
    { label: 'Shelf & Rack Anchoring', description: 'Bolt heavy shelves and storage racks to walls and floor', allocation: 0.35 },
    { label: 'Structural Safety Audit', description: 'Certified inspection of load-bearing walls and foundations', allocation: 0.30 },
    { label: 'Gas Line Auto-Shutoff', description: 'Install automatic seismic gas shutoff valves', allocation: 0.20 },
    { label: 'Emergency Kit & Water', description: 'First aid, water reserve, and food supply for 72 hours', allocation: 0.15 },
  ],
  DEFAULT: [
    { label: 'Emergency Stock Buffer', description: 'Extra inventory of critical items to prevent stockouts post-disaster', allocation: 0.35 },
    { label: 'Business Insurance Coverage', description: 'Comprehensive disaster insurance for shop premises and stock', allocation: 0.30 },
    { label: 'Fire Safety Equipment', description: 'Fire extinguishers, smoke detectors, and sprinkler systems', allocation: 0.20 },
    { label: 'Staff Emergency Training', description: 'Disaster response drills and evacuation protocol training', allocation: 0.15 },
  ],
}

function getDisasterCategory(type: string): string {
  const t = type.toUpperCase()
  if (t.includes('FLOOD') || t.includes('WATER')) return 'FLOOD'
  if (t.includes('POWER') || t.includes('OUTAGE')) return 'POWER_OUTAGE'
  if (t.includes('WIND') || t.includes('STORM') || t.includes('CYCLONE')) return 'WINDSTORM'
  if (t.includes('EARTH') || t.includes('QUAKE')) return 'EARTHQUAKE'
  return 'DEFAULT'
}

function formatDisasterType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
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

  function downloadInventoryReport() {
    const headers = [
      'Item Name', 'Category', 'Quantity', 'Unit', 'Value (INR)',
      'Storage Location', 'Expiry Date', 'Vulnerability Score (0–100)',
      'Disaster Sensitivities', 'Notes',
    ]
    const rows = data.stockItems.map(item => [
      item.name,
      item.category,
      item.quantity.toString(),
      item.unit,
      item.estimatedValueInr.toString(),
      item.storageLocation ?? '',
      item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('en-IN') : '',
      item.vulnerabilityScore.toString(),
      item.disasterSensitivities.join('; '),
      item.notes ?? '',
    ])

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.shopName.replace(/\s+/g, '-')}-inventory-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const chartData = data.scenarios.map(s => ({
    name: s.disasterType,
    loss: s.estimatedLossInr,
    probability: s.probability,
  }))

  const totalLoss = data.scenarios.reduce((sum, s) => sum + s.estimatedLossInr, 0)
  const estimatedSavings = totalLoss > 0
    ? Math.min(Math.round(investmentAmount * 3), Math.round(totalLoss * 0.78))
    : 0
  const roi = investmentAmount > 0 ? Math.round((estimatedSavings / investmentAmount) * 100) : 0

  const topScenario = data.scenarios.length > 0
    ? data.scenarios.reduce((best, s) => s.estimatedLossInr > best.estimatedLossInr ? s : best, data.scenarios[0])
    : null
  const preventionCategory = topScenario ? getDisasterCategory(topScenario.disasterType) : 'DEFAULT'
  const preventionMeasures = PREVENTION_CATALOG[preventionCategory] ?? PREVENTION_CATALOG.DEFAULT

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

          <Button
            className="w-full"
            variant="outline"
            onClick={downloadInventoryReport}
            disabled={data.stockItems.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            {data.stockItems.length === 0 ? 'No Inventory to Download' : 'Download Inventory Report'}
          </Button>
        </div>
      </SectionCard>

      {/* Prevention vs Loss Calculator */}
      <SectionCard title="Prevention vs Loss Calculator">
        <p className="mb-5 text-sm text-muted-foreground">
          Drag the slider to set a prevention budget. The left panel shows exactly what to spend it on; the right panel shows how each disaster's projected loss shrinks as a result.
        </p>

        {/* ── Slider ─────────────────────────────────────────────────────── */}
        <div className="mb-6 rounded-xl border border-border-default bg-surface-secondary p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">Prevention Budget</span>
            <span className="text-xl font-bold text-brand-primary">
              ₹{investmentAmount.toLocaleString('en-IN')}
            </span>
          </div>
          <Slider
            value={[investmentAmount]}
            onValueChange={(value) => setInvestmentAmount(value[0])}
            min={0}
            max={50000}
            step={500}
            className="w-full"
          />
          <div className="mt-1 flex justify-between">
            <span className="text-xs text-muted-foreground">₹0</span>
            <span className="text-xs text-muted-foreground">₹50,000</span>
          </div>
        </div>

        {/* ── Two-column body ─────────────────────────────────────────────── */}
        <div className="grid gap-6 md:grid-cols-2">

          {/* LEFT: WHAT to invest in */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-brand-primary" />
              <h4 className="text-sm font-semibold text-text-primary">What to invest in</h4>
              {topScenario && (
                <span className="ml-auto rounded-full bg-surface-tertiary px-2 py-0.5 text-xs text-text-secondary">
                  Based on {formatDisasterType(topScenario.disasterType)} risk
                </span>
              )}
            </div>

            <div className="space-y-2">
              {preventionMeasures.map((measure, i) => {
                const cost = Math.round(investmentAmount * measure.allocation)
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-lg border border-border-default bg-surface-primary p-3"
                  >
                    {/* Step number */}
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{measure.label}</p>
                        <span className="shrink-0 text-sm font-bold text-brand-primary">
                          {investmentAmount > 0 ? `₹${cost.toLocaleString('en-IN')}` : '—'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                        {measure.description}
                      </p>
                      {/* allocation bar */}
                      <div className="mt-2 flex items-center gap-1.5">
                        <div className="h-1 flex-1 rounded-full bg-muted">
                          <div
                            className="h-1 rounded-full bg-brand-primary/50"
                            style={{ width: `${measure.allocation * 100}%` }}
                          />
                        </div>
                        <span className="w-7 text-right text-xs text-muted-foreground">
                          {Math.round(measure.allocation * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* RIGHT: HOW loss is reduced */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <h4 className="text-sm font-semibold text-text-primary">How it reduces loss</h4>
            </div>

            {data.scenarios.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border-default py-8 text-sm text-muted-foreground">
                Generate forecasts first to see loss projections
              </div>
            ) : (
              <div className="space-y-3">
                {[...data.scenarios]
                  .sort((a, b) => b.estimatedLossInr - a.estimatedLossInr)
                  .map((scenario) => {
                    const scenarioSavings = totalLoss > 0
                      ? Math.round(estimatedSavings * (scenario.estimatedLossInr / totalLoss))
                      : 0
                    const reducedLoss = Math.max(scenario.estimatedLossInr - scenarioSavings, 0)
                    const reductionPct = scenario.estimatedLossInr > 0
                      ? Math.round((scenarioSavings / scenario.estimatedLossInr) * 100)
                      : 0
                    const afterWidth = scenario.estimatedLossInr > 0
                      ? Math.max((reducedLoss / scenario.estimatedLossInr) * 100, 4)
                      : 0

                    return (
                      <div
                        key={scenario.id}
                        className="rounded-lg border border-border-default p-3"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {formatDisasterType(scenario.disasterType)}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getProbabilityColor(scenario.probability)}`}>
                            {scenario.probability} risk
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {/* Before bar */}
                          <div className="flex items-center gap-2">
                            <span className="w-10 shrink-0 text-xs text-muted-foreground">Before</span>
                            <div className="flex-1 overflow-hidden rounded-full bg-red-100">
                              <div className="h-2 w-full rounded-full bg-red-400" />
                            </div>
                            <span className="w-14 shrink-0 text-right text-xs font-semibold text-red-700">
                              ₹{(scenario.estimatedLossInr / 1000).toFixed(0)}K
                            </span>
                          </div>
                          {/* After bar */}
                          <div className="flex items-center gap-2">
                            <span className="w-10 shrink-0 text-xs text-muted-foreground">After</span>
                            <div className="flex-1 overflow-hidden rounded-full bg-green-100">
                              <div
                                className="h-2 rounded-full bg-green-500 transition-all duration-300"
                                style={{ width: `${afterWidth}%` }}
                              />
                            </div>
                            <span className="w-14 shrink-0 text-right text-xs font-semibold text-green-700">
                              ₹{(reducedLoss / 1000).toFixed(0)}K
                            </span>
                          </div>
                        </div>

                        {reductionPct > 0 && (
                          <p className="mt-1.5 text-xs font-medium text-green-700">
                            ↓ {reductionPct}% reduction — saves ₹{(scenarioSavings / 1000).toFixed(0)}K
                          </p>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </div>

        {/* ── Summary row ─────────────────────────────────────────────────── */}
        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border-default pt-5">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">You Invest</p>
            <p className="mt-0.5 text-lg font-bold text-text-primary">
              ₹{investmentAmount.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Losses Avoided</p>
            <p className="mt-0.5 text-lg font-bold text-green-600">
              ₹{estimatedSavings.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Return on Investment</p>
            <p className="mt-0.5 text-lg font-bold text-brand-primary">
              {investmentAmount > 0 ? `${roi}%` : '—'}
            </p>
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
