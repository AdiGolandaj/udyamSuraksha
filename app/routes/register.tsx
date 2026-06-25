'use client'

import leafletStyles from 'leaflet/dist/leaflet.css?url'
import { useState, useEffect, useRef } from 'react'
import { json, type LoaderFunctionArgs, type ActionFunctionArgs, redirect } from '@remix-run/node'
import { useLoaderData, useFetcher, useRevalidator } from '@remix-run/react'
import { z } from 'zod'
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Navigation,
  Store,
} from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Switch } from '~/components/ui/switch'
import { Checkbox } from '~/components/ui/checkbox'
import { Progress } from '~/components/ui/progress'
import { requireUser } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import { apiClient } from '~/lib/api.server'
import {
  registerSchema,
  locationGeocodingSchema,
  locationAddressSchema,
  buildingDetailsSchema,
  preferencesSchema,
  type RegisterInput,
} from '~/lib/schemas/registerSchema'

/**
 * Nominatim API Response Type
 */
interface NominatimResponse {
  address?: {
    neighbourhood?: string
    suburb?: string
    residential?: string
    quarter?: string
    village?: string
    town?: string
    city?: string
    city_district?: string
    municipality?: string
    county?: string
    state_district?: string
    postcode?: string
  }
  lat?: string
  lon?: string
}

/**
 * Open-Elevation API Response Type
 */
interface ElevationResponse {
  results?: Array<{
    elevation: number | null
  }>
}

export const links = () => [{ rel: 'stylesheet', href: leafletStyles }]

