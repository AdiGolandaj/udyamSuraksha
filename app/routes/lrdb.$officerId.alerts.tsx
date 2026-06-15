import { json, type LoaderFunction, type ActionFunction, type MetaFunction } from '@remix-run/node'
import { useLoaderData, useSearchParams, useFetcher, isRouteErrorResponse, useRouteError } from '@remix-run/react'
import { requireRole } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import {
  PageHeader,
  SectionCard,
  StatTile,
  EmptyState,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Input } from '~/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Textarea } from '~/components/ui/textarea'
import { Label } from '~/components/ui/label'
import { Progress } from '~/components/ui/progress'
import { Grid, Box } from '@mui/material'
import { BellRing, Users, Eye, CheckCircle } from 'lucide-react'
import { format, isAfter, parseISO, isToday } from 'date-fns'
import { useCallback, useState } from 'react'
import { useParams as useRouteParams } from '@remix-run/react'

export const meta: MetaFunction = () => [
  { title: 'Alerts Management | DisasterShield' },
]

interface AlertData {
  id: string
  title: string
  category: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  summary: string
  isActive: boolean
  createdAt: string
  expiresAt: string | null
  _count: {
    recipients: number
  }
  recipients: Array<{
    id: string
    isRead: boolean
  }>
  actions: Array<{
    id: string
    results: Array<{
      id: string
      isCompleted: boolean
    }>
  }>
}

interface AlertsLoaderData {
  alerts: AlertData[]
  stats: {
    activeAlerts: number
    totalRecipients: number
    readRate: number
    actionCompletionRate: number
  }
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

    const url = new URL(request.url)
    const statusFilter = url.searchParams.get('status') || 'all'
    const severityFilter = url.searchParams.get('severity')
    const categoryFilter = url.searchParams.get('category')
    const createdByFilter = url.searchParams.get('createdBy')
    const searchQuery = url.searchParams.get('search')?.toLowerCase() || ''

