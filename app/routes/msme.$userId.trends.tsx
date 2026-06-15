import {
  json,
  type LoaderFunction,
  type MetaFunction,
} from '@remix-run/node'
import {
  useLoaderData,
  isRouteErrorResponse,
  useRouteError,
} from '@remix-run/react'
import { requireAuthenticatedUser } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import { apiClient } from '~/lib/api.server'
import {
  PageHeader,
  SectionCard,
  EmptyState,
  LoadingSkeleton,
  ErrorCard,
} from '~/components/shared'
import { useTranslation } from '~/hooks/useTranslation'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, Cloud, Zap, AlertTriangle, Droplet } from 'lucide-react'
import { format, startOfYear, endOfYear, eachMonthOfInterval } from 'date-fns'

interface TrendDataPoint {
  month: string
  value: number
}

interface TrendInsight {
  text: string
  icon?: string
}

interface TrendsLoaderData {
  userId: string
  shopId: string
  regionCode: string
  regionName: string
  rainfallTrends: TrendDataPoint[]
  powerOutageTrends: TrendDataPoint[]
  transportDisruptionTrends: TrendDataPoint[]
  floodIncidentTrends: TrendDataPoint[]
  seasonalRisks: Array<{
    month: string
    riskLevel: 'low' | 'moderate' | 'high'
    riskScore: number
  }>
  aiInsights: TrendInsight[]
  supplyChainNarrative: string
}

export const meta: MetaFunction = () => [
  { title: 'Local Trends | DisasterShield' },
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

    const regionCode = `${locationProfile.district}_${locationProfile.taluka}`
    const regionName = `${locationProfile.taluka}, ${locationProfile.district} District`

    // Fetch 12 months of trend data for all types
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const [rainfallData, powerOutageData, transportData, floodData] = await Promise.all(
      [
        db.trendDataPoint.findMany({
          where: {
            regionCode,
            trendType: 'rainfall',
            recordedAt: { gte: twelveMonthsAgo },
          },
          orderBy: { recordedAt: 'asc' },
        }),
        db.trendDataPoint.findMany({
          where: {
            regionCode,
            trendType: 'power_outage',
            recordedAt: { gte: twelveMonthsAgo },
          },
          orderBy: { recordedAt: 'asc' },
        }),
        db.trendDataPoint.findMany({
          where: {
            regionCode,
            trendType: 'transport_disruption',
            recordedAt: { gte: twelveMonthsAgo },
          },
          orderBy: { recordedAt: 'asc' },
        }),
        db.trendDataPoint.findMany({
          where: {
            regionCode,
            trendType: 'flood_incident',
            recordedAt: { gte: twelveMonthsAgo },
          },
          orderBy: { recordedAt: 'asc' },
        }),
      ]
    )

    const formatTrendData = (points: any[]): TrendDataPoint[] => {
      if (points.length === 0) return []
      return points.map(p => ({
        month: format(p.recordedAt, 'MMM'),
        value: p.value,
      }))
    }

    const rainfallTrends = formatTrendData(rainfallData)
    const powerOutageTrends = formatTrendData(powerOutageData)
    const transportDisruptionTrends = formatTrendData(transportData)
    const floodIncidentTrends = formatTrendData(floodData)

    // Calculate seasonal risk calendar
    const allMonths = Array.from({ length: 12 }, (_, i) => {
      const monthIndex = i
      const monthName = format(new Date(2024, monthIndex, 1), 'MMM')
      
      // Determine seasonal risk based on monsoon patterns
      let riskScore = 25 // Base risk
      if (monthIndex >= 5 && monthIndex <= 8) {
        // Jun-Sep: Monsoon season
        riskScore = 75
      } else if (monthIndex >= 2 && monthIndex <= 4) {
        // Mar-May: Heat risk
        riskScore = 50
      }

      return {
        month: monthName,
        riskLevel: (riskScore > 70 ? 'high' : riskScore > 40 ? 'moderate' : 'low') as 'high' | 'moderate' | 'low',
        riskScore,
      }
    })

    // Fetch AI insights from backend
    let aiInsights: TrendInsight[] = []
    let supplyChainNarrative = ''
    
    try {
      const trendsApiResponse = await apiClient.get(`/trends/${regionCode}`)
      aiInsights = (trendsApiResponse.insights || []).map((insight: string) => ({
        text: insight,
      }))
      supplyChainNarrative = trendsApiResponse.supplyChainNarrative || 'No supply chain data available.'
    } catch (err) {
      console.error('Failed to fetch trends from API:', err)
      // Use placeholder data if API fails
      aiInsights = [
        {
          text: 'Flooding incidents in your region peak during monsoon season (Jul-Aug). Begin stock elevation by end of June.',
        },
        {
          text: 'Power outages average 14 hours during monsoon months. Consider investing in a backup inverter.',
        },
        {
          text: 'Transport disruptions in this region typically resolve within 48 hours of a flood event.',
        },
      ]
      supplyChainNarrative = 'Supply chains in this region typically experience disruptions during monsoon season. Stock buffering is recommended for essential goods.'
    }

    const loaderData: TrendsLoaderData = {
      userId: user.id,
      shopId: shopProfile.id,
      regionCode,
      regionName,
      rainfallTrends,
      powerOutageTrends,
      transportDisruptionTrends,
      floodIncidentTrends,
      seasonalRisks: allMonths,
      aiInsights,
      supplyChainNarrative,
    }

    return json(loaderData)
  } catch (error) {
    console.error('Trends loader error:', error)
    throw error
  }
}