/**
 * Loader: Verify user is authenticated and hasn't completed registration
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request)

  // If user already has a shopProfile or is LRDB, redirect to dashboard
  if (user.role === 'lrdb') {
    const lrdbProfile = await db.lRDBOfficer.findUnique({
      where: { userId: user.id },
    })
    if (lrdbProfile) {
      return redirect(`/lrdb/${user.id}/shops`)
    }
  }

  if (user.role === 'msme') {
    const shopProfile = await db.shopProfile.findUnique({
      where: { userId: user.id },
    })
    if (shopProfile) {
      return redirect(`/msme/${user.id}/dashboard`)
    }
  }

  return json({ user })
}

/**
 * Action: Handle different registration steps
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 })
  }

  const user = await requireUser(request)
  const formData = await request.formData()
  const intent = formData.get('intent')

  // ========== INTENT: GEOCODE ==========
  if (intent === 'geocode') {
    const lat = parseFloat(formData.get('latitude') as string)
    const lng = parseFloat(formData.get('longitude') as string)

    if (isNaN(lat) || isNaN(lng)) {
      return json({ error: 'Invalid coordinates' }, { status: 400 })
    }

    try {
      // Call Nominatim for reverse geocoding
      const nominatimUrl = new URL(
        'https://nominatim.openstreetmap.org/reverse'
      )
      nominatimUrl.searchParams.set('lat', lat.toString())
      nominatimUrl.searchParams.set('lon', lng.toString())
      nominatimUrl.searchParams.set('format', 'json')

      const nominatimRes = await fetch(nominatimUrl.toString(), {
        headers: { 'User-Agent': 'DisasterShield' },
      })
      const nominatimData: NominatimResponse = await nominatimRes.json()

      // Call Open-Elevation for elevation
      const elevationUrl = new URL('https://api.open-elevation.com/api/v1/lookup')
      elevationUrl.searchParams.set('locations', `${lat},${lng}`)

      const elevationRes = await fetch(elevationUrl.toString())
      const elevationData: ElevationResponse = await elevationRes.json()

      const elevation = elevationData.results?.[0]?.elevation ?? null

      const address = nominatimData.address ?? {}

      return json({
        geocodeResult: {
          latitude: lat,
          longitude: lng,
          village: address.neighbourhood || address.suburb || address.residential || address.quarter || address.village || address.town || address.city || '',
          taluka: address.county || address.city_district || address.municipality || '',
          district: address.state_district || address.county || 'Pune',
          pincode: address.postcode || '',
          elevation: elevation,
        },
      })
    } catch (error) {
      console.error('Geocoding error:', error)
      return json(
        { error: 'Failed to fetch location details' },
        { status: 500 }
      )
    }
  }

  // ========== INTENT: COMPLETE REGISTRATION ==========
  if (intent === 'complete') {
    const raw = {
      role: formData.get('role'),
      shopName: formData.get('shopName'),
      category: formData.get('category'),
      ownerName: formData.get('ownerName'),
      phoneNumber: formData.get('phoneNumber'),
      gstNumber: formData.get('gstNumber') || undefined,
      establishedYear: formData.get('establishedYear') ? parseInt(formData.get('establishedYear') as string) : undefined,
      latitude: parseFloat(formData.get('latitude') as string),
      longitude: parseFloat(formData.get('longitude') as string),
      manuallySet: formData.get('manuallySet') === 'true',
      village: formData.get('village'),
      taluka: formData.get('taluka'),
      district: formData.get('district'),
      pincode: formData.get('pincode'),
      powerSupplyType: formData.get('powerSupplyType'),
      connectivityType: formData.get('connectivityType'),
      shopFloorLevel: formData.get('shopFloorLevel'),
      buildingType: formData.get('buildingType'),
      roofType: formData.get('roofType'),
      hasBasement: formData.get('hasBasement') === 'true',
      storageFloorLevel: formData.get('storageFloorLevel'),
      shopAreaSqFt: formData.get('shopAreaSqFt') ? parseInt(formData.get('shopAreaSqFt') as string) : undefined,
      language: formData.get('language'),
      notifyViaApp: formData.get('notifyViaApp') === 'true',
      notifyViaEmail: formData.get('notifyViaEmail') === 'true',
      notifyViaSms: formData.get('notifyViaSms') === 'true',
      notifyViaWhatsapp: formData.get('notifyViaWhatsapp') === 'true',
      emergencyContactName: formData.get('emergencyContactName'),
      emergencyContactPhone: formData.get('emergencyContactPhone'),
      emergencyContactRelationship: formData.get('emergencyContactRelationship'),
    }

    // Validate
    const parsed = registerSchema.safeParse(raw)
    if (!parsed.success) {
      return json({ errors: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data

    try {
      // Create shop profile
      const shopProfile = await db.shopProfile.create({
        data: {
          userId: user.id,
          shopName: data.shopName!,
          category: data.category!,
          phoneNumber: data.phoneNumber,
          gstNumber: data.gstNumber,
          establishedYear: data.establishedYear,
          address: `${data.village}, ${data.taluka}, ${data.district}`,
          district: data.district!,
          taluka: data.taluka!,
          pincode: data.pincode!,
          latitude: data.latitude,
          longitude: data.longitude,
          regionCode: `${data.district}-${data.taluka}`.toLowerCase(),
        },
      })

      // Create location profile
      await db.locationProfile.create({
        data: {
          shopProfileId: shopProfile.id,
          latitude: data.latitude,
          longitude: data.longitude,
          manuallySet: data.manuallySet,
          village: data.village,
          taluka: data.taluka,
          district: data.district,
          pincode: data.pincode,
          powerSupplyType: data.powerSupplyType,
          connectivityType: data.connectivityType,
          shopFloorLevel: data.shopFloorLevel,
          buildingType: data.buildingType,
          roofType: data.roofType,
          hasBasement: data.hasBasement,
          storageFloorLevel: data.storageFloorLevel,
          shopAreaSqFt: data.shopAreaSqFt,
          batchStatus: 'PENDING',
        },
      })

      // Create emergency contact
      await db.emergencyContact.create({
        data: {
          userId: user.id,
          name: data.emergencyContactName!,
          phone: data.emergencyContactPhone!,
          relationship: data.emergencyContactRelationship!,
          isPrimary: true,
        },
      })

      // Update user with role, language, and notification preferences
      await db.user.update({
        where: { id: user.id },
        data: {
          role: data.role === 'msme' ? 'MSME' : 'LRDB',
          language: data.language === 'en' ? 'en' : data.language === 'mr' ? 'mr' : 'hi',
          notifyViaApp: data.notifyViaApp,
          notifyViaEmail: data.notifyViaEmail,
          notifyViaSms: data.notifyViaSms,
          notifyViaWhatsapp: data.notifyViaWhatsapp,
        },
      })

      // Trigger background enrichment (fire and forget)
      try {
        await apiClient.post('/location/enrich', {
          lat: data.latitude,
          lng: data.longitude,
          locationProfileId: shopProfile.id,
        })
      } catch (error) {
        // Log but don't fail - this runs in background
        console.error('Background enrichment failed:', error)
      }

      // Redirect to dashboard
      return redirect(`/msme/${user.id}/dashboard`)
    } catch (error) {
      console.error('Registration error:', error)
      return json({ error: 'Failed to complete registration' }, { status: 500 })
    }
  }

  return json({ error: 'Unknown intent' }, { status: 400 })
}

/**
 * RegisterForm Component
 */
