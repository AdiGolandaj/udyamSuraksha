import {
  json,
  type LoaderFunction,
  type MetaFunction,
  type ActionFunction,
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
  StatTile,
  StockItemRow,
  EmptyState,
  LoadingSkeleton,
  ErrorCard,
} from '~/components/shared'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Package, Search, Plus } from 'lucide-react'
import { useTranslation } from '~/hooks/useTranslation'
import { Grid } from '@mui/material'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'

interface StockLoaderData {
  userId: string
  shopId: string
  totalItems: number
  totalValue: number
  highRiskCount: number
  stockItems: Array<{
    id: string
    name: string
    category: string
    quantity: number
    unit: string
    estimatedValue: number
    vulnerabilityScore: number
    expiryDate?: string
    sensitivities: string[]
  }>
  categories: string[]
}

const stockItemSchema = z.object({
  name: z.string().min(1, 'Name required'),
  category: z.string().min(1, 'Category required'),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.enum(['kg', 'litres', 'units', 'boxes', 'bags', 'metres']),
  estimatedValueInr: z.number().nonnegative('Value must be non-negative'),
  sensitivities: z.array(z.string()).min(1, 'Select at least one sensitivity'),
  expiryDate: z.string().optional(),
  storageLocation: z.string().optional(),
  notes: z.string().optional(),
})

export const meta: MetaFunction = () => [
  { title: 'Stock Management | DisasterShield' },
]

