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
  RiskBadge,
  ErrorCard,
} from '~/components/shared'
import { Button } from '~/components/ui/button'
import { Progress } from '~/components/ui/progress'
import { useTranslation } from '~/hooks/useTranslation'
import { BarChart, Bar, RadarChart, Radar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts'
import { RefreshCw, TrendingUp, MapPin, Sparkles } from 'lucide-react'
import { format } from 'date-fns'

interface RiskSuggestionItem {
  id: string
  title: string
  description: string
  impactScore: number
  isActioned: boolean
}

interface RiskProfileLoaderData {
  userId: string
  shopId: string
  riskProfile: {
    id: string
    overallScore: number
    floodScore: number
    powerScore: number
    stockScore: number
    locationScore: number
    accessScore: number
    lastComputedAt: string
    percentileBetterThan: number
  }
  suggestions: RiskSuggestionItem[]
  floodIncidents: Array<{
    date: string
    count: number
  }>
}

export const meta: MetaFunction = () => [
  { title: 'Risk Profile | DisasterShield' },
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

    const locationProfile = await db.locationProfile.findUnique({
      where: { shopProfileId: shopProfile.id },
    })

    if (!locationProfile) {
      throw new Response('Location profile not found', { status: 404 })
    }

    const riskProfile = await db.riskProfile.findUnique({
      where: { shopProfileId: shopProfile.id },
      include: {
        suggestions: {
          orderBy: { impactScore: 'desc' },
        },
      },
    })

    if (!riskProfile) {
      throw new Response('Risk profile not found', { status: 404 })
    }

    // Fetch all risk profiles for the region to calculate percentile
    const regionCode = `${locationProfile.district}_${locationProfile.taluka}`
    const allRegionRisks = await db.riskProfile.findMany({
      where: {
        shopProfile: {
          locationProfile: {
            district: locationProfile.district,
            taluka: locationProfile.taluka,
          },
        },
      },
      select: {
        overallScore: true,
      },
    })

    const betterThanCount = allRegionRisks.filter(
      r => r.overallScore < riskProfile.overallScore
    ).length
    const percentileBetterThan =
      allRegionRisks.length > 0
        ? Math.round((betterThanCount / allRegionRisks.length) * 100)
        : 0

    // Fetch flood incidents for the last 12 months
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const floodIncidents = await db.trendDataPoint.findMany({
      where: {
        regionCode,
        trendType: 'flood_incident',
        recordedAt: { gte: twelveMonthsAgo },
      },
      orderBy: { recordedAt: 'asc' },
    })

    const loaderData: RiskProfileLoaderData = {
      userId: user.id,
      shopId: shopProfile.id,
      riskProfile: {
        id: riskProfile.id,
        overallScore: riskProfile.overallScore,
        floodScore: riskProfile.floodScore,
        powerScore: riskProfile.powerScore,
        stockScore: riskProfile.stockScore,
        locationScore: riskProfile.locationScore,
        accessScore: riskProfile.accessScore,
        lastComputedAt: riskProfile.lastComputedAt.toISOString(),
        percentileBetterThan,
      },
      suggestions: riskProfile.suggestions.map(s => ({
        id: s.id,
        title: s.title,
        description: s.description,
        impactScore: s.impactScore,
        isActioned: s.isActioned,
      })),
      floodIncidents: floodIncidents.map(fi => ({
        date: format(fi.recordedAt, 'MMM'),
        count: fi.value,
      })),
    }

    return json(loaderData)
  } catch (error) {
    console.error('Risk profile loader error:', error)
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

    if (intent === 'action-suggestion') {
      const suggestionId = formData.get('suggestionId') as string

      const suggestion = await db.riskSuggestion.findUnique({
        where: { id: suggestionId },
      })

      if (!suggestion || suggestion.riskProfileId !== params.userId) {
        return json({ error: 'Suggestion not found' }, { status: 404 })
      }

      await db.riskSuggestion.update({
        where: { id: suggestionId },
        data: { isActioned: true },
      })

      // Trigger risk score recomputation
      try {
        await apiClient.post('/risk/score', {
          userId: user.id,
          shopProfileId: shopProfile.id,
        })
      } catch (err) {
        console.error('Risk score recomputation failed:', err)
        // Continue even if API call fails
      }

      return json({ success: true })
    }

    if (intent === 'recalculate') {
      // Call Python backend to recalculate risk
      try {
        const response = await apiClient.post('/risk/score', {
          userId: user.id,
          shopProfileId: shopProfile.id,
        })

        // Update risk profile in database with new scores
        await db.riskProfile.update({
          where: { shopProfileId: shopProfile.id },
          data: {
            overallScore: response.overallScore || 0,
            floodScore: response.floodScore || 0,
            powerScore: response.powerScore || 0,
            stockScore: response.stockScore || 0,
            locationScore: response.locationScore || 0,
            accessScore: response.accessScore || 0,
            lastComputedAt: new Date(),
          },
        })

        return json({ success: true, message: 'Risk profile recalculated' })
      } catch (error) {
        console.error('Risk recalculation error:', error)
        return json(
          { error: 'Failed to recalculate risk profile' },
          { status: 500 }
        )
      }
    }

    return json({ error: 'Unknown intent' }, { status: 400 })
  } catch (error) {
    console.error('Risk action error:', error)
    return json({ error: 'Action failed' }, { status: 500 })
  }
}

