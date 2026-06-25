import { json, redirect, type LoaderFunction, type MetaFunction } from '@remix-run/node'
import { useLoaderData, isRouteErrorResponse, useRouteError } from '@remix-run/react'
import { requireAuthenticatedUser } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import { apiClient } from '~/lib/api.server'
import {
  PageHeader,
  SectionCard,
  StatTile,
  RiskBadge,
  AlertCard,
  SensitivityTag,
  EmptyState,
  LoadingSkeleton,
  StatusIndicator,
  TrendChip,
  ErrorCard,
} from '~/components/shared'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  RadarChart,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
} from 'recharts'
import {
  ShieldAlert,
  Package,
  Banknote,
  BellRing,
  Users,
  Siren,
  ClipboardList,
  Phone,
} from 'lucide-react'
import { useTranslation } from '~/hooks/useTranslation'
import { format } from 'date-fns'
import { Button } from '~/components/ui/button'
import { Grid, Box } from '@mui/material'

interface DashboardLoaderData {
  userId: string
  shopName: string
  firstName: string
  district: string
  riskScore: number
  riskLevel: 'SAFE' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'OFFLINE'
  stockItemCount: number
  potentialLossInr: number
  alertsToday: number
  activeAlerts: Array<{
    id: string
    title: string
    severity: string
    category: string
    issuedAt: string
    summary: string
    affectedItems: string[]
  }>
  stockByVulnerability: Array<{
    level: string
    count: number
  }>
  topVulnerableItems: Array<{
    id: string
    name: string
    category: string
    vulnerabilityScore: number
  }>
  communityMemberCount: number
  communityActivityLevel: 'online' | 'offline' | 'degraded' | 'active'
  riskScores: {
    flood: number
    power: number
    stock: number
    location: number
    access: number
  }
  topSuggestions: Array<{
    id: string
    title: string
    description: string
  }>
  riskTrendValue: number
  trendDirection: 'up' | 'down'
  weatherCondition: string
  rainfallTrend: Array<{
    date: string
    value: number
  }>
}

export const meta: MetaFunction = () => [
  { title: 'Dashboard | DisasterShield MSME' },
]

