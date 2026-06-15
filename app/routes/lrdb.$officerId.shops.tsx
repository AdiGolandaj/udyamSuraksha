import { json, type LoaderFunction, type MetaFunction } from '@remix-run/node'
import { useLoaderData, useOutletContext, isRouteErrorResponse, useRouteError } from '@remix-run/react'
import { requireRole } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import {
  PageHeader,
  SectionCard,
  StatTile,
  RiskBadge,
  StatusIndicator,
  EmptyState,
  LoadingSkeleton,
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
import { useState } from 'react'
import { useSearchParams } from '@remix-run/react'
import { Grid, Box } from '@mui/material'
import { Store, AlertOctagon, AlertTriangle, WifiOff, Download, Send } from 'lucide-react'
import { useTranslation } from '~/hooks/useTranslation'
import { format } from 'date-fns'
import { Link } from '@remix-run/react'

export const meta: MetaFunction = () => [
  { title: 'Registered Shops | DisasterShield' },
]

interface ShopData {
  id: string
  userId: string
  shopName: string
  category: string
  user: {
    id: string
    name: string
    lastLoginAt: string | null
  }
  riskProfile: {
    riskLevel: string
    overallScore: number
  } | null
  locationProfile: {
    id: string
    village: string | null
    taluka: string | null
    latitude: number
    longitude: number
  } | null
  _count: {
    stockItems: number
  }
}

interface ShopsLoaderData {
  regionCode: string
  district: string
  taluka: string
  shops: ShopData[]
  stats: {
    totalRegistered: number
    criticalRisk: number
    highRisk: number
    offlineUnreachable: number
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

    const { regionCode, district, taluka } = lrdbProfile

    // Get URL search params for filtering
    const url = new URL(request.url)
    const searchQuery = url.searchParams.get('search')?.toLowerCase() || ''
    const riskFilter = url.searchParams.get('risk')
    const categoryFilter = url.searchParams.get('category')
    const sortBy = url.searchParams.get('sort') || 'riskLevel'

    // Build where clause
    const whereClause: any = {
      locationProfile: {
        regionCode,
      },
    }

    if (searchQuery) {
      whereClause.OR = [
        { shopName: { contains: searchQuery, mode: 'insensitive' } },
        { user: { name: { contains: searchQuery, mode: 'insensitive' } } },
      ]
    }

    if (categoryFilter) {
      whereClause.category = categoryFilter
    }

    // Fetch all shops with relations
    const allShops = await db.shopProfile.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            lastLoginAt: true,
          },
        },
        riskProfile: true,
        locationProfile: true,
        _count: {
          select: {
            stockItems: true,
          },
        },
      },
    })

    // Apply risk filter
    let shops = allShops
    if (riskFilter && riskFilter !== 'all') {
      if (riskFilter === 'offline') {
        shops = allShops.filter((shop) => {
          const lastLogin = shop.user?.lastLoginAt
          if (!lastLogin) return true
          const hoursSinceLogin = (Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60)
          return hoursSinceLogin > 72
        })
      } else {
        shops = allShops.filter((shop) => shop.riskProfile?.riskLevel === riskFilter.toUpperCase())
      }
    }

    // Apply sorting
    if (sortBy === 'name') {
      shops.sort((a, b) => (a.shopName || '').localeCompare(b.shopName || ''))
    } else if (sortBy === 'lastActive') {
      shops.sort((a, b) => {
        const aTime = a.user?.lastLoginAt ? new Date(a.user.lastLoginAt as unknown as string).getTime() : 0
        const bTime = b.user?.lastLoginAt ? new Date(b.user.lastLoginAt as unknown as string).getTime() : 0
        return bTime - aTime
      })
    } else if (sortBy === 'date') {
      shops.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    } else {
      // Default: risk level
      const riskOrder = { CRITICAL: 0, HIGH: 1, MODERATE: 2, SAFE: 3 }
      shops.sort((a, b) => {
        const aRisk = riskOrder[a.riskProfile?.riskLevel as keyof typeof riskOrder] || 99
        const bRisk = riskOrder[b.riskProfile?.riskLevel as keyof typeof riskOrder] || 99
        return aRisk - bRisk
      })
    }

    // Calculate stats
    const stats = {
      totalRegistered: allShops.length,
      criticalRisk: allShops.filter((s) => s.riskProfile?.riskLevel === 'CRITICAL').length,
      highRisk: allShops.filter((s) => s.riskProfile?.riskLevel === 'HIGH').length,
      offlineUnreachable: allShops.filter((s) => {
        const lastLogin = s.user?.lastLoginAt
        if (!lastLogin) return true
        const hoursSinceLogin = (Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60)
        return hoursSinceLogin > 72
      }).length,
    }

    const mappedShops: ShopData[] = shops.map(s => ({
      id: s.id,
      userId: s.userId,
      shopName: s.shopName,
      category: s.category,
      user: {
        id: s.user.id,
        name: s.user.name,
        lastLoginAt: s.user.lastLoginAt?.toISOString() ?? null,
      },
      riskProfile: s.riskProfile ? {
        riskLevel: s.riskProfile.riskLevel,
        overallScore: s.riskProfile.overallScore,
      } : null,
      locationProfile: s.locationProfile ? {
        id: s.locationProfile.id,
        village: s.locationProfile.village,
        taluka: s.locationProfile.taluka,
        latitude: s.locationProfile.latitude,
        longitude: s.locationProfile.longitude,
      } : null,
      _count: s._count,
    }))

    return json<ShopsLoaderData>({
      regionCode,
      district: district ?? '',
      taluka: taluka ?? '',
      shops: mappedShops,
      stats,
    })
  } catch (error) {
    console.error('Shops Loader Error:', error)
    throw error
  }
}

