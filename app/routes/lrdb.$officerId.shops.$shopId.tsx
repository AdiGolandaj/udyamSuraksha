import { json, type LoaderFunction, type MetaFunction } from '@remix-run/node'
import { useLoaderData, useParams, isRouteErrorResponse, useRouteError } from '@remix-run/react'
import { requireRole } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import {
  PageHeader,
  SectionCard,
  RiskBadge,
  AlertCard,
  ErrorCard,
  StatusIndicator,
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
import { Progress } from '~/components/ui/progress'
import { Grid, Box, Typography } from '@mui/material'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Phone, Mail, MapPin, AlertTriangle, Package, Calendar, Send } from 'lucide-react'
import { format } from 'date-fns'
import { Link } from '@remix-run/react'

export const meta: MetaFunction = ({ params }) => [
  { title: `Shop Details | DisasterShield` },
]

interface ShopDetailLoaderData {
  shop: {
    id: string
    shopName: string
    category: string
    gstNumber: string | null
    shopAreaSqFt: number | null
    establishedYear: number | null
    createdAt: string
    phoneNumber: string | null
    user: {
      id: string
      name: string
      email: string
      lastLoginAt: string | null
    }
    riskProfile: {
      riskLevel: string
      overallScore: number
      lastComputedAt: string
    } | null
    locationProfile: {
      id: string
      village: string | null
      taluka: string | null
      district: string | null
      pincode: string | null
      latitude: number
      longitude: number
      elevationMetres: number | null
      terrainType: string | null
      nearestHospitalName: string | null
      nearestHospitalDistanceKm: number | null
      nearestPoliceStationName: string | null
      nearestPoliceStationDistanceKm: number | null
      nearestFireStationName: string | null
      nearestFireStationDistanceKm: number | null
      nearestWaterBodyName: string | null
      nearestWaterBodyDistanceMetres: number | null
      nearestRoadType: string | null
      nearestPavedRoadDistanceMetres: number | null
      powerSupplyType: string | null
      connectivityType: string | null
      batchStatus: string
    } | null
    stockItems: Array<{
      id: string
      name: string
      category: string
      quantity: number
      estimatedValueInr: number
    }>
    alertRecipients: Array<{
      id: string
      alertId: string
      title: string
      severity: string
      category: string
      issuedAt: string
      summary: string
    }>
    queries: Array<{
      id: string
      queryType: string
      status: string
      priority: string
      description: string
      createdAt: string
      assignedTo: {
        name: string
      } | null
    }>
    bCPPlan: {
      completionPercent: number
      beforeSteps: number
      beforeStepsCompleted: number
      duringSteps: number
      duringStepsCompleted: number
      afterSteps: number
      afterStepsCompleted: number
    } | null
  }
}

