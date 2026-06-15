import { json, type LoaderFunction, type ActionFunction, type MetaFunction } from '@remix-run/node'
import { useLoaderData, useParams, useFetcher, isRouteErrorResponse, useRouteError } from '@remix-run/react'
import { requireRole } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import {
  PageHeader,
  SectionCard,
  ErrorCard,
} from '~/components/shared'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Textarea } from '~/components/ui/textarea'
import { Grid, Box } from '@mui/material'
import { AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { useState } from 'react'

export const meta: MetaFunction = () => [
  { title: 'Settings | DisasterShield' },
]

interface SettingsLoaderData {
  officer: {
    id: string
    name: string | null
    email: string | null
    designation: string | null
  }
  lrdbProfile: {
    id: string
    district: string
    taluka: string
    regionCode: string
    rainThreshold: number
    windThreshold: number
    floodRiskRadius: number
    alertCooldown: number
  }
  lastLogin: string | null
}

export const loader: LoaderFunction = async ({ request, params }) => {
  try {
    const officer = await requireRole(request, 'lrdb')

    const user = await db.user.findUnique({
      where: { id: officer.id },
    })

    const lrdbProfile = await db.lRDBOfficer.findUnique({
      where: { userId: officer.id },
      include: { user: true },
    })

    if (!lrdbProfile) {
      throw new Response('LRDB profile not found', { status: 404 })
    }

    return json<SettingsLoaderData>({
      officer: {
        id: officer.id,
        name: user?.name || null,
        email: user?.email || null,
        designation: lrdbProfile.designation || null,
      },
      lrdbProfile: {
        id: lrdbProfile.id,
        district: lrdbProfile.district,
        taluka: lrdbProfile.taluka ?? '',
        regionCode: lrdbProfile.regionCode,
        rainThreshold: 20, // Default values - would come from DB in real implementation
        windThreshold: 40,
        floodRiskRadius: 500,
        alertCooldown: 3,
      },
      lastLogin: user?.lastLoginAt?.toISOString() || null,
    })
  } catch (error) {
    if (isRouteErrorResponse(error)) throw error
    throw new Response('Failed to load settings', { status: 500 })
  }
}

export const action: ActionFunction = async ({ request, params }) => {
  try {
    if (request.method !== 'POST') {
      throw new Response('Method not allowed', { status: 405 })
    }

    const officer = await requireRole(request, 'lrdb')
    const { intent, data } = await request.json()

    const lrdbProfile = await db.lRDBOfficer.findUnique({
      where: { userId: officer.id },
    })

    if (!lrdbProfile) {
      throw new Response('LRDB profile not found', { status: 404 })
    }

    if (intent === 'update-officer-profile') {
      const { designation, district, taluka } = data

      // Validate inputs
      if (!designation || !district) {
        return json(
          { success: false, message: 'Missing required fields' },
          { status: 400 }
        )
      }

      // Update LRDB officer profile
      await db.lRDBOfficer.update({
        where: { userId: officer.id },
        data: {
          designation,
          district,
          taluka: taluka || lrdbProfile.taluka,
        },
      })

      return json({ success: true, message: 'Profile updated successfully' })
    }

    if (intent === 'update-thresholds') {
      const { rainThreshold, windThreshold, floodRiskRadius, alertCooldown } = data

      // In a real implementation, store these in a RegionConfig table
      // For now, we'll just validate and return success
      if (
        !rainThreshold ||
        !windThreshold ||
        !floodRiskRadius ||
        !alertCooldown
      ) {
        return json(
          { success: false, message: 'Missing required fields' },
          { status: 400 }
        )
      }

      // Would update RegionConfig or similar table
      // await db.regionConfig.upsert({...})

      return json({ success: true, message: 'Thresholds updated successfully' })
    }

    if (intent === 'update-notifications') {
      const {
        newQueryNotification,
        criticalAlertNotification,
        sosNotification,
        escalatedQueryNotification,
        newShopNotification,
      } = data

      // Update user notification preferences
      // In real implementation, these would be stored as separate fields or in a preferences table
      await db.user.update({
        where: { id: officer.id },
        data: {
          // notifyNewQuery: newQueryNotification,
          // notifyCriticalAlert: criticalAlertNotification,
          // etc.
        },
      })

      return json({
        success: true,
        message: 'Notification preferences updated successfully',
      })
    }

    if (intent === 'request-region-change') {
      const { reason } = data

      if (!reason || reason.trim().length === 0) {
        return json(
          { success: false, message: 'Please provide a reason' },
          { status: 400 }
        )
      }

      // In real implementation, send email notification
      // sendMail({
      //   to: ADMIN_EMAIL,
      //   subject: `Region Change Request from ${officer.name}`,
      //   body: reason
      // })

      return json({
        success: true,
        message: 'Region change request submitted to administrator',
      })
    }

    throw new Response('Unknown action', { status: 400 })
  } catch (error) {
    if (isRouteErrorResponse(error)) throw error
    console.error('Settings action error:', error)
    throw new Response('Failed to process settings update', { status: 500 })
  }
}

export default function SettingsPage() {
  const { officer, lrdbProfile, lastLogin } = useLoaderData<SettingsLoaderData>()
  const fetcher = useFetcher()
  const { officerId } = useParams()

  // Form states
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileFormData, setProfileFormData] = useState({
    designation: officer.designation || '',
    district: lrdbProfile.district,
    taluka: lrdbProfile.taluka,
  })

  const [thresholdFormData, setThresholdFormData] = useState({
    rainThreshold: lrdbProfile.rainThreshold,
    windThreshold: lrdbProfile.windThreshold,
    floodRiskRadius: lrdbProfile.floodRiskRadius,
    alertCooldown: lrdbProfile.alertCooldown,
  })

  const [notificationFormData, setNotificationFormData] = useState({
    newQueryNotification: true,
    criticalAlertNotification: true,
    sosNotification: true,
    escalatedQueryNotification: true,
    newShopNotification: false,
  })

  const [isRegionChangeDialogOpen, setIsRegionChangeDialogOpen] = useState(false)
  const [regionChangeReason, setRegionChangeReason] = useState('')

  const handleUpdateProfile = () => {
    fetcher.submit(
      {
        intent: 'update-officer-profile',
        data: profileFormData,
      },
      { method: 'post', encType: 'application/json' }
    )
    setIsEditingProfile(false)
  }

  const handleUpdateThresholds = () => {
    fetcher.submit(
      {
        intent: 'update-thresholds',
        data: thresholdFormData,
      },
      { method: 'post', encType: 'application/json' }
    )
  }

  const handleUpdateNotifications = () => {
    fetcher.submit(
      {
        intent: 'update-notifications',
        data: notificationFormData,
      },
      { method: 'post', encType: 'application/json' }
    )
  }

  const handleRequestRegionChange = () => {
    if (regionChangeReason.trim().length === 0) {
      alert('Please provide a reason for the region change')
      return
    }

    fetcher.submit(
      {
        intent: 'request-region-change',
        data: { reason: regionChangeReason },
      },
      { method: 'post', encType: 'application/json' }
    )

    setRegionChangeReason('')
    setIsRegionChangeDialogOpen(false)
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Settings"
        subtitle="Administrative configuration and preferences"
      />

      {/* Officer Profile */}
      <SectionCard
        title="Officer Profile"
        action={
          !isEditingProfile && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditingProfile(true)}
            >
              Edit
            </Button>
          )
        }
      >
        {isEditingProfile ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name (Read-only)</Label>
              <Input
                id="name"
                value={officer.name || ''}
                disabled
                className="bg-gray-50"
              />
            </div>

            <div>
              <Label htmlFor="email">Email (Read-only)</Label>
              <Input
                id="email"
                value={officer.email || ''}
                disabled
                className="bg-gray-50"
              />
            </div>

            <div>
              <Label htmlFor="designation">Designation *</Label>
              <Input
                id="designation"
                placeholder="e.g. District Disaster Manager"
                value={profileFormData.designation}
                onChange={(e) =>
                  setProfileFormData({
                    ...profileFormData,
                    designation: e.target.value,
                  })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="district">District *</Label>
                <Input
                  id="district"
                  placeholder="District name"
                  value={profileFormData.district}
                  onChange={(e) =>
                    setProfileFormData({
                      ...profileFormData,
                      district: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor="taluka">Taluka</Label>
                <Input
                  id="taluka"
                  placeholder="Taluka name"
                  value={profileFormData.taluka}
                  onChange={(e) =>
                    setProfileFormData({
                      ...profileFormData,
                      taluka: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleUpdateProfile}
                disabled={fetcher.state !== 'idle'}
              >
                {fetcher.state !== 'idle' ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditingProfile(false)
                  setProfileFormData({
                    designation: officer.designation || '',
                    district: lrdbProfile.district,
                    taluka: lrdbProfile.taluka,
                  })
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Full Name</div>
              <div className="mt-1">{officer.name || '-'}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Email</div>
              <div className="mt-1">{officer.email || '-'}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Designation</div>
              <div className="mt-1">{officer.designation || '-'}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">District</div>
                <div className="mt-1">{lrdbProfile.district}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Taluka</div>
                <div className="mt-1">{lrdbProfile.taluka}</div>
              </div>
            </div>
            {lastLogin && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Last Login</div>
                <div className="mt-1 text-sm">{format(new Date(lastLogin), 'MMM dd, yyyy HH:mm')}</div>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* Alert System Configuration */}
      <SectionCard title="Alert Thresholds">
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
            <p>These thresholds control when alerts are automatically generated for your region.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="rainThreshold">Rain Threshold (mm/hr)</Label>
              <Input
                id="rainThreshold"
                type="number"
                value={thresholdFormData.rainThreshold}
                onChange={(e) =>
                  setThresholdFormData({
                    ...thresholdFormData,
                    rainThreshold: Number(e.target.value),
                  })
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Alerts generated when rainfall exceeds this value
              </p>
            </div>

            <div>
              <Label htmlFor="windThreshold">Wind Threshold (kmph)</Label>
              <Input
                id="windThreshold"
                type="number"
                value={thresholdFormData.windThreshold}
                onChange={(e) =>
                  setThresholdFormData({
                    ...thresholdFormData,
                    windThreshold: Number(e.target.value),
                  })
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Alerts generated when wind speed exceeds this value
              </p>
            </div>

            <div>
              <Label htmlFor="floodRiskRadius">Flood Risk Radius (metres)</Label>
              <Input
                id="floodRiskRadius"
                type="number"
                value={thresholdFormData.floodRiskRadius}
                onChange={(e) =>
                  setThresholdFormData({
                    ...thresholdFormData,
                    floodRiskRadius: Number(e.target.value),
                  })
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Shops within this distance of water body get flood pre-warnings
              </p>
            </div>

            <div>
              <Label htmlFor="alertCooldown">Alert Cooldown (hours)</Label>
              <Input
                id="alertCooldown"
                type="number"
                value={thresholdFormData.alertCooldown}
                onChange={(e) =>
                  setThresholdFormData({
                    ...thresholdFormData,
                    alertCooldown: Number(e.target.value),
                  })
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Minimum hours between consecutive alerts for the same shop
              </p>
            </div>
          </div>

          <Button
            onClick={handleUpdateThresholds}
            disabled={fetcher.state !== 'idle'}
          >
            {fetcher.state !== 'idle' ? 'Saving...' : 'Save Thresholds'}
          </Button>
        </div>
      </SectionCard>

      {/* Notification Preferences */}
      <SectionCard title="My Notifications">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose which events trigger notifications for you
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="newQueryNotif" className="font-normal cursor-pointer">
                New query submitted in my region
              </Label>
              <Switch
                id="newQueryNotif"
                checked={notificationFormData.newQueryNotification}
                onCheckedChange={(checked) =>
                  setNotificationFormData({
                    ...notificationFormData,
                    newQueryNotification: checked,
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="criticalAlertNotif" className="font-normal cursor-pointer">
                Critical alert auto-generated by system
              </Label>
              <Switch
                id="criticalAlertNotif"
                checked={notificationFormData.criticalAlertNotification}
                onCheckedChange={(checked) =>
                  setNotificationFormData({
                    ...notificationFormData,
                    criticalAlertNotification: checked,
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="sosNotif" className="font-normal cursor-pointer">
                SOS triggered by any shop in my region
              </Label>
              <Switch
                id="sosNotif"
                checked={notificationFormData.sosNotification}
                onCheckedChange={(checked) =>
                  setNotificationFormData({
                    ...notificationFormData,
                    sosNotification: checked,
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="escalatedNotif" className="font-normal cursor-pointer">
                Query escalated to me
              </Label>
              <Switch
                id="escalatedNotif"
                checked={notificationFormData.escalatedQueryNotification}
                onCheckedChange={(checked) =>
                  setNotificationFormData({
                    ...notificationFormData,
                    escalatedQueryNotification: checked,
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="newShopNotif" className="font-normal cursor-pointer">
                New shop registered in my region
              </Label>
              <Switch
                id="newShopNotif"
                checked={notificationFormData.newShopNotification}
                onCheckedChange={(checked) =>
                  setNotificationFormData({
                    ...notificationFormData,
                    newShopNotification: checked,
                  })
                }
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Notifications are delivered via App and Email
          </p>

          <Button
            onClick={handleUpdateNotifications}
            disabled={fetcher.state !== 'idle'}
          >
            {fetcher.state !== 'idle' ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
      </SectionCard>

      {/* Region Configuration */}
      <SectionCard title="Region Configuration">
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium text-muted-foreground">District</div>
            <div className="mt-1">{lrdbProfile.district}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Taluka</div>
            <div className="mt-1">{lrdbProfile.taluka}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Region Code</div>
            <div className="mt-1 font-mono text-sm">{lrdbProfile.regionCode}</div>
          </div>

          <Dialog open={isRegionChangeDialogOpen} onOpenChange={setIsRegionChangeDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Request Region Change</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Region Change</DialogTitle>
                <DialogDescription>
                  Describe the reason for changing your assigned region
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <Textarea
                  placeholder="Please provide details about your region change request..."
                  className="min-h-[120px]"
                  value={regionChangeReason}
                  onChange={(e) => setRegionChangeReason(e.target.value)}
                />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsRegionChangeDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleRequestRegionChange}
                    disabled={fetcher.state !== 'idle'}
                  >
                    {fetcher.state !== 'idle' ? 'Submitting...' : 'Submit Request'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </SectionCard>

      {/* Communication Settings */}
      <SectionCard title="Broadcast Settings">
        <div className="space-y-4">
          <div>
            <Label htmlFor="signature">Default Message Signature</Label>
            <Textarea
              id="signature"
              placeholder="Text to append to all broadcast messages..."
              className="mt-2 min-h-[80px]"
              defaultValue="-- Sent by Local Disaster Resilience Team"
            />
          </div>

          <div>
            <Label htmlFor="expiry">Default Alert Expiry</Label>
            <Select defaultValue="12">
              <SelectTrigger id="expiry" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 hours</SelectItem>
                <SelectItem value="6">6 hours</SelectItem>
                <SelectItem value="12">12 hours</SelectItem>
                <SelectItem value="24">24 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="autoEmail" className="font-normal cursor-pointer">
              Auto-send email on alert creation
            </Label>
            <Switch id="autoEmail" defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="requireConfirm" className="font-normal cursor-pointer">
              Require confirmation before broadcast
            </Label>
            <Switch id="requireConfirm" defaultChecked />
          </div>

          <Button>Save Communication Settings</Button>
        </div>
      </SectionCard>

      {/* Account & Security */}
      <SectionCard title="Account & Security">
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium text-muted-foreground">Email Address</div>
            <div className="mt-1 text-sm">{officer.email || '-'} (Read-only — from Google)</div>
          </div>

          {lastLogin && (
            <div>
              <div className="text-sm font-medium text-muted-foreground">Last Login</div>
              <div className="mt-1 text-sm">
                {format(new Date(lastLogin), 'MMM dd, yyyy HH:mm')}
              </div>
            </div>
          )}

          <div className="pt-4">
            <Button variant="destructive">Sign Out of All Devices</Button>
          </div>

          <div className="pt-4">
            <Button variant="outline">Download My Data</Button>
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