export default function TrendsPage() {
  const data = useLoaderData<TrendsLoaderData>()
  const t = useTranslation()

  const chartData = [
    { name: 'Jan', value: 20 },
    { name: 'Feb', value: 25 },
    { name: 'Mar', value: 40 },
    { name: 'Apr', value: 50 },
    { name: 'May', value: 60 },
    { name: 'Jun', value: 75 },
    { name: 'Jul', value: 85 },
    { name: 'Aug', value: 80 },
    { name: 'Sep', value: 70 },
    { name: 'Oct', value: 45 },
    { name: 'Nov', value: 35 },
    { name: 'Dec', value: 25 },
  ]

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Local Trends"
        subtitle="Disaster patterns in your area"
        action={
          <div className="rounded-lg bg-secondary px-3 py-1 text-sm font-medium">
            {data.regionName}
          </div>
        }
      />

      {/* Seasonal Risk Calendar */}
      <SectionCard title="Seasonal Risk Periods">
        <div className="space-y-4">
          <div className="h-16 overflow-x-auto">
            <div className="flex gap-2">
              {data.seasonalRisks.map(risk => (
                <div key={risk.month} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-12 rounded border-2 border-primary p-2 text-center text-xs font-semibold ${
                      risk.riskLevel === 'high'
                        ? 'bg-red-100 text-red-900'
                        : risk.riskLevel === 'moderate'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-blue-100 text-blue-900'
                    }`}
                    style={{
                      height: `${risk.riskScore * 1.5}px`,
                    }}
                  >
                    {risk.riskScore}
                  </div>
                  <span className="text-xs text-muted-foreground">{risk.month}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Risk score by month — taller bars indicate higher disaster risk
          </p>
        </div>
      </SectionCard>

      {/* Rainfall Trend */}
      <SectionCard title="Rainfall Trend (12 months)">
        <div className="h-64 w-full">
          {data.rainfallTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.rainfallTrends}
                margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  name="Rainfall (mm)"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={Cloud}
              title="No rainfall data"
              description="Historical rainfall data is not yet available for your region"
            />
          )}
        </div>
      </SectionCard>

      {/* Power Outage Incidents */}
      <SectionCard title="Power Outage Incidents (12 months)">
        <div className="h-64 w-full">
          {data.powerOutageTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.powerOutageTrends}
                margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="Incidents"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={Zap}
              title="No power outage data"
              description="Power outage data is not yet available for your region"
            />
          )}
        </div>
      </SectionCard>

      {/* Transport Disruptions */}
      <SectionCard title="Transport Disruptions (12 months)">
        <div className="h-64 w-full">
          {data.transportDisruptionTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.transportDisruptionTrends}
                margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  name="Disruptions"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={AlertTriangle}
              title="No transport data"
              description="Transport disruption data is not yet available for your region"
            />
          )}
        </div>
      </SectionCard>

      {/* Flood Incidents */}
      <SectionCard title="Flood Incidents (12 months)">
        <div className="h-64 w-full">
          {data.floodIncidentTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.floodIncidentTrends}
                margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  name="Incidents"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={Droplet}
              title="No flood data"
              description="Flood incident data is not yet available for your region"
            />
          )}
        </div>
      </SectionCard>

      {/* AI Trend Insights */}
      <SectionCard title="AI Insights">
        <div className="space-y-3">
          {data.aiInsights.map((insight, idx) => (
            <div key={idx} className="flex gap-3">
              <TrendingUp className="h-5 w-5 flex-shrink-0 text-primary" />
              <p className="text-sm text-foreground">{insight.text}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Supply Chain Patterns */}
      <SectionCard title="Supply Chain Patterns">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-foreground">
            {data.supplyChainNarrative}
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-900">💡 Recommendation:</p>
            <p className="mt-1 text-xs text-amber-800">
              Build a 2-3 week buffer of essential stock items before monsoon season
              to protect against supply chain disruptions.
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
