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
import { Grid, Box } from '@mui/material'
import { Inbox, AlertOctagon, Clock, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import { Link } from '@remix-run/react'

export const meta: MetaFunction = () => [
  { title: 'Queries | DisasterShield' },
]

interface QueryData {
  id: string
  type: string
  description: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'PENDING' | 'UNDER_REVIEW' | 'ASSIGNED' | 'ESCALATED' | 'RESOLVED'
  submittedAt: string
  submittedBy: {
    name: string | null
  }
  shopProfile: {
    id: string
    shopName: string
  }
  assignedToUser: {
    id: string
    name: string | null
  } | null
}

interface QueriesLoaderData {
  queries: QueryData[]
  stats: {
    openQueries: number
    critical: number
    pendingAssignment: number
    resolvedToday: number
  }
}

export const loader: LoaderFunction = async ({ request, params }) => {
  try {
    // Require LRDB role
    const officer = await requireRole(request, 'lrdb')

    // Fetch LRDB profile
    const lrdbProfile = await db.lRDBOfficer.findUnique({
      where: { userId: officer.id },
    })

    if (!lrdbProfile) {
      throw new Response('LRDB profile not found', { status: 404 })
    }

    // Get URL search params for filtering
    const url = new URL(request.url)
    const searchQuery = url.searchParams.get('search')?.toLowerCase() || ''
    const statusFilter = url.searchParams.get('status')
    const priorityFilter = url.searchParams.get('priority')
    const typeFilter = url.searchParams.get('type')
    const assignedFilter = url.searchParams.get('assigned')

    // Build where clause - queries for shops in officer's region
    const whereClause: any = {
      shopProfile: {
        regionCode: lrdbProfile.regionCode,
      },
    }

    // Add search filter
    if (searchQuery) {
      whereClause.OR = [
        { description: { contains: searchQuery, mode: 'insensitive' } },
        { shopProfile: { shopName: { contains: searchQuery, mode: 'insensitive' } } },
      ]
    }

    // Add status filter
    if (statusFilter && statusFilter !== 'all') {
      whereClause.status = statusFilter
    }

    // Add priority filter
    if (priorityFilter && priorityFilter !== 'all') {
      whereClause.priority = priorityFilter
    }

    // Add type filter
    if (typeFilter && typeFilter !== 'all') {
      whereClause.queryType = typeFilter
    }

    // Add assigned filter
    if (assignedFilter === 'me') {
      whereClause.assignedToUserId = officer.id
    } else if (assignedFilter === 'unassigned') {
      whereClause.assignedToUserId = null
    }

    // Fetch all queries
    const allQueries = await db.query.findMany({
      where: whereClause,
      include: {
        shopProfile: {
          select: { id: true, shopName: true },
        },
        submittedBy: {
          select: { name: true },
        },
        assignedTo: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Calculate stats from ALL queries (not filtered)
    const allQueriesForStats = await db.query.findMany({
      where: {
        shopProfile: {
          regionCode: lrdbProfile.regionCode,
        },
      },
    })

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const stats = {
      openQueries: allQueriesForStats.filter((q) => q.status !== 'RESOLVED').length,
      critical: allQueriesForStats.filter((q) => q.priority === 'CRITICAL').length,
      pendingAssignment: allQueriesForStats.filter((q) => q.status === 'PENDING').length,
      resolvedToday: allQueriesForStats.filter(
        (q) => q.status === 'RESOLVED' && q.resolvedAt && new Date(q.resolvedAt) >= today
      ).length,
    }

    return json<QueriesLoaderData>({
      queries: allQueries.map((q) => ({
        id: q.id,
        type: q.queryType,
        description: q.description,
        priority: q.priority as QueryData['priority'],
        status: q.status as QueryData['status'],
        submittedAt: q.createdAt.toISOString(),
        submittedBy: q.submittedBy,
        shopProfile: q.shopProfile,
        assignedToUser: q.assignedTo,
      })),
      stats,
    })
  } catch (error) {
    console.error('Queries Loader Error:', error)
    throw error
  }
}

export const action: ActionFunction = async ({ request, params }) => {
  if (request.method !== 'POST') {
    throw new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const officer = await requireRole(request, 'lrdb')
    const formData = await request.formData()
    const intent = formData.get('intent')

    if (intent === 'assign') {
      const queryId = formData.get('queryId') as string

      // Fetch the query
      const query = await db.query.findUnique({
        where: { id: queryId },
        include: { shopProfile: { include: { user: true } } },
      })

      if (!query) {
        throw new Response('Query not found', { status: 404 })
      }

      // Update query
      await db.query.update({
        where: { id: queryId },
        data: {
          assignedToUserId: officer.id,
          status: 'UNDER_REVIEW',
        },
      })

      // Append status history
      await db.queryStatusHistory.create({
        data: {
          queryId,
          fromStatus: query.status,
          toStatus: 'UNDER_REVIEW',
          changedBy: officer.id,
        },
      })

      return json({ success: true })
    }

    throw new Response('Invalid intent', { status: 400 })
  } catch (error) {
    console.error('Action Error:', error)
    throw error
  }
}

export default function QueriesPage() {
  const { queries, stats } = useLoaderData<QueriesLoaderData>()
  const [searchParams, setSearchParams] = useSearchParams()
  const fetcher = useFetcher()

  const currentSearch = searchParams.get('search') || ''
  const currentStatus = searchParams.get('status') || 'all'
  const currentPriority = searchParams.get('priority') || 'all'
  const currentType = searchParams.get('type') || 'all'

  const handleFilterChange = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (value === 'all') {
      newParams.delete(key)
    } else {
      newParams.set(key, value)
    }
    setSearchParams(newParams)
  }

  const handleSearch = (query: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (query) {
      newParams.set('search', query)
    } else {
      newParams.delete('search')
    }
    setSearchParams(newParams)
  }

  const handleAssignToMe = (queryId: string) => {
    const formData = new FormData()
    formData.append('intent', 'assign')
    formData.append('queryId', queryId)
    fetcher.submit(formData, { method: 'POST' })
  }

  const filteredQueries = queries.filter((q) => {
    if (currentStatus !== 'all' && q.status !== currentStatus) return false
    if (currentPriority !== 'all' && q.priority !== currentPriority) return false
    if (currentType !== 'all' && q.type !== currentType) return false
    return true
  })

  return (
    <Box sx={{ p: 3 }}>
      {/* Page Header */}
      <PageHeader
        title="Queries"
        subtitle="Emergency assistance requests from businesses in your region"
        action={
          <Button>Create Query</Button>
        }
      />

      {/* Summary Stats */}
      <Grid container spacing={2} sx={{ mt: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            label="Open Queries"
            value={stats.openQueries}
            icon={Inbox}
            variant="default"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            label="Critical"
            value={stats.critical}
            icon={AlertOctagon}
            variant="danger"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            label="Pending Assignment"
            value={stats.pendingAssignment}
            icon={Clock}
            variant="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            label="Resolved Today"
            value={stats.resolvedToday}
            icon={CheckCircle}
            variant="success"
          />
        </Grid>
      </Grid>

      {/* Filter Bar */}
      <SectionCard title="Filters" sx={{ mt: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <Input
              placeholder="Search by shop or description"
              value={currentSearch}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Select
              value={currentPriority}
              onValueChange={(value) => handleFilterChange('priority', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
              </SelectContent>
            </Select>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Select
              value={currentType}
              onValueChange={(value) => handleFilterChange('type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Query Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="FLOOD_ASSISTANCE">Flood Assistance</SelectItem>
                <SelectItem value="POWER_OUTAGE">Power Outage</SelectItem>
                <SelectItem value="TRANSPORT">Transport</SelectItem>
                <SelectItem value="INFRASTRUCTURE">Infrastructure</SelectItem>
                <SelectItem value="STOCK_PROTECTION">Stock Protection</SelectItem>
                <SelectItem value="RELIEF_SUPPORT">Relief Support</SelectItem>
              </SelectContent>
            </Select>
          </Grid>
        </Grid>
      </SectionCard>

      {/* Queries Table */}
      <SectionCard title="Queries List" sx={{ mt: 3 }}>
        <Tabs defaultValue={currentStatus === 'all' ? 'all' : currentStatus} value={currentStatus === 'all' ? 'all' : currentStatus}>
          <TabsList>
            <TabsTrigger value="all" onClick={() => handleFilterChange('status', 'all')}>
              All
            </TabsTrigger>
            <TabsTrigger value="PENDING" onClick={() => handleFilterChange('status', 'PENDING')}>
              Pending
            </TabsTrigger>
            <TabsTrigger value="UNDER_REVIEW" onClick={() => handleFilterChange('status', 'UNDER_REVIEW')}>
              Under Review
            </TabsTrigger>
            <TabsTrigger value="ASSIGNED" onClick={() => handleFilterChange('status', 'ASSIGNED')}>
              Assigned
            </TabsTrigger>
            <TabsTrigger value="ESCALATED" onClick={() => handleFilterChange('status', 'ESCALATED')}>
              Escalated
            </TabsTrigger>
            <TabsTrigger value="RESOLVED" onClick={() => handleFilterChange('status', 'RESOLVED')}>
              Resolved
            </TabsTrigger>
          </TabsList>

          <TabsContent value={currentStatus === 'all' ? 'all' : currentStatus} className="mt-4">
            {filteredQueries.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No queries found"
                description="No queries match the current filters."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Query</TableHead>
                    <TableHead>Shop</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQueries.map((query) => (
                    <TableRow key={query.id}>
                      <TableCell>
                        <div className="text-sm font-medium">{query.type}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-xs">
                          {query.description}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link to={`../shops/${query.shopProfile.id}`} className="text-sm hover:underline">
                          {query.shopProfile.shopName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            query.priority === 'CRITICAL'
                              ? 'bg-red-100 text-red-800'
                              : query.priority === 'HIGH'
                              ? 'bg-orange-100 text-orange-800'
                              : query.priority === 'MEDIUM'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {query.priority}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            query.status === 'PENDING'
                              ? 'bg-gray-100 text-gray-800'
                              : query.status === 'UNDER_REVIEW'
                              ? 'bg-blue-100 text-blue-800'
                              : query.status === 'ASSIGNED'
                              ? 'bg-purple-100 text-purple-800'
                              : query.status === 'ESCALATED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {query.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {query.assignedToUser?.name || 'Unassigned'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(query.submittedAt), 'MMM dd, HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Link to={query.id}>
                            <Button variant="outline" size="sm">
                              View
                            </Button>
                          </Link>
                          {!query.assignedToUser && query.status === 'PENDING' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAssignToMe(query.id)}
                              disabled={fetcher.state !== 'idle'}
                            >
                              {fetcher.state !== 'idle' ? 'Assigning...' : 'Assign to Me'}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </SectionCard>
    </Box>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    return (
      <ErrorCard
        title={`${error.status} Error`}
        message={error.statusText || 'An error occurred loading queries'}
      />
    )
  }

  return <ErrorCard title="Error" message="An unexpected error occurred" />
}