export const loader: LoaderFunction = async ({ request, params }) => {
  try {
    // Require LRDB role
    const officer = await requireRole(request, 'lrdb')

    // Fetch LRDB profile to get regionCode
    const lrdbProfile = await db.lRDBOfficer.findUnique({
      where: { userId: officer.id },
    })

    if (!lrdbProfile) {
      throw new Response('LRDB profile not found', { status: 404 })
    }

    // Fetch shop with all relations
    const shop = await db.shopProfile.findUnique({
      where: { id: params.shopId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            lastLoginAt: true,
          },
        },
        riskProfile: true,
        locationProfile: true,
        stockItems: {
          take: 5,
          orderBy: { estimatedValueInr: 'desc' },
        },
        queries: {
          orderBy: { createdAt: 'desc' },
          include: {
            assignedTo: {
              select: { name: true },
            },
          },
        },
        bcpPlan: true,
      },
    })

    if (!shop) {
      throw new Response('Shop not found', { status: 404 })
    }

    // Verify shop belongs to officer's region
    if (shop.regionCode !== lrdbProfile.regionCode) {
      throw new Response('Unauthorized', { status: 403 })
    }

    // Fetch alert recipients separately (no direct relation on ShopProfile)
    const alertRecipients = await db.alertRecipient.findMany({
      where: { userId: shop.userId },
      take: 5,
      orderBy: { alert: { createdAt: 'desc' } },
      include: { alert: true },
    })

    return json<ShopDetailLoaderData>({
      shop: {
        id: shop.id,
        shopName: shop.shopName,
        category: shop.category,
        gstNumber: shop.gstNumber,
        shopAreaSqFt: shop.locationProfile?.shopAreaSqFt ?? null,
        establishedYear: shop.establishedYear,
        createdAt: shop.createdAt.toISOString(),
        phoneNumber: shop.phoneNumber,
        user: {
          id: shop.user.id,
          name: shop.user.name,
          email: shop.user.email,
          lastLoginAt: shop.user.lastLoginAt?.toISOString() ?? null,
        },
        riskProfile: shop.riskProfile ? {
          riskLevel: shop.riskProfile.riskLevel,
          overallScore: shop.riskProfile.overallScore,
          lastComputedAt: shop.riskProfile.lastComputedAt.toISOString(),
        } : null,
        locationProfile: shop.locationProfile ? {
          id: shop.locationProfile.id,
          village: shop.locationProfile.village,
          taluka: shop.locationProfile.taluka,
          district: shop.locationProfile.district,
          pincode: shop.locationProfile.pincode,
          latitude: shop.locationProfile.latitude,
          longitude: shop.locationProfile.longitude,
          elevationMetres: shop.locationProfile.elevationMetres,
          terrainType: shop.locationProfile.terrainType as string ?? null,
          nearestHospitalName: shop.locationProfile.nearestHospitalName,
          nearestHospitalDistanceKm: shop.locationProfile.nearestHospitalDistanceKm,
          nearestPoliceStationName: shop.locationProfile.nearestPoliceStationName,
          nearestPoliceStationDistanceKm: shop.locationProfile.nearestPoliceStationDistanceKm,
          nearestFireStationName: shop.locationProfile.nearestFireStationName,
          nearestFireStationDistanceKm: shop.locationProfile.nearestFireStationDistanceKm,
          nearestWaterBodyName: shop.locationProfile.nearestWaterBodyName,
          nearestWaterBodyDistanceMetres: shop.locationProfile.nearestWaterBodyDistanceMetres,
          nearestRoadType: shop.locationProfile.nearestRoadType as string ?? null,
          nearestPavedRoadDistanceMetres: shop.locationProfile.nearestPavedRoadDistanceMetres,
          powerSupplyType: shop.locationProfile.powerSupplyType as string ?? null,
          connectivityType: shop.locationProfile.connectivityType as string ?? null,
          batchStatus: shop.locationProfile.batchStatus as string,
        } : null,
        stockItems: shop.stockItems.map((item: any) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          estimatedValueInr: item.estimatedValueInr,
        })),
        alertRecipients: alertRecipients.map((r: any) => ({
          id: r.id,
          alertId: r.alert.id,
          title: r.alert.title,
          severity: r.alert.severity.toLowerCase(),
          category: r.alert.category,
          issuedAt: r.alert.createdAt.toISOString(),
          summary: r.alert.summary,
        })),
        queries: shop.queries.map((q: any) => ({
          id: q.id,
          queryType: q.queryType,
          status: q.status,
          priority: q.priority,
          description: q.description,
          createdAt: q.createdAt.toISOString(),
          assignedTo: q.assignedTo ? { name: q.assignedTo.name } : null,
        })),
        bCPPlan: shop.bcpPlan ? {
          completionPercent: shop.bcpPlan.completionPercent,
          beforeSteps: 0,
          beforeStepsCompleted: 0,
          duringSteps: 0,
          duringStepsCompleted: 0,
          afterSteps: 0,
          afterStepsCompleted: 0,
        } : null,
      },
    })
  } catch (error) {
    console.error('Shop Detail Loader Error:', error)
    throw error
  }
}