    const whereClause: any = {
      affectedRegions: {
        contains: lrdbProfile.regionCode,
      },
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        whereClause.isActive = true
      } else if (statusFilter === 'expired') {
        whereClause.isActive = false
      } else if (statusFilter === 'archived') {
        // Archived status would be a separate field in a real implementation
        whereClause.isActive = false
      }
    }

    // Severity filter
    if (severityFilter && severityFilter !== 'all') {
      whereClause.severity = severityFilter
    }

    // Category filter
    if (categoryFilter && categoryFilter !== 'all') {
      whereClause.category = categoryFilter
    }

    // Created by filter
    if (createdByFilter && createdByFilter !== 'all') {
      if (createdByFilter === 'ai') {
        whereClause.isAiGenerated = true
      } else if (createdByFilter === 'officer') {
        whereClause.isAiGenerated = false
      }
    }

    // Search filter
    if (searchQuery) {
      whereClause.OR = [
        { title: { contains: searchQuery, mode: 'insensitive' } },
        { summary: { contains: searchQuery, mode: 'insensitive' } },
      ]
    }

    // Fetch all alerts with recipient and action data
    const allAlerts = await db.alert.findMany({
      where: whereClause,
      include: {
        recipients: { select: { id: true, isRead: true } },
        actions: {
          select: {
            id: true,
            results: { select: { id: true, isCompleted: true } },
          },
        },
        _count: { select: { recipients: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Calculate stats
    const activeAlertsCount = allAlerts.filter((a) => a.isActive).length
    const totalRecipientsCount = allAlerts.reduce(
      (sum, alert) => sum + alert._count.recipients,
      0
    )

    let totalReadsCount = 0
    let totalActionsCount = 0
    let totalActionsCompleted = 0

    allAlerts.forEach((alert) => {
      totalReadsCount += alert.recipients.filter((r) => r.isRead).length

      alert.actions.forEach((action) => {
        totalActionsCount += action.results.length
        totalActionsCompleted += action.results.filter((r) =>
          r.isCompleted
        ).length
      })
    })

    const readRate = totalRecipientsCount > 0 ? Math.round((totalReadsCount / totalRecipientsCount) * 100) : 0
    const actionCompletionRate = totalActionsCount > 0 ? Math.round((totalActionsCompleted / totalActionsCount) * 100) : 0

    return json<AlertsLoaderData>({
      alerts: allAlerts.map((alert) => ({
        ...alert,
        createdAt: alert.createdAt.toISOString(),
        expiresAt: alert.expiresAt?.toISOString() || null,
      })) as AlertData[],
      stats: {
        activeAlerts: activeAlertsCount,
        totalRecipients: totalRecipientsCount,
        readRate,
        actionCompletionRate,
      },
    })
  } catch (error) {
    if (isRouteErrorResponse(error)) throw error
    throw new Response('Failed to load alerts', { status: 500 })
  }
}

export const action: ActionFunction = async ({ request, params }) => {
  try {
    if (request.method !== 'POST') {
      throw new Response('Method not allowed', { status: 405 })
    }

    const officer = await requireRole(request, 'lrdb')
    const { intent, alertId } = await request.json()

    const lrdbProfile = await db.lRDBOfficer.findUnique({
      where: { userId: officer.id },
    })

    if (!lrdbProfile) {
      throw new Response('LRDB profile not found', { status: 404 })
    }

    if (intent === 'deactivate-alert') {
      // Verify alert belongs to officer's region
      const alert = await db.alert.findUnique({
        where: { id: alertId },
      })

      if (!alert || !alert.affectedRegions.includes(lrdbProfile.regionCode)) {
        throw new Response('Alert not found or unauthorized', { status: 404 })
      }

      // Deactivate alert
      await db.alert.update({
        where: { id: alertId },
        data: { isActive: false },
      })

      return json({ success: true, message: 'Alert deactivated' })
    }

    if (intent === 'create-alert') {
      const {
        title,
        severity,
        category,
        summary,
        targetRegion,
        targetCategoryFilter,
        targetRiskLevelFilter,
        recommendedActions,
        deliveryChannels,
        expiresAt,
      } = await request.json()

      // Create alert record
      const alert = await db.alert.create({
        data: {
          title,
          category,
          severity,
          summary,
          affectedRegions: targetRegion || lrdbProfile.regionCode,
          isActive: true,
          issuedByUserId: officer.id,
          expiresAt: expiresAt ? parseISO(expiresAt) : null,
        },
      })

      // Find target shops based on filters
      const whereClause: any = {
        locationProfile: {
          regionCode: targetRegion || lrdbProfile.regionCode,
        },
      }

      if (targetCategoryFilter && targetCategoryFilter.length > 0) {
        whereClause.category = { in: targetCategoryFilter }
      }

      if (targetRiskLevelFilter && targetRiskLevelFilter.length > 0) {
        whereClause.riskProfile = {
          riskLevel: { in: targetRiskLevelFilter },
        }
      }

      const targetShops = await db.shopProfile.findMany({
        where: whereClause,
        include: { user: true },
      })

      // Create AlertRecipient records
      const recipientPromises = targetShops.map((shop) =>
        db.alertRecipient.create({
          data: {
            alertId: alert.id,
            userId: shop.userId,
            isRead: false,
          },
        })
      )

      await Promise.all(recipientPromises)

      // Create AlertAction records
      if (recommendedActions && recommendedActions.length > 0) {
        const actionPromises = recommendedActions.map((action: any) =>
          db.alertAction.create({
            data: {
              alertId: alert.id,
              label: action.label,
              actionType: action.type,
            },
          })
        )

        await Promise.all(actionPromises)
      }

      return json({ success: true, alertId: alert.id, message: 'Alert created successfully' })
    }

    throw new Response('Unknown action', { status: 400 })
  } catch (error) {
    if (isRouteErrorResponse(error)) throw error
    console.error('Alert action error:', error)
    throw new Response('Failed to process alert action', { status: 500 })
  }
}

export default function AlertsPage() {
  const { alerts, stats } = useLoaderData<AlertsLoaderData>()
  const { officerId } = useRouteParams()
  const fetcher = useFetcher()
  const [searchParams, setSearchParams] = useSearchParams()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    severity: 'MEDIUM',
    category: 'OTHER',
    summary: '',
    targetCategoryFilter: [] as string[],
    targetRiskLevelFilter: [] as string[],
    recommendedActions: [] as Array<{ label: string; type: string }>,
    deliveryChannels: { app: true, email: true },
    expiresAt: '',
  })

  const statusFilter = searchParams.get('status') || 'all'
  const severityFilter = searchParams.get('severity')
  const categoryFilter = searchParams.get('category')
  const createdByFilter = searchParams.get('createdBy')

  const handleStatusChange = (value: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (value === 'all') {
      newParams.delete('status')
    } else {
      newParams.set('status', value)
    }
    setSearchParams(newParams)
  }

  const handleDeactivate = (alertId: string) => {
    fetcher.submit(
      { intent: 'deactivate-alert', alertId },
      { method: 'post', encType: 'application/json' }
    )
  }

  const handleCreateAlert = () => {
    if (!formData.title.trim() || !formData.summary.trim()) {
      return
    }

    const expiresAt = formData.expiresAt
      ? new Date(formData.expiresAt).toISOString()
      : null

    fetcher.submit(
      {
        intent: 'create-alert',
        title: formData.title,
        severity: formData.severity,
        category: formData.category,
        summary: formData.summary,
        targetCategoryFilter: formData.targetCategoryFilter,
        targetRiskLevelFilter: formData.targetRiskLevelFilter,
        recommendedActions: formData.recommendedActions,
        deliveryChannels: formData.deliveryChannels,
        expiresAt,
      },
      { method: 'post', encType: 'application/json' }
    )

    setIsCreateDialogOpen(false)
    setFormData({
      title: '',
      severity: 'MEDIUM',
      category: 'OTHER',
      summary: '',
      targetCategoryFilter: [],
      targetRiskLevelFilter: [],
      recommendedActions: [],
      deliveryChannels: { app: true, email: true },
      expiresAt: '',
    })
  }

  const filteredAlerts = alerts.filter((alert) => {
    let matches = true

    if (statusFilter === 'active') matches = matches && alert.isActive
    if (statusFilter === 'expired') matches = matches && !alert.isActive
    if (statusFilter === 'archived') matches = matches && !alert.isActive

    return matches
  })

  if (!alerts || alerts.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader
          title="Alerts Management"
          subtitle="Create and monitor disaster advisories for your region"
          action={
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>Create Alert</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Alert</DialogTitle>
                  <DialogDescription>
                    Create a disaster advisory alert for your region
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Alert Title *</Label>
                    <Input
                      id="title"
                      placeholder="e.g. Heavy rainfall warning"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="severity">Severity *</Label>
                      <Select value={formData.severity} onValueChange={(val) =>
                        setFormData({ ...formData, severity: val as any })
                      }>
                        <SelectTrigger id="severity">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">Low</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="CRITICAL">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="category">Category *</Label>
                      <Select value={formData.category} onValueChange={(val) =>
                        setFormData({ ...formData, category: val })
                      }>
                        <SelectTrigger id="category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FLOOD">Flood</SelectItem>
                          <SelectItem value="WIND">Wind</SelectItem>
                          <SelectItem value="POWER">Power Outage</SelectItem>
                          <SelectItem value="TRANSPORT">Transport</SelectItem>
                          <SelectItem value="LANDSLIDE">Landslide</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="summary">Message *</Label>
                    <Textarea
                      id="summary"
                      placeholder="Alert message for shop owners..."
                      className="min-h-[100px]"
                      value={formData.summary}
                      onChange={(e) =>
                        setFormData({ ...formData, summary: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="expiresAt">Expires At (optional)</Label>
                    <Input
                      id="expiresAt"
                      type="datetime-local"
                      value={formData.expiresAt}
                      onChange={(e) =>
                        setFormData({ ...formData, expiresAt: e.target.value })
                      }
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateAlert}
                      disabled={fetcher.state !== 'idle'}
                    >
                      {fetcher.state !== 'idle' ? 'Creating...' : 'Create Alert'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          }
        />

        <EmptyState icon={BellRing} title="No alerts yet" description="Create your first disaster alert to get started." />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Alerts Management"
        subtitle="Create and monitor disaster advisories for your region"
        action={
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>Create Alert</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Alert</DialogTitle>
                <DialogDescription>
                  Create a disaster advisory alert for your region
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Alert Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g. Heavy rainfall warning"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="severity">Severity *</Label>
                    <Select value={formData.severity} onValueChange={(val) =>
                      setFormData({ ...formData, severity: val as any })
                    }>
                      <SelectTrigger id="severity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="category">Category *</Label>
                    <Select value={formData.category} onValueChange={(val) =>
                      setFormData({ ...formData, category: val })
                    }>
                      <SelectTrigger id="category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FLOOD">Flood</SelectItem>
                        <SelectItem value="WIND">Wind</SelectItem>
                        <SelectItem value="POWER">Power Outage</SelectItem>
                        <SelectItem value="TRANSPORT">Transport</SelectItem>
                        <SelectItem value="LANDSLIDE">Landslide</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="summary">Message *</Label>
                  <Textarea
                    id="summary"
                    placeholder="Alert message for shop owners..."
                    className="min-h-[100px]"
                    value={formData.summary}
                    onChange={(e) =>
                      setFormData({ ...formData, summary: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="expiresAt">Expires At (optional)</Label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) =>
                      setFormData({ ...formData, expiresAt: e.target.value })
                    }
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateAlert}
                    disabled={fetcher.state !== 'idle'}
                  >
                    {fetcher.state !== 'idle' ? 'Creating...' : 'Create Alert'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            label="Active Alerts"
            value={stats.activeAlerts}
            icon={BellRing}
            variant="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            label="Total Recipients"
            value={stats.totalRecipients}
            icon={Users}
            variant="default"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            label="Read Rate"
            value={`${stats.readRate}%`}
            icon={Eye}
            variant="default"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            label="Action Completion"
            value={`${stats.actionCompletionRate}%`}
            icon={CheckCircle}
            variant="success"
          />
        </Grid>
      </Grid>

      <SectionCard title="Filter & Search">
        <div className="space-y-4">
          <Input
            placeholder="Search alerts..."
            value={searchParams.get('search') || ''}
            onChange={(e) => {
              const newParams = new URLSearchParams(searchParams)
              if (e.target.value) {
                newParams.set('search', e.target.value)
              } else {
                newParams.delete('search')
              }
              setSearchParams(newParams)
            }}
          />

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={severityFilter || 'all'}
              onValueChange={(value) => {
                const newParams = new URLSearchParams(searchParams)
                if (value === 'all') {
                  newParams.delete('severity')
                } else {
                  newParams.set('severity', value)
                }
                setSearchParams(newParams)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={categoryFilter || 'all'}
              onValueChange={(value) => {
                const newParams = new URLSearchParams(searchParams)
                if (value === 'all') {
                  newParams.delete('category')
                } else {
                  newParams.set('category', value)
                }
                setSearchParams(newParams)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="FLOOD">Flood</SelectItem>
                <SelectItem value="WIND">Wind</SelectItem>
                <SelectItem value="POWER">Power Outage</SelectItem>
                <SelectItem value="TRANSPORT">Transport</SelectItem>
                <SelectItem value="LANDSLIDE">Landslide</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={createdByFilter || 'all'}
              onValueChange={(value) => {
                const newParams = new URLSearchParams(searchParams)
                if (value === 'all') {
                  newParams.delete('createdBy')
                } else {
                  newParams.set('createdBy', value)
                }
                setSearchParams(newParams)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Created By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="ai">AI Generated</SelectItem>
                <SelectItem value="officer">Officer Created</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Alerts">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alert</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Read Rate</TableHead>
                <TableHead>Action Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAlerts.map((alert) => {
                const readCount = alert.recipients.filter(
                  (r) => r.isRead
                ).length
                const readRate =
                  alert.recipients.length > 0
                    ? Math.round(
                        (readCount / alert.recipients.length) * 100
                      )
                    : 0

                let actionCount = 0
                let actionCompleted = 0
                alert.actions.forEach((action) => {
                  actionCount += action.results.length
                  actionCompleted += action.results.filter((r) =>
                    r.isCompleted
                  ).length
                })

                const actionRate = actionCount > 0 ? Math.round((actionCompleted / actionCount) * 100) : 0

                return (
                  <TableRow key={alert.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{alert.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {alert.category}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
                      {format(parseISO(alert.createdAt), 'MMM dd, HH:mm')}
                    </TableCell>
                    <TableCell>{alert.recipients.length}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={readRate} className="w-20" />
                        <span className="text-sm">{readRate}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={actionRate} className="w-20" />
                        <span className="text-sm">{actionRate}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          alert.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {alert.isActive ? 'Active' : 'Expired'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            (window.location.href = `/lrdb/${officerId}/alerts/${alert.id}`)
                          }
                        >
                          View
                        </Button>
                        {alert.isActive && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeactivate(alert.id)}
                            disabled={fetcher.state !== 'idle'}
                          >
                            Deactivate
                          </Button>
                        )}
                      </div>
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