export const loader: LoaderFunction = async ({ request, params }) => {
  try {
    const user = await requireAuthenticatedUser(request)

    if (user.id !== params.userId || user.role !== 'msme') {
      throw new Response('Unauthorized', { status: 403 })
    }

    // Fetch shop profile and related data
    const shopProfile = await db.shopProfile.findUnique({
      where: { userId: user.id },
      include: {
        riskProfile: {
          include: {
            suggestions: {
              orderBy: { impactScore: 'desc' },
              take: 2,
            },
          },
        },
        stockItems: {
          select: { vulnerabilityScore: true },
        },
        forecastScenarios: {
          orderBy: { estimatedLossInr: 'desc' },
          take: 1,
        },
      },
    })

    if (!shopProfile) {
      return redirect('/register')
    }

    // Fetch unread alerts (top 3)
    const alerts = await db.alertRecipient.findMany({
      where: {
        userId: user.id,
        isRead: false,
      },
      include: {
        alert: {
          include: {
            recipients: {
              where: { userId: user.id },
              include: { actionResults: true },
            },
          },
        },
      },
      orderBy: { alert: { createdAt: 'desc' } },
      take: 3,
    })

    // Calculate stock vulnerability buckets
    const allStockItems = await db.stockItem.findMany({
      where: { shopProfileId: shopProfile.id },
      select: {
        id: true,
        name: true,
        category: true,
        vulnerabilityScore: true,
      },
      orderBy: { vulnerabilityScore: 'desc' },
    })

    const stockByVulnerability = [
      {
        level: 'Low',
        count: allStockItems.filter(item => item.vulnerabilityScore < 40).length,
      },
      {
        level: 'Medium',
        count: allStockItems.filter(
          item => item.vulnerabilityScore >= 40 && item.vulnerabilityScore <= 69
        ).length,
      },
      {
        level: 'High',
        count: allStockItems.filter(item => item.vulnerabilityScore > 70).length,
      },
    ]

    // Fetch rainfall trend data
    const trendData = await db.trendDataPoint.findMany({
      where: {
        regionCode: shopProfile.regionCode,
        trendType: 'rainfall',
      },
      orderBy: { recordedAt: 'asc' },
      take: 30,
    })

    const loaderData: DashboardLoaderData = {
      userId: user.id,
      shopName: shopProfile.shopName,
      firstName: user.name.split(' ')[0],
      district: shopProfile.district,
      riskScore: shopProfile.riskProfile?.overallScore ?? 0,
      riskLevel: (shopProfile.riskProfile?.riskLevel as any) ?? 'MODERATE',
      stockItemCount: allStockItems.length,
      potentialLossInr:
        shopProfile.forecastScenarios[0]?.estimatedLossInr ?? 0,
      alertsToday: alerts.length,
      activeAlerts: alerts.map(ar => ({
        id: ar.alert.id,
        title: ar.alert.title,
        severity: ar.alert.severity.toLowerCase(),
        category: ar.alert.category.replace(/_/g, ' '),
        issuedAt: ar.alert.createdAt.toISOString(),
        summary: ar.alert.summary,
        affectedItems: [],
      })),
      stockByVulnerability,
      topVulnerableItems: allStockItems.slice(0, 3),
      communityMemberCount: 0, // Placeholder - fetch from Stream API if needed
      communityActivityLevel: 'active' as const,
      riskScores: {
        flood: shopProfile.riskProfile?.floodScore ?? 0,
        power: shopProfile.riskProfile?.powerScore ?? 0,
        stock: shopProfile.riskProfile?.stockScore ?? 0,
        location: shopProfile.riskProfile?.locationScore ?? 0,
        access: shopProfile.riskProfile?.accessScore ?? 0,
      },
      topSuggestions: shopProfile.riskProfile?.suggestions ?? [],
      riskTrendValue: 5,
      trendDirection: 'down' as const,
      weatherCondition: 'Monsoon Season — Elevated Flood Risk',
      rainfallTrend: trendData.map(t => ({
        date: format(t.recordedAt, 'MMM dd'),
        value: t.value,
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

export default function MsmeDashboard() {
  const { t } = useTranslation()
  const data = useLoaderData<DashboardLoaderData>()

  const getTimeGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return t('dashboard.greeting.morning')
    if (hour < 18) return t('dashboard.greeting.afternoon')
    return t('dashboard.greeting.evening')
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Section 2.1: Page Header */}
      <PageHeader
        title={`${getTimeGreeting()}, ${data.firstName}`}
        subtitle={`${format(new Date(), 'MMMM dd, yyyy')} • ${data.district}`}
        action={<RiskBadge level={data.riskLevel.toLowerCase() as any} size="lg" />}
      />

      {/* Section 2.2: Stat Tiles Row */}
      <Grid container spacing={2}>
        <Grid item xs={6} sm={6} md={3}>
          <StatTile
            label={t('dashboard.stats.riskScore')}
            value={data.riskScore}
            icon={ShieldAlert}
            unit="/100"
            variant={
              data.riskScore < 30
                ? 'success'
                : data.riskScore < 60
                  ? 'warning'
                  : 'danger'
            }
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <StatTile
            label={t('dashboard.stats.stockItems')}
            value={data.stockItemCount}
            icon={Package}
            variant="default"
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <StatTile
            label={t('dashboard.stats.potentialLoss')}
            value={`₹${(data.potentialLossInr / 100000).toFixed(1)}L`}
            icon={Banknote}
            variant={data.potentialLossInr > 500000 ? 'danger' : 'warning'}
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <StatTile
            label={t('dashboard.stats.alertsToday')}
            value={data.alertsToday}
            icon={BellRing}
            variant={data.alertsToday > 0 ? 'danger' : 'success'}
          />
        </Grid>
      </Grid>

      {/* Section 2.3: Active Alerts Feed */}
      <SectionCard
        title={t('dashboard.alerts.title')}
        headerAction={
          data.activeAlerts.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <a href={`/msme/${data.userId}/alerts`}>
                {t('dashboard.alerts.viewAll')}
              </a>
            </Button>
          )
        }
      >
        {data.activeAlerts.length > 0 ? (
          <div className="space-y-3">
            {data.activeAlerts.map(alert => (
              <AlertCard
                key={alert.id}
                alertId={alert.id}
                title={alert.title}
                severity={alert.severity as any}
                category={alert.category}
                issuedAt={alert.issuedAt}
                affectedItems={alert.affectedItems}
                summary={alert.summary}
                isExpanded={false}
                href={`/msme/${data.userId}/alerts/${alert.id}`}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={BellRing}
            title={t('dashboard.alerts.empty.title')}
            description={t('dashboard.alerts.empty.description')}
            size="sm"
          />
        )}
      </SectionCard>

      {/* Section 2.4: Inventory Safety Summary */}
      <SectionCard
        title={t('dashboard.inventory.title')}
        headerAction={
          <Button variant="ghost" size="sm" asChild>
            <a href={`/msme/${data.userId}/stock`}>
              {t('dashboard.inventory.manage')}
            </a>
          </Button>
        }
      >
        <div className="space-y-4">
          {data.stockItemCount > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.stockByVulnerability}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="level" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-4">
                <h4 className="font-semibold text-sm">
                  {t('dashboard.inventory.mostVulnerable')}
                </h4>
                {data.topVulnerableItems.map(item => (
                  <div
                    key={item.id}
                    className="p-3 bg-surface-secondary rounded-md text-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-text-secondary text-xs">
                          {item.category}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          item.vulnerabilityScore > 70
                            ? 'bg-status-critical-bg text-status-critical'
                            : 'bg-status-moderate-bg text-status-moderate'
                        }`}
                      >
                        {item.vulnerabilityScore}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon={Package}
              title={t('dashboard.inventory.empty.title')}
              description={t('dashboard.inventory.empty.description')}
              action={{
                label: t('dashboard.inventory.empty.action'),
                href: `/msme/${data.userId}/stock`,
              }}
              size="sm"
            />
          )}
        </div>
      </SectionCard>

      {/* Section 2.5: Quick Actions */}
      <SectionCard title={t('dashboard.quickActions.title')}>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <Button
              variant="outline"
              className="w-full h-20 flex flex-col items-center gap-2"
              asChild
            >
              <a href={`/msme/${data.userId}/chat?sos=true`}>
                <Siren className="w-6 h-6 text-red-600" />
                <span className="text-xs">{t('dashboard.quickActions.sos')}</span>
              </a>
            </Button>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Button
              variant="outline"
              className="w-full h-20 flex flex-col items-center gap-2"
            >
              <Users className="w-6 h-6" />
              <span className="text-xs">
                {t('dashboard.quickActions.notifyEmployees')}
              </span>
            </Button>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Button
              variant="outline"
              className="w-full h-20 flex flex-col items-center gap-2"
              asChild
            >
              <a href={`/msme/${data.userId}/bcp`}>
                <ClipboardList className="w-6 h-6" />
                <span className="text-xs">
                  {t('dashboard.quickActions.viewBcp')}
                </span>
              </a>
            </Button>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Button
              variant="outline"
              className="w-full h-20 flex flex-col items-center gap-2"
            >
              <Phone className="w-6 h-6" />
              <span className="text-xs">
                {t('dashboard.quickActions.callLrdb')}
              </span>
            </Button>
          </Grid>
        </Grid>
      </SectionCard>

      {/* Section 2.6: Community Activity */}
      <SectionCard
        title={t('dashboard.community.title')}
        headerAction={
          <Button variant="ghost" size="sm" asChild>
            <a href={`/msme/${data.userId}/chat`}>
              {t('dashboard.community.openChat')}
            </a>
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <StatusIndicator
              status={data.communityActivityLevel}
              pulse={data.communityActivityLevel === 'active'}
            />
            <span className="text-sm">
              {data.communityMemberCount} {t('dashboard.community.activeMembers')}
            </span>
          </div>
          <p className="text-sm text-text-secondary">
            {t('dashboard.community.noMessages')}
          </p>
        </div>
      </SectionCard>

      {/* Section 2.7: Risk Snapshot */}
      <SectionCard
        title={t('dashboard.riskSnapshot.title')}
        headerAction={
          <Button variant="ghost" size="sm" asChild>
            <a href={`/msme/${data.userId}/risk`}>
              {t('dashboard.riskSnapshot.viewFull')}
            </a>
          </Button>
        }
      >
        <div className="space-y-4">
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={[data.riskScores]}>
              <PolarGrid />
              <PolarAngleAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                angle={90}
                orientation="outer"
              />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar name="Risk Score" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex justify-between items-end mt-4">
            <div>
              <p className="text-sm text-text-secondary">
                {t('dashboard.riskSnapshot.trend')}
              </p>
              <TrendChip
                value={data.riskTrendValue}
                direction={data.trendDirection}
                unit="%"
                invertColor={true}
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Section 2.8: Local Conditions */}
      <SectionCard title={t('dashboard.weather.title')}>
        <div className="space-y-4">
          <div className="p-3 bg-surface-secondary rounded-md">
            <p className="text-sm font-semibold">{data.weatherCondition}</p>
          </div>
          {data.rainfallTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.rainfallTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  name="Rainfall (mm)"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-text-secondary">
              {t('dashboard.weather.noData')}
            </p>
          )}
        </div>
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
          compact={false}
        />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <ErrorCard
        title="Error"
        message="An unexpected error occurred. Please try again."
        compact={false}
      />
    </div>
  )
}