export const loader: LoaderFunction = async ({ request, params }) => {
  try {
    const user = await requireAuthenticatedUser(request)

    if (user.id !== params.userId || user.role !== 'msme') {
      throw new Response('Unauthorized', { status: 403 })
    }

    const shopProfile = await db.shopProfile.findUnique({
      where: { userId: user.id },
      include: {
        stockItems: {
          include: { sensitivities: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!shopProfile) {
      throw new Response('Shop profile not found', { status: 404 })
    }

    const stockItems = shopProfile.stockItems
    const totalValue = stockItems.reduce((sum, item) => sum + item.estimatedValueInr, 0)
    const highRiskCount = stockItems.filter(item => item.vulnerabilityScore > 70).length

    const loaderData: StockLoaderData = {
      userId: user.id,
      shopId: shopProfile.id,
      totalItems: stockItems.length,
      totalValue,
      highRiskCount,
      stockItems: stockItems.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        estimatedValue: item.estimatedValueInr,
        vulnerabilityScore: item.vulnerabilityScore,
        expiryDate: item.expiryDate?.toISOString().split('T')[0],
        sensitivities: item.sensitivities.map(s => s.type.toLowerCase()),
      })),
      categories: Array.from(new Set(stockItems.map(item => item.category))),
    }

    return json(loaderData)
  } catch (error) {
    if (error instanceof Response) {
      throw error
    }
    throw new Response('Internal Server Error', { status: 500 })
  }
}

export const action: ActionFunction = async ({ request, params }) => {
  if (request.method !== 'POST') {
    throw new Response('Method not allowed', { status: 405 })
  }

  try {
    const user = await requireAuthenticatedUser(request)

    if (user.id !== params.userId || user.role !== 'msme') {
      throw new Response('Unauthorized', { status: 403 })
    }

    const formData = await request.formData()
    const body = Object.fromEntries(formData)

    const validatedData = stockItemSchema.parse({
      ...body,
      quantity: parseFloat(body.quantity as string),
      estimatedValueInr: parseFloat(body.estimatedValueInr as string),
      sensitivities: (body.sensitivities as string)?.split(',') || [],
    })

    const shopProfile = await db.shopProfile.findUnique({
      where: { userId: user.id },
    })

    if (!shopProfile) {
      throw new Response('Shop profile not found', { status: 404 })
    }

    // Create stock item
    const stockItem = await db.stockItem.create({
      data: {
        shopProfileId: shopProfile.id,
        name: validatedData.name,
        category: validatedData.category,
        quantity: validatedData.quantity,
        unit: validatedData.unit,
        estimatedValueInr: validatedData.estimatedValueInr,
        storageLocation: validatedData.storageLocation,
        expiryDate: validatedData.expiryDate ? new Date(validatedData.expiryDate) : null,
        notes: validatedData.notes,
      },
    })

    // Add sensitivities
    await Promise.all(
      validatedData.sensitivities.map(sensitivity =>
        db.stockSensitivity.create({
          data: {
            stockItemId: stockItem.id,
            type: sensitivity.toUpperCase() as any,
          },
        })
      )
    )

    // Call Python API to recompute risk
    await apiClient.post('/risk/score', {
      shopId: shopProfile.id,
    })

    return json({ success: true, itemId: stockItem.id })
  } catch (error) {
    if (error instanceof Response) {
      throw error
    }
    console.error('Stock action error:', error)
    throw new Response('Failed to create stock item', { status: 400 })
  }
}

function AddStockDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const fetcher = useFetcher()
  const form = useForm({
    resolver: zodResolver(stockItemSchema),
    defaultValues: {
      name: '',
      category: '',
      quantity: 0,
      unit: 'units' as const,
      estimatedValueInr: 0,
      sensitivities: [],
    },
  })

  const sensitivityOptions = [
    'water',
    'heat',
    'fragile',
    'perishable',
    'flammable',
    'theft',
    'humidity',
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          {t('stock.addItem')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('stock.addItemDialog.title')}</DialogTitle>
        </DialogHeader>
        <fetcher.Form method="POST" className="space-y-4">
          <div>
            <label className="text-sm font-medium">{t('stock.form.name')}</label>
            <Input
              name="name"
              placeholder="e.g., Rice Bags"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('stock.form.category')}</label>
            <Input
              name="category"
              placeholder="e.g., Grains"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium">
                {t('stock.form.quantity')}
              </label>
              <Input
                name="quantity"
                type="number"
                placeholder="100"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('stock.form.unit')}</label>
              <Select name="unit" defaultValue="units">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="litres">litres</SelectItem>
                  <SelectItem value="units">units</SelectItem>
                  <SelectItem value="boxes">boxes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">
              {t('stock.form.estimatedValue')}
            </label>
            <Input
              name="estimatedValueInr"
              type="number"
              placeholder="1000"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              {t('stock.form.sensitivities')}
            </label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {sensitivityOptions.map(option => (
                <label key={option} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="sensitivities"
                    value={option}
                  />
                  <span className="text-sm capitalize">{option}</span>
                </label>
              ))}
            </div>
          </div>
          <Button
            type="submit"
            disabled={fetcher.state === 'submitting'}
            className="w-full"
          >
            {fetcher.state === 'submitting'
              ? t('stock.form.submitting')
              : t('stock.form.submit')}
          </Button>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  )
}