export default function ShopsPage() {
  const { district, taluka, shops, stats } = useLoaderData<ShopsLoaderData>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useTranslation()

  const currentSearch = searchParams.get('search') || ''
  const currentRisk = searchParams.get('risk') || 'all'
  const currentSort = searchParams.get('sort') || 'riskLevel'

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

  return (
    <Box sx={{ p: 3 }}>
      {/* Page Header */}
      <PageHeader
        title="Registered Shops"
        subtitle={`${district}, ${taluka} — ${stats.totalRegistered} businesses registered`}
        action={
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export List
            </Button>
            <Button>
              <Send className="w-4 h-4 mr-2" />
              Send Broadcast
            </Button>
          </Box>
        }
      />

      {/* Summary Stats */}
      <Grid container spacing={2} sx={{ mt: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            label="Total Registered"
            value={stats.totalRegistered}
            icon={Store}
            variant="default"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            label="Critical Risk"
            value={stats.criticalRisk}
            icon={AlertOctagon}
            variant="danger"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            label="High Risk"
            value={stats.highRisk}
            icon={AlertTriangle}
            variant="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            label="Offline / Unreachable"
            value={stats.offlineUnreachable}
            icon={WifiOff}
            variant="default"
          />
        </Grid>
      </Grid>

      {/* Filter Bar */}
      <SectionCard title="Filters" sx={{ mt: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Input
              placeholder="Search by shop or owner name"
              value={currentSearch}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Select value={currentRisk} onValueChange={(value) => handleFilterChange('risk', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Shops</SelectItem>
                <SelectItem value="SAFE">Safe</SelectItem>
                <SelectItem value="MODERATE">Moderate</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
              </SelectContent>
            </Select>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Select value={currentSort} onValueChange={(value) => handleFilterChange('sort', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="riskLevel">Risk Level</SelectItem>
                <SelectItem value="name">Shop Name</SelectItem>
                <SelectItem value="lastActive">Last Active</SelectItem>
                <SelectItem value="date">Registration Date</SelectItem>
              </SelectContent>
            </Select>
          </Grid>
        </Grid>
      </SectionCard>

      {/* Shops Table */}
      <SectionCard title="Shops List" sx={{ mt: 3 }}>
        {shops.length === 0 ? (
          <EmptyState
            icon={Store}
            title="No shops found"
            description="No shops registered in your region yet."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shop</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Risk Level</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead>Stock Items</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shops.map((shop) => (
                <TableRow key={shop.id}>
                  <TableCell className="font-medium">{shop.shopName}</TableCell>
                  <TableCell>
                    <div className="text-sm">{shop.user?.name}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {shop.locationProfile?.village}, {shop.locationProfile?.taluka}
                    </div>
                  </TableCell>
                  <TableCell>
                    {shop.riskProfile && (
                      <RiskBadge level={shop.riskProfile.riskLevel.toLowerCase() as any} />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {shop.user?.lastLoginAt ? (
                        <>
                          <StatusIndicator
                            status={
                              (Date.now() - new Date(shop.user.lastLoginAt).getTime()) / (1000 * 60 * 60) >
                              72
                                ? 'offline'
                                : 'online'
                            }
                          />
                          <span className="text-sm">
                            {format(new Date(shop.user.lastLoginAt), 'MMM dd, HH:mm')}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">Never</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{shop._count.stockItems}</TableCell>
                  <TableCell>
                    <Link to={`../shops/${shop.id}`}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
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
        message={error.statusText || 'An error occurred loading shops'}
      />
    )
  }

  return <ErrorCard title="Error" message="An unexpected error occurred" />
}
