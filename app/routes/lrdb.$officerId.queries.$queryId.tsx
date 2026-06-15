import { json, type LoaderFunction, type ActionFunction, type MetaFunction } from '@remix-run/node'
import { useLoaderData, useParams, isRouteErrorResponse, useRouteError, useFetcher } from '@remix-run/react'
import { requireRole } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import {
  PageHeader,
  SectionCard,
  RiskBadge,
  ErrorCard,
} from '~/components/shared'
import { Button } from '~/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Textarea } from '~/components/ui/textarea'
import { Grid, Box, Typography, Stepper, Step, StepLabel } from '@mui/material'
import { AlertTriangle, MapPin, Phone, Package } from 'lucide-react'
import { format } from 'date-fns'
import { Link } from '@remix-run/react'

export const meta: MetaFunction = () => [
  { title: 'Query Details | DisasterShield' },
]

interface QueryDetailLoaderData {
  query: {
    id: string
    queryType: string
    description: string
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    status: 'PENDING' | 'UNDER_REVIEW' | 'ASSIGNED' | 'ESCALATED' | 'RESOLVED'
    createdAt: string
    resolvedAt: string | null
    resolutionNotes: string | null
    shopProfileId: string
    shopProfile: {
      id: string
      shopName: string
      category: string
      locationProfile: {
        village: string | null
        taluka: string | null
        nearestHospitalName: string | null
        nearestHospitalDistanceKm: number | null
        nearestRoadType: string | null
        connectivityType: string | null
      } | null
      riskProfile: {
        riskLevel: string
        overallScore: number
      } | null
      _count: {
        stockItems: number
        queries: number
      }
    }
    submittedBy: {
      id: string
      name: string | null
      email: string | null
    }
    assignedTo: {
      id: string
      name: string | null
    } | null
    statusHistory: Array<{
      id: string
      fromStatus: string | null
      toStatus: string
      changedAt: string
      changedByName: string | null
      notes: string | null
    }>
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

    // Fetch query with all relations
    const query = await db.query.findUnique({
      where: { id: params.queryId },
      include: {
        shopProfile: {
          select: {
            id: true,
            shopName: true,
            category: true,
            locationProfile: {
              select: {
                village: true,
                taluka: true,
                nearestHospitalName: true,
                nearestHospitalDistanceKm: true,
                nearestRoadType: true,
                connectivityType: true,
              },
            },
            riskProfile: {
              select: { riskLevel: true, overallScore: true },
            },
            _count: {
              select: { stockItems: true, queries: true },
            },
          },
        },
        submittedBy: {
          select: { id: true, name: true, email: true },
        },
        assignedTo: {
          select: { id: true, name: true },
        },
        statusHistory: {
          include: { changedByUser: { select: { name: true } } },
          orderBy: { changedAt: 'desc' },
        },
      },
    })

    if (!query) {
      throw new Response('Query not found', { status: 404 })
    }

    return json<QueryDetailLoaderData>({
      query: {
        id: query.id,
        queryType: query.queryType,
        description: query.description,
        priority: query.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        status: query.status as 'PENDING' | 'UNDER_REVIEW' | 'ASSIGNED' | 'ESCALATED' | 'RESOLVED',
        createdAt: query.createdAt.toISOString(),
        resolvedAt: query.resolvedAt?.toISOString() ?? null,
        resolutionNotes: query.resolutionNotes,
        shopProfileId: query.shopProfileId,
        shopProfile: {
          id: query.shopProfile.id,
          shopName: query.shopProfile.shopName,
          category: query.shopProfile.category,
          locationProfile: query.shopProfile.locationProfile
            ? {
                village: query.shopProfile.locationProfile.village,
                taluka: query.shopProfile.locationProfile.taluka,
                nearestHospitalName: query.shopProfile.locationProfile.nearestHospitalName,
                nearestHospitalDistanceKm: query.shopProfile.locationProfile.nearestHospitalDistanceKm,
                nearestRoadType: query.shopProfile.locationProfile.nearestRoadType,
                connectivityType: query.shopProfile.locationProfile.connectivityType,
              }
            : null,
          riskProfile: query.shopProfile.riskProfile
            ? {
                riskLevel: query.shopProfile.riskProfile.riskLevel,
                overallScore: query.shopProfile.riskProfile.overallScore,
              }
            : null,
          _count: query.shopProfile._count,
        },
        submittedBy: query.submittedBy,
        assignedTo: query.assignedTo,
        statusHistory: query.statusHistory.map((h) => ({
          id: h.id,
          fromStatus: h.fromStatus ?? null,
          toStatus: h.toStatus,
          changedAt: h.changedAt.toISOString(),
          changedByName: h.changedByUser?.name ?? null,
          notes: h.notes,
        })),
      },
    })
  } catch (error) {
    console.error('Query Detail Loader Error:', error)
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
    const queryId = params.queryId as string

    if (intent === 'update-status') {
      const newStatus = formData.get('status') as string

      // Fetch current query
      const query = await db.query.findUnique({
        where: { id: queryId },
      })

      if (!query) {
        throw new Response('Query not found', { status: 404 })
      }

      // Update query status
      await db.query.update({
        where: { id: queryId },
        data: {
          status: newStatus as any,
          ...(newStatus === 'RESOLVED' && { resolvedAt: new Date() }),
        },
      })

      // Append status history
      await db.queryStatusHistory.create({
        data: {
          queryId,
          fromStatus: query.status,
          toStatus: newStatus as any,
          changedBy: officer.id,
        },
      })

      return json({ success: true })
    }

    if (intent === 'save-notes') {
      const notes = formData.get('notes') as string

      await db.query.update({
        where: { id: queryId },
        data: {
          resolutionNotes: notes,
        },
      })

      return json({ success: true })
    }

    if (intent === 'escalate') {
      const query = await db.query.findUnique({
        where: { id: queryId },
      })

      if (!query) {
        throw new Response('Query not found', { status: 404 })
      }

      // Update query status to ESCALATED
      await db.query.update({
        where: { id: queryId },
        data: {
          status: 'ESCALATED',
        },
      })

      // Append status history
      await db.queryStatusHistory.create({
        data: {
          queryId,
          fromStatus: query.status,
          toStatus: 'ESCALATED',
          changedBy: officer.id,
          notes: 'Query escalated by LRDB officer',
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

export default function QueryDetailPage() {
  const { query } = useLoaderData<QueryDetailLoaderData>()
  const fetcher = useFetcher()

  const priorityColor = {
    LOW: 'bg-green-100 text-green-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    HIGH: 'bg-orange-100 text-orange-800',
    CRITICAL: 'bg-red-100 text-red-800',
  }

  const statusColor = {
    PENDING: 'bg-gray-100 text-gray-800',
    UNDER_REVIEW: 'bg-blue-100 text-blue-800',
    ASSIGNED: 'bg-purple-100 text-purple-800',
    ESCALATED: 'bg-red-100 text-red-800',
    RESOLVED: 'bg-green-100 text-green-800',
  }

  const handleStatusChange = (newStatus: string) => {
    const formData = new FormData()
    formData.append('intent', 'update-status')
    formData.append('status', newStatus)
    fetcher.submit(formData, { method: 'POST' })
  }

  const handleSaveNotes = (notes: string) => {
    const formData = new FormData()
    formData.append('intent', 'save-notes')
    formData.append('notes', notes)
    fetcher.submit(formData, { method: 'POST' })
  }

  const handleEscalate = () => {
    const formData = new FormData()
    formData.append('intent', 'escalate')
    fetcher.submit(formData, { method: 'POST' })
  }

  const statusSteps = ['PENDING', 'UNDER_REVIEW', 'ASSIGNED', 'RESOLVED']
  const currentStepIndex = statusSteps.indexOf(query.status)

  return (
    <Box sx={{ p: 3 }}>
      {/* Page Header */}
      <PageHeader
        title={query.queryType}
        subtitle={query.shopProfile.shopName}
        breadcrumb={[{ label: 'Queries' }, { label: query.queryType }]}
        action={
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Select value={query.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Update Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                <SelectItem value="ASSIGNED">Assigned</SelectItem>
                <SelectItem value="ESCALATED">Escalated</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </Box>
        }
      />

      {/* Status Badges */}
      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${priorityColor[query.priority]}`}>
          {query.priority} Priority
        </span>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColor[query.status]}`}>
          {query.status}
        </span>
      </Box>

      {/* Query Details */}
      <Grid container spacing={3} sx={{ mt: 1 }}>
        {/* Query Description */}
        <Grid item xs={12} md={8}>
          <SectionCard title="Query Details">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box>
                <Typography variant="caption" className="text-muted-foreground block mb-1">
                  Description
                </Typography>
                <Typography variant="body2">{query.description}</Typography>
              </Box>

              <Box>
                <Typography variant="caption" className="text-muted-foreground block mb-1">
                  Submitted By
                </Typography>
                <Typography variant="body2">
                  {query.submittedBy.name} ({query.submittedBy.email})
                </Typography>
                <Typography variant="caption" className="text-muted-foreground">
                  {format(new Date(query.createdAt), 'MMM dd, yyyy HH:mm')}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" className="text-muted-foreground block mb-1">
                  Assigned To
                </Typography>
                <Typography variant="body2">
                  {query.assignedTo?.name || 'Unassigned'}
                </Typography>
              </Box>

              {query.status === 'RESOLVED' && (
                <Box>
                  <Typography variant="caption" className="text-muted-foreground block mb-1">
                    Resolution Notes
                  </Typography>
                  <Textarea
                    value={query.resolutionNotes || ''}
                    onChange={(e) => handleSaveNotes(e.target.value)}
                    placeholder="Add resolution notes..."
                    disabled={fetcher.state !== 'idle'}
                  />
                  <Typography variant="caption" className="text-muted-foreground mt-1">
                    {fetcher.state !== 'idle' ? 'Saving...' : 'Auto-saves'}
                  </Typography>
                </Box>
              )}
            </Box>
          </SectionCard>

          {/* Query Timeline */}
          <SectionCard title="Query Timeline">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {query.statusHistory.map((history: QueryDetailLoaderData['query']['statusHistory'][number], index: number) => (
                <Box key={history.id} sx={{ display: 'flex', gap: 2, pb: index !== query.statusHistory.length - 1 ? 2 : 0, borderBottom: index !== query.statusHistory.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                  <Box sx={{ minWidth: '8px', width: '8px', height: '8px', mt: 1.5, bgcolor: '#3b82f6', borderRadius: '50%' }} />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {history.toStatus}
                    </Typography>
                    <Typography variant="caption" className="text-muted-foreground">
                      Changed by {history.changedByName ?? 'Officer'}
                    </Typography>
                    <Typography variant="caption" className="text-muted-foreground block">
                      {format(new Date(history.changedAt), 'MMM dd, yyyy HH:mm')}
                    </Typography>
                    {history.notes && (
                      <Typography variant="caption" className="block mt-1">
                        {history.notes}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>

            {query.status !== 'ESCALATED' && query.status !== 'RESOLVED' && (
              <Button variant="destructive" onClick={handleEscalate} className="mt-2">
                Escalate Query
              </Button>
            )}
          </SectionCard>
        </Grid>

        {/* Shop Context Panel */}
        <Grid item xs={12} md={4}>
          <SectionCard title="Shop Context">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="caption" className="text-muted-foreground block mb-1">
                  Shop Name
                </Typography>
                <Link to={`../shops/${query.shopProfile.id}`} className="text-blue-600 hover:underline">
                  {query.shopProfile.shopName}
                </Link>
              </Box>

              <Box>
                <Typography variant="caption" className="text-muted-foreground block mb-1">
                  Category
                </Typography>
                <Typography variant="body2">{query.shopProfile.category}</Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
                <Box>
                  <Typography variant="body2">
                    {query.shopProfile.locationProfile?.village}, {query.shopProfile.locationProfile?.taluka}
                  </Typography>
                </Box>
              </Box>

              {query.shopProfile.riskProfile && (
                <Box>
                  <Typography variant="caption" className="text-muted-foreground block mb-1">
                    Risk Level
                  </Typography>
                  <RiskBadge
                    level={query.shopProfile.riskProfile.riskLevel as any}
                    score={query.shopProfile.riskProfile.overallScore}
                  />
                </Box>
              )}

              <Box>
                <Typography variant="caption" className="text-muted-foreground block mb-1">
                  Nearest Hospital
                </Typography>
                <Typography variant="body2">
                  {query.shopProfile.locationProfile?.nearestHospitalName}
                  {query.shopProfile.locationProfile?.nearestHospitalDistanceKm && (
                    <Typography variant="caption" className="text-muted-foreground ml-1">
                      ({query.shopProfile.locationProfile.nearestHospitalDistanceKm} km)
                    </Typography>
                  )}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" className="text-muted-foreground block mb-1">
                  Road Access
                </Typography>
                <Typography variant="body2">{query.shopProfile.locationProfile?.nearestRoadType}</Typography>
              </Box>

              <Box>
                <Typography variant="caption" className="text-muted-foreground block mb-1">
                  Connectivity
                </Typography>
                <Typography variant="body2">{query.shopProfile.locationProfile?.connectivityType}</Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 2, pt: 1 }}>
                <Box sx={{ textAlign: 'center', p: 1, border: '1px solid #e5e7eb', borderRadius: 1, flex: 1 }}>
                  <Typography variant="h6">{query.shopProfile._count.stockItems}</Typography>
                  <Typography variant="caption" className="text-muted-foreground">
                    Stock Items
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center', p: 1, border: '1px solid #e5e7eb', borderRadius: 1, flex: 1 }}>
                  <Typography variant="h6">{query.shopProfile._count.queries}</Typography>
                  <Typography variant="caption" className="text-muted-foreground">
                    Total Queries
                  </Typography>
                </Box>
              </Box>

              <Link to={`../shops/${query.shopProfile.id}`} className="pt-2">
                <Button variant="outline" className="w-full">
                  View Full Shop Profile →
                </Button>
              </Link>
            </Box>
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    return (
      <ErrorCard
        title={`${error.status} Error`}
        message={error.statusText || 'An error occurred loading query details'}
      />
    )
  }

  return <ErrorCard title="Error" message="An unexpected error occurred" />
}