export default function RiskProfilePage() {
  const data = useLoaderData<RiskProfileLoaderData>()
  const t = useTranslation()
  const fetcher = useFetcher()
  const [selectedDisaster, setSelectedDisaster] = useState<string>('flood')

  const riskCategories = [
    { name: 'Flood', icon: '🌊', score: data.riskProfile.floodScore },
    { name: 'Power', icon: '⚡', score: data.riskProfile.powerScore },
    { name: 'Stock', icon: '📦', score: data.riskProfile.stockScore },
    { name: 'Location', icon: '📍', score: data.riskProfile.locationScore },
    { name: 'Access', icon: '🚪', score: data.riskProfile.accessScore },
  ]

  const getRiskLevel = (score: number): { label: 'safe' | 'moderate' | 'high' | 'critical'; variant: string } => {
    if (score < 25) return { label: 'safe', variant: 'success' }
    if (score < 50) return { label: 'moderate', variant: 'warning' }
    if (score < 75) return { label: 'high', variant: 'warning' }
    return { label: 'critical', variant: 'danger' }
  }

  const riskLevel = getRiskLevel(data.riskProfile.overallScore)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Risk Profile"
        subtitle="Understand and reduce your business risk"
        action={
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="recalculate" />
            <Button
              type="submit"
              variant="outline"
              disabled={fetcher.state === 'submitting'}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {fetcher.state === 'submitting' ? 'Recalculating...' : 'Recalculate'}
            </Button>
          </fetcher.Form>
        }
      />

      <div className="text-xs text-muted-foreground">
        Last computed: {format(new Date(data.riskProfile.lastComputedAt), 'PPP p')}
      </div>

      {/* Overall Risk Score */}
      <SectionCard>
        <div className="flex flex-col items-center justify-center py-8">
          <div className="relative h-40 w-40">
            <svg className="h-full w-full transform -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-muted"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray={`${(data.riskProfile.overallScore / 100) * 440} 440`}
                className={`text-${
                  riskLevel.variant === 'danger'
                    ? 'red'
                    : riskLevel.variant === 'warning'
                      ? 'amber'
                      : 'green'
                }-500 transition-all duration-300`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-4xl font-bold">
                {Math.round(data.riskProfile.overallScore)}
              </div>
              <div className="text-xs text-muted-foreground">/100</div>
            </div>
          </div>
          <div className="mt-6 text-center">
            <RiskBadge level={riskLevel.label} />
            <p className="mt-2 text-sm text-muted-foreground">
              Better than {data.riskProfile.percentileBetterThan}% of shops in your
              area
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Risk Category Breakdown */}
      <SectionCard title="Risk Breakdown">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={riskCategories}>
                <PolarGrid />
                <PolarAngleAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar
                  name="Risk Score"
                  dataKey="score"
                  stroke="currentColor"
                  fill="currentColor"
                  fillOpacity={0.6}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-4">
            {riskCategories.map(category => (
              <div key={category.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{category.icon}</span>
                    <span className="font-medium">{category.name}</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {category.score}/100
                  </span>
                </div>
                <Progress value={category.score} className="h-2" />
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Risk Suggestions */}
      <SectionCard title="How to Improve Your Score">
        <div className="space-y-4">
          {data.suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No improvement suggestions available at this time.
            </p>
          ) : (
            data.suggestions.map(suggestion => (
              <div
                key={suggestion.id}
                className={`rounded-lg border p-4 transition-all ${
                  suggestion.isActioned
                    ? 'border-green-200 bg-green-50'
                    : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-semibold">{suggestion.title}</h4>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {suggestion.description}
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-sm font-medium text-green-600">
                      <TrendingUp className="h-4 w-4" />
                      +{suggestion.impactScore} points if actioned
                    </div>
                  </div>
                  {!suggestion.isActioned && (
                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="action-suggestion" />
                      <input type="hidden" name="suggestionId" value={suggestion.id} />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={fetcher.state === 'submitting'}
                      >
                        Mark Actioned
                      </Button>
                    </fetcher.Form>
                  )}
                  {suggestion.isActioned && (
                    <div className="text-green-600">
                      <div className="rounded-full bg-green-100 p-2">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      {/* Location Risk Map */}
      <SectionCard title="Your Location Risk">
        <div className="rounded-lg bg-muted p-8 text-center">
          <MapPin className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            Leaflet map integration — shows shop location, flood zones, and nearest LRDB office
          </p>
        </div>
      </SectionCard>

      {/* Historical Risk Trend */}
      <SectionCard title="Risk Score Over Time">
        <div className="rounded-lg bg-muted p-8 text-center">
          <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            Risk history tracking starts today. Monthly snapshots will appear here.
          </p>
        </div>
      </SectionCard>
    </div>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()
  return <ErrorCard error={error} />
}