export default function ShopDetailPage() {
  const { shop } = useLoaderData<ShopDetailLoaderData>()

  const totalStockValue = shop.stockItems.reduce((sum, item) => sum + item.estimatedValueInr, 0)

  return (
    <Box sx={{ p: 3 }}>
      {/* Page Header */}
      <PageHeader
        title={shop.shopName}
        subtitle={shop.category}
        breadcrumb={[{ label: 'Shops' }, { label: shop.shopName }]}
        action={
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button>
              <Send className="w-4 h-4 mr-2" />
              Send Message
            </Button>
            <Button variant="outline">Create Query</Button>
          </Box>
        }
      />

      {/* Risk Badge */}
      <Box sx={{ mt: 2 }}>
        {shop.riskProfile && (
          <RiskBadge level={shop.riskProfile.riskLevel.toLowerCase() as any} size="lg" />
        )}
      </Box>

      {/* Overview Cards */}
      <Grid container spacing={2} sx={{ mt: 2 }}>
        {/* Business Profile Card */}
        <Grid item xs={12} md={4}>
          <SectionCard title="Business Profile">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="caption" className="text-muted-foreground">
                  Owner Name
                </Typography>
                <Typography variant="body2">{shop.user?.name || 'N/A'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Phone className="w-4 h-4" />
                <Typography variant="body2">{shop.phoneNumber || 'N/A'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Mail className="w-4 h-4" />
                <Typography variant="body2">{shop.user?.email || 'N/A'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" className="text-muted-foreground">
                  GST Number
                </Typography>
                <Typography variant="body2">{shop.gstNumber || 'N/A'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" className="text-muted-foreground">
                  Shop Area
                </Typography>
                <Typography variant="body2">{shop.shopAreaSqFt || 'N/A'} sq ft</Typography>
              </Box>
              <Box>
                <Typography variant="caption" className="text-muted-foreground">
                  Established Year
                </Typography>
                <Typography variant="body2">{shop.establishedYear || 'N/A'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" className="text-muted-foreground">
                  Registration Date
                </Typography>
                <Typography variant="body2">
                  {format(new Date(shop.createdAt), 'MMM dd, yyyy')}
                </Typography>
              </Box>
            </Box>
          </SectionCard>
        </Grid>

        {/* Location Card */}
        <Grid item xs={12} md={4}>
          <SectionCard title="Location">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
                <Box>
                  <Typography variant="body2">
                    {shop.locationProfile?.village}, {shop.locationProfile?.taluka},{' '}
                    {shop.locationProfile?.district} {shop.locationProfile?.pincode}
                  </Typography>
                </Box>
              </Box>
              <Box>
                <Typography variant="caption" className="text-muted-foreground">
                  Elevation
                </Typography>
                <Typography variant="body2">{shop.locationProfile?.elevationMetres || 'N/A'} m</Typography>
              </Box>
              <Box>
                <Typography variant="caption" className="text-muted-foreground">
                  Terrain Type
                </Typography>
                <Typography variant="body2">{shop.locationProfile?.terrainType || 'N/A'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" className="text-muted-foreground">
                  Power Supply
                </Typography>
                <Typography variant="body2">{shop.locationProfile?.powerSupplyType || 'N/A'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" className="text-muted-foreground">
                  Connectivity
                </Typography>
                <Typography variant="body2">{shop.locationProfile?.connectivityType || 'N/A'}</Typography>
              </Box>
              {shop.locationProfile?.batchStatus === 'PENDING' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: '#fff3cd', borderRadius: 1 }}>
                  <StatusIndicator status="degraded" />
                  <Typography variant="caption">Location data still being enriched</Typography>
                </Box>
              )}
            </Box>
          </SectionCard>
        </Grid>

        {/* Risk Summary Card */}
        <Grid item xs={12} md={4}>
          <SectionCard title="Risk Summary">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {shop.riskProfile && (
                <>
                  <RiskBadge level={shop.riskProfile.riskLevel.toLowerCase() as any} size="lg" />
                  <Box>
                    <Typography variant="caption" className="text-muted-foreground">
                      Risk Score
                    </Typography>
                    <Progress value={shop.riskProfile.overallScore} max={100} />
                  </Box>
                  <Box>
                    <Typography variant="caption" className="text-muted-foreground">
                      Last Computed
                    </Typography>
                    <Typography variant="body2">
                      {format(new Date(shop.riskProfile.lastComputedAt), 'MMM dd, HH:mm')}
                    </Typography>
                  </Box>
                </>
              )}
            </Box>
          </SectionCard>
        </Grid>
      </Grid>

      {/* Stock Inventory Summary */}
      <SectionCard title="Inventory Overview" sx={{ mt: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" className="text-muted-foreground">
                Total Items: {shop.stockItems.length} | Estimated Value: ₹{totalStockValue.toLocaleString()}
              </Typography>
            </Box>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Value (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shop.stockItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">{item.name}</TableCell>
                    <TableCell className="text-sm">{item.category}</TableCell>
                    <TableCell className="text-sm">{item.estimatedValueInr.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Grid>
        </Grid>
      </SectionCard>

      {/* Location Risk Intelligence */}
      <SectionCard title="Location Risk Intelligence" sx={{ mt: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Proximity Data
            </Typography>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>Nearest Hospital</TableCell>
                  <TableCell>
                    {shop.locationProfile?.nearestHospitalName}
                    {shop.locationProfile?.nearestHospitalDistanceKm && (
                      <Typography variant="caption" className="text-muted-foreground ml-1">
                        ({shop.locationProfile.nearestHospitalDistanceKm} km)
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Nearest Police Station</TableCell>
                  <TableCell>
                    {shop.locationProfile?.nearestPoliceStationName}
                    {shop.locationProfile?.nearestPoliceStationDistanceKm && (
                      <Typography variant="caption" className="text-muted-foreground ml-1">
                        ({shop.locationProfile.nearestPoliceStationDistanceKm} km)
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Nearest Fire Station</TableCell>
                  <TableCell>
                    {shop.locationProfile?.nearestFireStationName}
                    {shop.locationProfile?.nearestFireStationDistanceKm && (
                      <Typography variant="caption" className="text-muted-foreground ml-1">
                        ({shop.locationProfile.nearestFireStationDistanceKm} km)
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Nearest Water Body</TableCell>
                  <TableCell>
                    {shop.locationProfile?.nearestWaterBodyName}
                    {shop.locationProfile?.nearestWaterBodyDistanceMetres &&
                      shop.locationProfile.nearestWaterBodyDistanceMetres < 200 && (
                        <Typography
                          variant="caption"
                          className="text-red-600 ml-1"
                          sx={{ fontWeight: 'bold' }}
                        >
                          ({shop.locationProfile.nearestWaterBodyDistanceMetres}m - CRITICAL)
                        </Typography>
                      )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Road Access</TableCell>
                  <TableCell>
                    {shop.locationProfile?.nearestRoadType}
                    {shop.locationProfile?.nearestPavedRoadDistanceMetres && (
                      <Typography variant="caption" className="text-muted-foreground ml-1">
                        ({shop.locationProfile.nearestPavedRoadDistanceMetres}m to paved road)
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Grid>
        </Grid>
      </SectionCard>

      {/* Alert History */}
      {shop.alertRecipients.length > 0 && (
        <SectionCard title="Alert History" sx={{ mt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {shop.alertRecipients.map((recipient) => (
              <AlertCard
                key={recipient.id}
                alertId={recipient.alertId}
                title={recipient.title}
                severity={recipient.severity as any}
                category={recipient.category}
                issuedAt={recipient.issuedAt}
                summary={recipient.summary}
                affectedItems={[]}
                isExpanded={false}
              />
            ))}
          </Box>
        </SectionCard>
      )}

      {/* BCP Completion Status */}
      {shop.bCPPlan && (
        <SectionCard title="Business Continuity Plan" sx={{ mt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="caption" className="text-muted-foreground">
                Overall Completion
              </Typography>
              <Progress value={shop.bCPPlan.completionPercent} max={100} />
            </Box>
          </Box>
        </SectionCard>
      )}

      {/* Query History */}
      {shop.queries.length > 0 && (
        <SectionCard title="Support Queries" sx={{ mt: 3 }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Query Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Assigned To</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shop.queries.map((query) => (
                <TableRow key={query.id}>
                  <TableCell className="text-sm">{query.queryType}</TableCell>
                  <TableCell className="text-sm">{query.status}</TableCell>
                  <TableCell className="text-sm">{query.priority}</TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(query.createdAt), 'MMM dd, HH:mm')}
                  </TableCell>
                  <TableCell className="text-sm">{query.assignedTo?.name || 'Unassigned'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      )}
    </Box>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    return (
      <ErrorCard
        title={`${error.status} Error`}
        message={error.statusText || 'An error occurred loading shop details'}
      />
    )
  }

  return <ErrorCard title="Error" message="An unexpected error occurred" />
}