export default function StockManagement() {
  const { t } = useTranslation()
  const { userId, shopId, totalItems, totalValue, highRiskCount, stockItems, categories } =
    useLoaderData<StockLoaderData>()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('name')

  const filteredItems = stockItems
    .filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory =
        selectedCategory === 'all' || item.category === selectedCategory
      return matchesSearch && matchesCategory
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'value':
          return b.estimatedValue - a.estimatedValue
        case 'vulnerability':
          return b.vulnerabilityScore - a.vulnerabilityScore
        default:
          return a.name.localeCompare(b.name)
      }
    })

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Section 3.1: Page Header */}
      <PageHeader
        title={t('stock.title')}
        subtitle={t('stock.subtitle')}
        action={<AddStockDialog />}
      />

      {/* Section 3.2: Summary Tiles */}
      <Grid container spacing={2}>
        <Grid item xs={6} sm={4} md={4}>
          <StatTile
            label={t('stock.summary.totalItems')}
            value={totalItems}
            icon={Package}
            variant="default"
          />
        </Grid>
        <Grid item xs={6} sm={4} md={4}>
          <StatTile
            label={t('stock.summary.totalValue')}
            value={`₹${(totalValue / 100000).toFixed(1)}L`}
            icon={Package}
            variant="default"
          />
        </Grid>
        <Grid item xs={6} sm={4} md={4}>
          <StatTile
            label={t('stock.summary.highRisk')}
            value={highRiskCount}
            icon={Package}
            variant={highRiskCount > 0 ? 'danger' : 'success'}
          />
        </Grid>
      </Grid>

      {/* Section 3.3: Filter & Search Bar */}
      <SectionCard>
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('stock.filter.search')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t('stock.filter.category')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('stock.filter.allCategories')}</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t('stock.filter.sortBy')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">{t('stock.filter.sortName')}</SelectItem>
                <SelectItem value="value">{t('stock.filter.sortValue')}</SelectItem>
                <SelectItem value="vulnerability">
                  {t('stock.filter.sortVulnerability')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      {/* Section 3.4: Stock Items Table / List */}
      <SectionCard noPadding>
        {filteredItems.length > 0 ? (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('stock.table.name')}</TableHead>
                    <TableHead>{t('stock.table.sensitivities')}</TableHead>
                    <TableHead>{t('stock.table.quantity')}</TableHead>
                    <TableHead>{t('stock.table.value')}</TableHead>
                    <TableHead>{t('stock.table.vulnerability')}</TableHead>
                    <TableHead>{t('stock.table.expiry')}</TableHead>
                    <TableHead>{t('stock.table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-text-secondary">
                            {item.category}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {item.sensitivities.slice(0, 3).map(s => (
                            <span
                              key={s}
                              className="px-2 py-1 bg-surface-secondary rounded text-xs capitalize"
                            >
                              {s}
                            </span>
                          ))}
                          {item.sensitivities.length > 3 && (
                            <span className="text-xs text-text-secondary">
                              +{item.sensitivities.length - 3}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.quantity} {item.unit}
                      </TableCell>
                      <TableCell>₹{item.estimatedValue.toLocaleString()}</TableCell>
                      <TableCell>
                        <div
                          className={`w-16 h-2 rounded-full ${
                            item.vulnerabilityScore > 70
                              ? 'bg-red-500'
                              : item.vulnerabilityScore > 40
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                          }`}
                        />
                        <span className="text-xs">{item.vulnerabilityScore}%</span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.expiryDate ? (
                          <span
                            className={
                              new Date(item.expiryDate) < new Date(
                                Date.now() + 7 * 24 * 60 * 60 * 1000
                              )
                                ? 'text-red-600 font-semibold'
                                : ''
                            }
                          >
                            {item.expiryDate}
                          </span>
                        ) : (
                          'N/A'
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a href={`/msme/${userId}/stock/${item.id}`}>
                            {t('stock.table.view')}
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden space-y-3 p-4">
              {filteredItems.map(item => (
                <a
                  key={item.id}
                  href={`/msme/${userId}/stock/${item.id}`}
                  className="block p-4 border rounded-lg hover:bg-surface-secondary transition"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-text-secondary">{item.category}</p>
                    </div>
                    <span className="text-xs font-semibold">
                      {item.vulnerabilityScore}%
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mb-2">
                    {item.quantity} {item.unit} • ₹{item.estimatedValue}
                  </p>
                  <div className="flex gap-1 flex-wrap">
                    {item.sensitivities.map(s => (
                      <span
                        key={s}
                        className="px-2 py-1 bg-surface-secondary rounded text-xs capitalize"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </a>
              ))}
            </div>
          </>
        ) : (
          <div className="p-4">
            <EmptyState
              icon={Package}
              title={t('stock.empty.title')}
              description={t('stock.empty.description')}
              action={{
                label: t('stock.empty.action'),
                onClick: () => {},
              }}
            />
          </div>
        )}
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
        />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <ErrorCard
        title="Error"
        message="An unexpected error occurred. Please try again."
      />
    </div>
  )
}