interface Step {
  number: number
  title: string
  description: string
}

const STEPS: Step[] = [
  {
    number: 1,
    title: 'Role Selection',
    description: 'Choose your role',
  },
  {
    number: 2,
    title: 'Business Details',
    description: 'Tell us about your shop',
  },
  {
    number: 3,
    title: 'Location',
    description: 'Set your location',
  },
  {
    number: 4,
    title: 'Preferences',
    description: 'Finalize your settings',
  },
]

interface LocationGeocodeResult {
  latitude: number
  longitude: number
  village: string
  taluka: string
  district: string
  pincode: string
  elevation: number | null
}

export default function RegisterPage() {
  const { user } = useLoaderData<typeof loader>()
  const fetcher = useFetcher()
  const revalidator = useRevalidator()

  // Form state
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<Partial<RegisterInput>>({
    role: 'msme',
    ownerName: user.name,
    language: 'en',
    hasBasement: false,
    notifyViaApp: true,
    notifyViaEmail: true,
    notifyViaSms: false,
    notifyViaWhatsapp: false,
  })

  // Geolocation and location state
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [geocodeResult, setGeocodeResult] = useState<LocationGeocodeResult | null>(null)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const marker = useRef<any>(null)

  // Handle form field changes
  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Request geolocation
  const handleRequestGeolocation = async () => {
    setGeoLoading(true)
    setGeoError(null)

    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser')
      setShowManualEntry(true)
      setGeoLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords

        console.info('[DisasterShield] Device location fetched:', { latitude, longitude, accuracy: `${position.coords.accuracy}m` })

        // Call server action to geocode
        const formDataToSend = new FormData()
        formDataToSend.append('intent', 'geocode')
        formDataToSend.append('latitude', latitude.toString())
        formDataToSend.append('longitude', longitude.toString())

        fetcher.submit(formDataToSend, { method: 'POST' })
      },
      (error) => {
        console.error('Geolocation error:', error)
        setGeoError('Could not access your location. Please enter manually.')
        setShowManualEntry(true)
        setGeoLoading(false)
      },
      { timeout: 15000, maximumAge: 0, enableHighAccuracy: true }
    )
  }

  // Handle geocoding response
  const fetcherData = fetcher.data as { geocodeResult?: LocationGeocodeResult; error?: string } | undefined
  useEffect(() => {
    if (fetcherData?.geocodeResult) {
      setGeocodeResult(fetcherData.geocodeResult)
      setFormData((prev) => ({
        ...prev,
        ...fetcherData!.geocodeResult,
      }))
      setGeoLoading(false)
    } else if (fetcherData?.error) {
      setGeoError(fetcherData.error)
      setGeoLoading(false)
    }
  }, [fetcherData?.geocodeResult, fetcherData?.error])

  // Leaflet map initialisation
  useEffect(() => {
    if (typeof window === 'undefined') return

    const onConfirmScreen = currentStep === 3 && !!geocodeResult && !showManualEntry
    const onManualScreen  = currentStep === 3 && showManualEntry

    if (!onConfirmScreen && !onManualScreen) {
      if (map.current) {
        map.current.remove()
        map.current = null
        marker.current = null
      }
      return
    }

    let cancelled = false

    const initMap = async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !mapContainer.current) return

      // Fix Vite asset bundling breaking default marker icons
      // @ts-expect-error private field
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const coords: [number, number] = geocodeResult
        ? [geocodeResult.latitude, geocodeResult.longitude]
        : [18.5204, 73.8567] // default: central Pune

      // Update existing map rather than recreating it
      if (map.current) {
        map.current.setView(coords, 15)
        marker.current?.setLatLng(coords)
        return
      }

      const leafletMap = L.map(mapContainer.current).setView(coords, 15)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(leafletMap)

      const leafletMarker = L.marker(coords, { draggable: onManualScreen }).addTo(leafletMap)

      if (onManualScreen) {
        const reverseGeocode = (lat: number, lng: number, source: 'drag' | 'click') => {
          console.info(`[DisasterShield] Map pointer placed (${source}):`, { latitude: lat, longitude: lng })
          const fd = new FormData()
          fd.append('intent', 'geocode')
          fd.append('latitude', lat.toString())
          fd.append('longitude', lng.toString())
          fetcher.submit(fd, { method: 'POST' })
          setGeoLoading(true)
        }
        leafletMarker.on('dragend', () => {
          const ll = leafletMarker.getLatLng()
          reverseGeocode(ll.lat, ll.lng, 'drag')
        })
        leafletMap.on('click', (e: any) => {
          leafletMarker.setLatLng(e.latlng)
          reverseGeocode(e.latlng.lat, e.latlng.lng, 'click')
        })
      }

      map.current = leafletMap
      marker.current = leafletMarker
    }

    initMap()
    return () => { cancelled = true }
  }, [currentStep, showManualEntry, geocodeResult])

  // Render steps
  const renderStep1 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">What best describes you?</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* MSME Owner Card */}
        <div
          className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
            formData.role === 'msme'
              ? 'border-brand-primary bg-brand-primary/5'
              : 'border-border hover:border-brand-primary/50'
          }`}
          onClick={() => handleFieldChange('role', 'msme')}
        >
          <div className="flex items-start gap-4">
            <Store
              className={`w-8 h-8 mt-1 ${
                formData.role === 'msme'
                  ? 'text-brand-primary'
                  : 'text-text-secondary'
              }`}
            />
            <div>
              <h3 className="font-bold text-lg mb-1">MSME Owner</h3>
              <p className="text-sm text-text-secondary">
                I own or manage a small business
              </p>
            </div>
          </div>
        </div>

        {/* LRDB Officer Card */}
        <div
          className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
            formData.role === 'lrdb'
              ? 'border-brand-primary bg-brand-primary/5'
              : 'border-border hover:border-brand-primary/50'
          }`}
          onClick={() => handleFieldChange('role', 'lrdb')}
        >
          <div className="flex items-start gap-4">
            <Building2
              className={`w-8 h-8 mt-1 ${
                formData.role === 'lrdb'
                  ? 'text-brand-primary'
                  : 'text-text-secondary'
              }`}
            />
            <div>
              <h3 className="font-bold text-lg mb-1">LRDB Officer</h3>
              <p className="text-sm text-text-secondary">
                I work for a local disaster management body
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Business Details</h2>

      <div className="space-y-4">
        <div>
          <Label htmlFor="shopName">Shop Name *</Label>
          <Input
            id="shopName"
            placeholder="Enter your shop name"
            value={formData.shopName || ''}
            onChange={(e) => handleFieldChange('shopName', e.target.value)}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="category">Business Category *</Label>
          <Select value={formData.category || ''} onValueChange={(value) => handleFieldChange('category', value)}>
            <SelectTrigger id="category" className="mt-2">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="grocery">Grocery Store</SelectItem>
              <SelectItem value="cloth">Cloth/Apparel</SelectItem>
              <SelectItem value="electronics">Electronics</SelectItem>
              <SelectItem value="pharmacy">Pharmacy</SelectItem>
              <SelectItem value="hardware">Hardware</SelectItem>
              <SelectItem value="restaurant">Restaurant/Food</SelectItem>
              <SelectItem value="textile">Textile/Tailoring</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="ownerName">Owner Full Name *</Label>
          <Input
            id="ownerName"
            placeholder="Your name"
            value={formData.ownerName || user?.name || ''}
            onChange={(e) => handleFieldChange('ownerName', e.target.value)}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="phoneNumber">Phone Number *</Label>
          <div className="flex gap-2 mt-2">
            <div className="flex items-center px-3 bg-surface-secondary rounded-md border border-border">
              <span className="text-text-secondary">+91</span>
            </div>
            <Input
              id="phoneNumber"
              placeholder="10-digit number"
              maxLength={10}
              value={formData.phoneNumber || ''}
              onChange={(e) =>
                handleFieldChange(
                  'phoneNumber',
                  e.target.value.replace(/\D/g, '')
                )
              }
              className="flex-1"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="gstNumber">GST Number (Optional)</Label>
          <Input
            id="gstNumber"
            placeholder="15-character GST ID"
            value={formData.gstNumber || ''}
            onChange={(e) => handleFieldChange('gstNumber', e.target.value)}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="establishedYear">Year Established (Optional)</Label>
          <Input
            id="establishedYear"
            type="number"
            placeholder="2020"
            min={1900}
            max={new Date().getFullYear()}
            value={formData.establishedYear || ''}
            onChange={(e) =>
              handleFieldChange('establishedYear', e.target.value)
            }
            className="mt-2"
          />
        </div>
      </div>
    </div>
  )

  const renderStep3LocationConfirm = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Confirm Your Location</h2>

      {geocodeResult && !showManualEntry && (
        <div className="space-y-4">
          <div
            ref={mapContainer}
            className="w-full h-64 rounded-lg border border-border overflow-hidden"
          />
          <Card className="p-6 bg-feedback-success/10 border-feedback-success">
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-feedback-success mt-0.5" />
              <div>
                <p className="font-semibold text-feedback-success mb-1">
                  Location detected successfully
                </p>
                <p className="text-sm text-text-secondary">
                  {geocodeResult.village}, {geocodeResult.district}
                  {geocodeResult.elevation && (
                    <span>, Elevation: {geocodeResult.elevation}m</span>
                  )}
                </p>
              </div>
            </div>
          </Card>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Location Details:</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-surface-secondary p-2 rounded">
                <p className="text-text-muted text-xs mb-1">Village/Area</p>
                <p className="font-medium">{geocodeResult.village}</p>
              </div>
              <div className="bg-surface-secondary p-2 rounded">
                <p className="text-text-muted text-xs mb-1">Taluka</p>
                <p className="font-medium">{geocodeResult.taluka}</p>
              </div>
              <div className="bg-surface-secondary p-2 rounded">
                <p className="text-text-muted text-xs mb-1">District</p>
                <p className="font-medium">{geocodeResult.district}</p>
              </div>
              <div className="bg-surface-secondary p-2 rounded">
                <p className="text-text-muted text-xs mb-1">Pincode</p>
                <p className="font-medium">{geocodeResult.pincode}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <Button
              type="button"
              size="lg"
              className="w-full bg-brand-primary hover:bg-brand-primary/90"
              onClick={() => {
                setCurrentStep(3.5) // Move to building details substep
              }}
            >
              <Check className="w-4 h-4 mr-2" />
              Yes, this is correct
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => setShowManualEntry(true)}
            >
              No, let me correct it
            </Button>
          </div>
        </div>
      )}
    </div>
  )

  const renderStep3Manual = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Set Your Location</h2>

      <div
        ref={mapContainer}
        className="w-full h-80 rounded-lg border border-border overflow-hidden bg-surface-secondary"
      />

      <div className="space-y-4">
        <div>
          <Label htmlFor="village">Village/Area *</Label>
          <Input
            id="village"
            placeholder="Village or area name"
            value={formData.village || ''}
            onChange={(e) => handleFieldChange('village', e.target.value)}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="taluka">Taluka *</Label>
          <Input
            id="taluka"
            placeholder="Taluka/Block"
            value={formData.taluka || ''}
            onChange={(e) => handleFieldChange('taluka', e.target.value)}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="district">District *</Label>
          <Input
            id="district"
            placeholder="District"
            value={formData.district || 'Pune'}
            onChange={(e) => handleFieldChange('district', e.target.value)}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="pincode">Pincode *</Label>
          <Input
            id="pincode"
            placeholder="6-digit pincode"
            maxLength={6}
            value={formData.pincode || ''}
            onChange={(e) =>
              handleFieldChange('pincode', e.target.value.replace(/\D/g, ''))
            }
            className="mt-2"
          />
        </div>
      </div>

      <Button
        type="button"
        size="lg"
        className="w-full bg-brand-primary hover:bg-brand-primary/90"
        onClick={() => setCurrentStep(3.5)}
      >
        Confirm Location
      </Button>
    </div>
  )

  const renderStep3Building = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Building & Infrastructure</h2>

      <div className="space-y-4">
        <div>
          <Label htmlFor="powerSupply">Power Supply Type *</Label>
          <Select
            value={formData.powerSupplyType || ''}
            onValueChange={(value) => handleFieldChange('powerSupplyType', value)}
          >
            <SelectTrigger id="powerSupply" className="mt-2">
              <SelectValue placeholder="Select power supply" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GRID">Grid</SelectItem>
              <SelectItem value="SOLAR">Solar</SelectItem>
              <SelectItem value="GENERATOR">Generator</SelectItem>
              <SelectItem value="MIXED">Mixed</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-text-muted mt-1">
            Helps us assess outage risk
          </p>
        </div>

        <div>
          <Label htmlFor="connectivity">Mobile Connectivity *</Label>
          <Select
            value={formData.connectivityType || ''}
            onValueChange={(value) => handleFieldChange('connectivityType', value)}
          >
            <SelectTrigger id="connectivity" className="mt-2">
              <SelectValue placeholder="Select connectivity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FOUR_G">4G</SelectItem>
              <SelectItem value="THREE_G">3G</SelectItem>
              <SelectItem value="TWO_G">2G</SelectItem>
              <SelectItem value="NONE">No Signal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="floorLevel">Shop Floor Level *</Label>
          <Select
            value={formData.shopFloorLevel || ''}
            onValueChange={(value) => handleFieldChange('shopFloorLevel', value)}
          >
            <SelectTrigger id="floorLevel" className="mt-2">
              <SelectValue placeholder="Select floor level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GROUND">Ground Floor</SelectItem>
              <SelectItem value="FIRST">First Floor</SelectItem>
              <SelectItem value="BASEMENT">Basement</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="buildingType">Building Construction Type *</Label>
          <Select
            value={formData.buildingType || ''}
            onValueChange={(value) => handleFieldChange('buildingType', value)}
          >
            <SelectTrigger id="buildingType" className="mt-2">
              <SelectValue placeholder="Select building type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PUCCA">Pucca (Concrete)</SelectItem>
              <SelectItem value="SEMI_PUCCA">Semi-Pucca</SelectItem>
              <SelectItem value="KUTCHA">Kutcha (Mud/Bamboo)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="roofType">Roof Type *</Label>
          <Select
            value={formData.roofType || ''}
            onValueChange={(value) => handleFieldChange('roofType', value)}
          >
            <SelectTrigger id="roofType" className="mt-2">
              <SelectValue placeholder="Select roof type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="RCC_SLAB">RCC Slab</SelectItem>
              <SelectItem value="TIN_SHEET">Tin Sheet</SelectItem>
              <SelectItem value="ASBESTOS">Asbestos</SelectItem>
              <SelectItem value="TILED">Tiled</SelectItem>
              <SelectItem value="THATCHED">Thatched</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-text-muted mt-1">
            Tin roofs are vulnerable to high winds
          </p>
        </div>

        <div>
          <Label htmlFor="hasBasement">Do you have a basement?</Label>
          <Select
            value={formData.hasBasement ? 'yes' : 'no'}
            onValueChange={(value) =>
              handleFieldChange('hasBasement', value === 'yes')
            }
          >
            <SelectTrigger id="hasBasement" className="mt-2">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="storageLevel">Stock Storage Level *</Label>
          <Select
            value={formData.storageFloorLevel || ''}
            onValueChange={(value) =>
              handleFieldChange('storageFloorLevel', value)
            }
          >
            <SelectTrigger id="storageLevel" className="mt-2">
              <SelectValue placeholder="Select storage level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GROUND_LEVEL">Ground Level</SelectItem>
              <SelectItem value="ELEVATED_SHELF">Elevated Shelf</SelectItem>
              <SelectItem value="FIRST_FLOOR">First Floor</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="shopArea">Approximate Shop Area (sq ft) (Optional)</Label>
          <Input
            id="shopArea"
            type="number"
            placeholder="e.g., 500"
            value={formData.shopAreaSqFt || ''}
            onChange={(e) =>
              handleFieldChange('shopAreaSqFt', e.target.value)
            }
            className="mt-2"
          />
        </div>
      </div>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Preferences & Emergency Contact</h2>

      <div className="space-y-4">
        <div>
          <Label htmlFor="language">Preferred Language *</Label>
          <Select
            value={formData.language || 'en'}
            onValueChange={(value) => handleFieldChange('language', value)}
          >
            <SelectTrigger id="language" className="mt-2">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="mr">मराठी (Marathi)</SelectItem>
              <SelectItem value="hi">हिंदी (Hindi)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Notification Preferences *</Label>
          <p className="text-xs text-text-muted mt-1 mb-3">
            Select all channels you'd like to receive alerts through
          </p>
          <div className="grid grid-cols-2 gap-3 p-4 border border-border rounded-lg">
            {[
              { key: 'notifyViaApp', label: 'App Notifications' },
              { key: 'notifyViaEmail', label: 'Email Notifications' },
              { key: 'notifyViaSms', label: 'SMS Alerts' },
              { key: 'notifyViaWhatsapp', label: 'WhatsApp Alerts' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  id={key}
                  checked={(formData as any)[key] || false}
                  onCheckedChange={(checked) =>
                    handleFieldChange(key, checked === true)
                  }
                />
                <Label
                  htmlFor={key}
                  className="mb-0 text-sm font-normal cursor-pointer"
                >
                  {label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="emergencyName">Emergency Contact Name *</Label>
          <Input
            id="emergencyName"
            placeholder="Full name"
            value={formData.emergencyContactName || ''}
            onChange={(e) =>
              handleFieldChange('emergencyContactName', e.target.value)
            }
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="emergencyPhone">Emergency Contact Phone *</Label>
          <div className="flex gap-2 mt-2">
            <div className="flex items-center px-3 bg-surface-secondary rounded-md border border-border">
              <span className="text-text-secondary">+91</span>
            </div>
            <Input
              id="emergencyPhone"
              placeholder="10-digit number"
              maxLength={10}
              value={formData.emergencyContactPhone || ''}
              onChange={(e) =>
                handleFieldChange(
                  'emergencyContactPhone',
                  e.target.value.replace(/\D/g, '')
                )
              }
              className="flex-1"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="emergencyRelationship">
            Relationship to Contact *
          </Label>
          <Select
            value={formData.emergencyContactRelationship || ''}
            onValueChange={(value) =>
              handleFieldChange('emergencyContactRelationship', value)
            }
          >
            <SelectTrigger id="emergencyRelationship" className="mt-2">
              <SelectValue placeholder="Select relationship" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="spouse">Spouse</SelectItem>
              <SelectItem value="parent">Parent</SelectItem>
              <SelectItem value="sibling">Sibling</SelectItem>
              <SelectItem value="business_partner">Business Partner</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )

  const isStep1Valid = !!formData.role
  const isStep2Valid =
    !!formData.shopName &&
    !!formData.category &&
    !!formData.ownerName &&
    (formData.phoneNumber?.length === 10)
  const isStep3Valid =
    !!formData.latitude &&
    !!formData.longitude &&
    !!formData.village &&
    !!formData.taluka &&
    !!formData.district &&
    (formData.pincode?.length === 6)
  const isStep3_5Valid =
    !!formData.powerSupplyType &&
    !!formData.connectivityType &&
    !!formData.shopFloorLevel &&
    !!formData.buildingType &&
    !!formData.roofType &&
    !!formData.storageFloorLevel
  const isStep4Valid =
    !!formData.language &&
    !!formData.emergencyContactName &&
    (formData.emergencyContactPhone?.length === 10) &&
    !!formData.emergencyContactRelationship

  const canContinue =
    (currentStep === 1 && isStep1Valid) ||
    (currentStep === 2 && isStep2Valid) ||
    (currentStep === 3 && isStep3Valid) ||
    (currentStep === 3.5 && isStep3_5Valid) ||
    (currentStep === 4 && isStep4Valid)

  const handleNext = async () => {
    if (currentStep === 3 && !geoLoading && !geocodeResult && !showManualEntry) {
      handleRequestGeolocation()
      return
    }

    if (currentStep === 3 && (!showManualEntry && geocodeResult || showManualEntry)) {
      setCurrentStep(3.5)
      return
    }

    if (currentStep === 3.5) {
      setCurrentStep(4)
      return
    }

    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isStep4Valid) return

    const submitFormData = new FormData()
    submitFormData.append('intent', 'complete')

    Object.entries(formData).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        submitFormData.append(key, String(value))
      }
    })

    fetcher.submit(submitFormData, { method: 'POST' })
  }

  let currentStepNumber = currentStep === 3.5 ? 3 : Math.ceil(currentStep)

  return (
    <div className="min-h-screen bg-surface-secondary p-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-primary mb-2">
            DisasterShield Setup
          </h1>
          <p className="text-text-secondary">Complete your profile in a few steps</p>
        </div>

        {/* Progress */}
        <Card className="p-6 mb-6">
          <div className="mb-4">
            <Progress
              value={(currentStepNumber / 4) * 100}
              className="h-2"
            />
          </div>

          <div className="flex justify-between items-center">
            {STEPS.map((step, idx) => (
              <div
                key={step.number}
                className="flex flex-col items-center flex-1"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    idx + 1 <= currentStepNumber
                      ? 'bg-brand-primary text-white'
                      : 'bg-surface-secondary border border-border text-text-muted'
                  }`}
                >
                  {idx + 1 < currentStepNumber ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    step.number
                  )}
                </div>
                <p className="text-xs mt-2 text-center text-text-muted">
                  {step.title}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Form */}
        <form onSubmit={currentStep === 4 ? handleSubmit : undefined}>
          <Card className="p-8 mb-6">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && !showManualEntry && !geocodeResult && (
              <div className="space-y-6 text-center">
                <h2 className="text-2xl font-bold">Detect Your Location</h2>
                <p className="text-text-secondary">
                  We'll use your device GPS to automatically detect your shop
                  location for accurate alerts.
                </p>

                {geoError && (
                  <div className="p-4 bg-feedback-error/10 border border-feedback-error rounded-lg text-feedback-error text-sm">
                    {geoError}
                  </div>
                )}

                <Button
                  type="button"
                  size="lg"
                  className="w-full bg-brand-primary hover:bg-brand-primary/90"
                  onClick={handleRequestGeolocation}
                  disabled={geoLoading}
                >
                  {geoLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Detecting location...
                    </>
                  ) : (
                    <>
                      <Navigation className="w-4 h-4 mr-2" />
                      Enable Location Access
                    </>
                  )}
                </Button>

                <button
                  type="button"
                  className="text-brand-primary hover:underline text-sm"
                  onClick={() => setShowManualEntry(true)}
                >
                  I prefer to enter location manually
                </button>
              </div>
            )}
            {currentStep === 3 && showManualEntry && renderStep3Manual()}
            {currentStep === 3 && geocodeResult && !showManualEntry && renderStep3LocationConfirm()}
            {currentStep === 3.5 && renderStep3Building()}
            {currentStep === 4 && renderStep4()}
          </Card>

          {/* Navigation */}
          <div className="flex gap-3">
            {currentStep > 1 && currentStep !== 3.5 && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => setCurrentStep(currentStep - 1)}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            {currentStep === 3.5 && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => {
                  setShowManualEntry(false)
                  setGeocodeResult(null)
                  setCurrentStep(3)
                }}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}

            {currentStep < 4 && (
              <Button
                type="button"
                size="lg"
                className="flex-1 bg-brand-primary hover:bg-brand-primary/90"
                onClick={handleNext}
                disabled={!canContinue || geoLoading}
              >
                {currentStep === 3 && !geoLoading && !geocodeResult
                  ? 'Detect Location'
                  : 'Continue'}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}

            {currentStep === 4 && (
              <Button
                type="submit"
                size="lg"
                className="flex-1 bg-brand-primary hover:bg-brand-primary/90"
                disabled={!isStep4Valid || fetcher.state === 'submitting'}
              >
                {fetcher.state === 'submitting' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Setting up your account...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Complete Setup
                  </>
                )}
              </Button>
            )}
          </div>

          {fetcherData?.error && (
            <div className="mt-4 p-4 bg-feedback-error/10 border border-feedback-error rounded-lg text-feedback-error text-sm">
              {fetcherData.error}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export function ErrorBoundary() {
  return (
    <div className="min-h-screen bg-surface-secondary flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-brand-primary mb-2">
            Setup Error
          </h1>
          <p className="text-text-secondary mb-4">
            An error occurred during registration setup. Please try again.
          </p>
        </div>
        <a
          href="/login"
          className="inline-block bg-brand-primary hover:bg-brand-primary/90 text-white px-4 py-2 rounded-md font-medium text-sm"
        >
          Return to Login
        </a>
      </Card>
    </div>
  )
}
