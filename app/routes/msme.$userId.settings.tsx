import {
  json,
  type LoaderFunction,
  type ActionFunction,
  type MetaFunction,
  redirect,
} from '@remix-run/node'
import {
  useLoaderData,
  isRouteErrorResponse,
  useRouteError,
  useFetcher,
  Form,
} from '@remix-run/react'
import { useState } from 'react'
import { requireAuthenticatedUser } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import { destroySession, getSession } from '~/lib/session.server'
import {
  PageHeader,
  SectionCard,
  ErrorCard,
  LanguageSelector,
  NotificationToggleGroup,
} from '~/components/shared'
import { Button } from '~/components/ui/button'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '~/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { useTranslation } from '~/hooks/useTranslation'
import { Edit, Trash2, Phone, Plus } from 'lucide-react'
import { Badge } from '~/components/ui/badge'

interface EmergencyContactData {
  id: string
  name: string
  phone: string
  relationship: string
  isPrimary: boolean
}

interface SettingsLoaderData {
  userId: string
  user: {
    email: string
    language: 'en' | 'mr' | 'hi'
    notifyViaApp: boolean
    notifyViaEmail: boolean
    notifyViaSms: boolean
    notifyViaWhatsapp: boolean
  }
  shopProfile: {
    id: string
    shopName: string
    businessCategory: string
    ownerName: string
    phoneNumber: string
    gstNumber?: string
    yearEstablished?: number
    address: string
  }
  emergencyContacts: EmergencyContactData[]
}

export const meta: MetaFunction = () => [
  { title: 'Settings | DisasterShield' },
]

export const loader: LoaderFunction = async ({ request, params }) => {
  try {
    const user = await requireAuthenticatedUser(request)

    if (user.id !== params.userId || user.role !== 'msme') {
      throw new Response('Unauthorized', { status: 403 })
    }

    const userData = await db.user.findUnique({
      where: { id: user.id },
      include: {
        shopProfile: true,
        emergencyContacts: {
          orderBy: { isPrimary: 'desc' },
        },
      },
    })

    if (!userData || !userData.shopProfile) {
      throw new Response('User or shop profile not found', { status: 404 })
    }

    const loaderData: SettingsLoaderData = {
      userId: user.id,
      user: {
        email: userData.email,
        language: (userData.language as 'en' | 'mr' | 'hi') || 'en',
        notifyViaApp: userData.notifyViaApp,
        notifyViaEmail: userData.notifyViaEmail,
        notifyViaSms: userData.notifyViaSms,
        notifyViaWhatsapp: userData.notifyViaWhatsapp,
      },
      shopProfile: {
        id: userData.shopProfile.id,
        shopName: userData.shopProfile.shopName,
        businessCategory: userData.shopProfile.category,
        ownerName: userData.name,
        phoneNumber: userData.shopProfile.phoneNumber ?? '',
        gstNumber: userData.shopProfile.gstNumber ?? undefined,
        yearEstablished: userData.shopProfile.establishedYear ?? undefined,
        address: userData.shopProfile.address,
      },
      emergencyContacts: userData.emergencyContacts.map(ec => ({
        id: ec.id,
        name: ec.name,
        phone: ec.phone,
        relationship: ec.relationship,
        isPrimary: ec.isPrimary,
      })),
    }

    return json(loaderData)
  } catch (error) {
    console.error('Settings loader error:', error)
    throw error
  }
}

export const action: ActionFunction = async ({ request, params }) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const user = await requireAuthenticatedUser(request)

    if (user.id !== params.userId || user.role !== 'msme') {
      throw new Response('Unauthorized', { status: 403 })
    }

    const formData = await request.formData()
    const intent = formData.get('intent') as string

    if (intent === 'update-profile') {
      const shopName = formData.get('shopName') as string
      const ownerName = formData.get('ownerName') as string
      const phoneNumber = formData.get('phoneNumber') as string
      const gstNumber = (formData.get('gstNumber') as string) || null
      const yearEstablished = formData.get('yearEstablished')
        ? parseInt(formData.get('yearEstablished') as string)
        : null

      const shopProfile = await db.shopProfile.findUnique({
        where: { userId: user.id },
      })

      if (!shopProfile) {
        return json({ error: 'Shop profile not found' }, { status: 404 })
      }

      await db.shopProfile.update({
        where: { id: shopProfile.id },
        data: {
          shopName,
          phoneNumber,
          gstNumber,
          establishedYear: yearEstablished,
        },
      })

      return json({ success: true, message: 'Profile updated successfully' })
    }

    if (intent === 'update-language') {
      const language = formData.get('language') as string

      await db.user.update({
        where: { id: user.id },
        data: { language: language as 'en' | 'mr' | 'hi' },
      })

      return json({ success: true, message: 'Language updated' })
    }

    if (intent === 'update-notifications') {
      const channel = formData.get('channel') as string
      const enabled = formData.get('enabled') === 'true'

      const updateData: any = {}
      if (channel === 'app') updateData.notifyViaApp = enabled
      if (channel === 'email') updateData.notifyViaEmail = enabled
      if (channel === 'sms') updateData.notifyViaSms = enabled
      if (channel === 'whatsapp') updateData.notifyViaWhatsapp = enabled

      await db.user.update({
        where: { id: user.id },
        data: updateData,
      })

      return json({ success: true })
    }

    if (intent === 'add-contact' || intent === 'edit-contact') {
      const name = formData.get('name') as string
      const phoneNumber = formData.get('phoneNumber') as string
      const relationship = formData.get('relationship') as string
      const isPrimary = formData.get('isPrimary') === 'true'

      const shopProfile = await db.shopProfile.findUnique({
        where: { userId: user.id },
      })

      if (!shopProfile) {
        return json({ error: 'Shop profile not found' }, { status: 404 })
      }

      if (intent === 'add-contact') {
        await db.emergencyContact.create({
          data: {
            userId: user.id,
            name,
            phone: phoneNumber,
            relationship,
            isPrimary,
          },
        })
      } else {
        const contactId = formData.get('contactId') as string
        await db.emergencyContact.update({
          where: { id: contactId },
          data: {
            name,
            phone: phoneNumber,
            relationship,
            isPrimary,
          },
        })
      }

      return json({ success: true })
    }

    if (intent === 'delete-contact') {
      const contactId = formData.get('contactId') as string
      await db.emergencyContact.delete({
        where: { id: contactId },
      })
      return json({ success: true })
    }

    if (intent === 'delete-account') {
      // Delete all user data
      const shopProfile = await db.shopProfile.findUnique({
        where: { userId: user.id },
      })

      if (shopProfile) {
        // Cascade delete will handle related records
        await db.shopProfile.delete({
          where: { id: shopProfile.id },
        })
      }

      // Delete user
      await db.user.delete({
        where: { id: user.id },
      })

      // Destroy session and redirect to login
      const session = await getSession(request.headers.get('Cookie'))
      return redirect('/login', {
        headers: {
          'Set-Cookie': await destroySession(session),
        },
      })
    }

    return json({ error: 'Unknown intent' }, { status: 400 })
  } catch (error) {
    console.error('Settings action error:', error)
    return json({ error: 'Action failed' }, { status: 500 })
  }
}

export default function SettingsPage() {
  const data = useLoaderData<SettingsLoaderData>()
  const t = useTranslation()
  const fetcher = useFetcher()
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [isAddingContact, setIsAddingContact] = useState(false)
  const [editingContact, setEditingContact] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Settings"
        subtitle="Manage your account and preferences"
      />

      {/* Business Profile */}
      <SectionCard
        title="Business Profile"
        action={
          !isEditingProfile && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditingProfile(true)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )
        }
      >
        {!isEditingProfile ? (
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Shop Name</p>
                <p className="font-medium">{data.shopProfile.shopName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Category</p>
                <p className="font-medium">{data.shopProfile.businessCategory}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Owner Name</p>
                <p className="font-medium">{data.shopProfile.ownerName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium">{data.shopProfile.phoneNumber}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="font-medium text-sm">{data.shopProfile.address}</p>
              </div>
              {data.shopProfile.gstNumber && (
                <div>
                  <p className="text-xs text-muted-foreground">GST Number</p>
                  <p className="font-medium">{data.shopProfile.gstNumber}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <fetcher.Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="update-profile" />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="shopName">Shop Name *</Label>
                <Input
                  id="shopName"
                  name="shopName"
                  defaultValue={data.shopProfile.shopName}
                  required
                />
              </div>
              <div>
                <Label htmlFor="ownerName">Owner Name *</Label>
                <Input
                  id="ownerName"
                  name="ownerName"
                  defaultValue={data.shopProfile.ownerName}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phoneNumber">Phone Number *</Label>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  defaultValue={data.shopProfile.phoneNumber}
                  required
                />
              </div>
              <div>
                <Label htmlFor="gstNumber">GST Number</Label>
                <Input
                  id="gstNumber"
                  name="gstNumber"
                  defaultValue={data.shopProfile.gstNumber || ''}
                />
              </div>
              <div>
                <Label htmlFor="yearEstablished">Year Established</Label>
                <Input
                  id="yearEstablished"
                  name="yearEstablished"
                  type="number"
                  defaultValue={data.shopProfile.yearEstablished || ''}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={fetcher.state === 'submitting'}>
                {fetcher.state === 'submitting' ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditingProfile(false)}
              >
                Cancel
              </Button>
            </div>
          </fetcher.Form>
        )}
      </SectionCard>

      {/* Language & Region */}
      <SectionCard title="Language & Region">
        <fetcher.Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="update-language" />

          <div>
            <Label htmlFor="language">Preferred Language</Label>
            <Select
              defaultValue={data.user.language}
              onValueChange={(value) => {
                const formData = new FormData()
                formData.append('intent', 'update-language')
                formData.append('language', value)
                fetcher.submit(formData, { method: 'post' })
              }}
            >
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">हिंदी (Hindi)</SelectItem>
                <SelectItem value="mr">मराठी (Marathi)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </fetcher.Form>
      </SectionCard>

      {/* Notification Preferences */}
      <SectionCard title="Notifications">
        <div className="space-y-4">
          {[
            { key: 'app', label: 'App Notifications', enabled: data.user.notifyViaApp },
            {
              key: 'email',
              label: 'Email Alerts',
              enabled: data.user.notifyViaEmail,
            },
            { key: 'sms', label: 'SMS Alerts', enabled: data.user.notifyViaSms },
            {
              key: 'whatsapp',
              label: 'WhatsApp Alerts',
              enabled: data.user.notifyViaWhatsapp,
            },
          ].map(channel => (
            <div key={channel.key} className="flex items-center justify-between">
              <Label htmlFor={channel.key} className="cursor-pointer">
                {channel.label}
              </Label>
              <Switch
                id={channel.key}
                checked={channel.enabled}
                onCheckedChange={(checked) => {
                  const formData = new FormData()
                  formData.append('intent', 'update-notifications')
                  formData.append('channel', channel.key)
                  formData.append('enabled', String(checked))
                  fetcher.submit(formData, { method: 'post' })
                }}
              />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Emergency Contacts */}
      <SectionCard
        title="Emergency Contacts"
        action={
          !isAddingContact && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddingContact(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
            </Button>
          )
        }
      >
        <div className="space-y-3">
          {data.emergencyContacts.map(contact => (
            <div
              key={contact.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{contact.name}</p>
                  {contact.isPrimary && (
                    <Badge variant="secondary" className="text-xs">
                      Primary
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {contact.relationship}
                </p>
                <a
                  href={`tel:${contact.phone}`}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  <Phone className="h-3 w-3" />
                  {contact.phone}
                </a>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingContact(contact.id)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="delete-contact" />
                  <input type="hidden" name="contactId" value={contact.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </fetcher.Form>
              </div>
            </div>
          ))}

          {isAddingContact && (
            <EmergencyContactForm
              onClose={() => setIsAddingContact(false)}
              fetcher={fetcher}
            />
          )}

          {editingContact && (
            <EmergencyContactForm
              contact={data.emergencyContacts.find(c => c.id === editingContact)}
              onClose={() => setEditingContact(null)}
              fetcher={fetcher}
            />
          )}
        </div>
      </SectionCard>

      {/* Account & Privacy */}
      <SectionCard title="Account & Privacy">
        <div className="space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground">Email Address</Label>
            <p className="font-medium">{data.user.email}</p>
            <p className="text-xs text-muted-foreground">
              From your Google profile — cannot be changed here
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Community Visibility</p>
              <p className="text-sm text-muted-foreground">
                Show your name to other business owners in your area
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Data Sharing with LRDB</p>
              <p className="text-sm text-muted-foreground">
                Allow local disaster response team to view your risk profile
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. All your data, including stock items,
                  alerts, and chat history, will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="rounded-lg bg-red-50 p-3">
                <p className="text-sm text-red-900">
                  ⚠️ You will need to sign up again to use DisasterShield.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="delete-account" />
                  <AlertDialogAction type="submit" className="bg-red-600 hover:bg-red-700">
                    Delete My Account
                  </AlertDialogAction>
                </fetcher.Form>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </SectionCard>
    </div>
  )
}

interface EmergencyContactFormProps {
  contact?: EmergencyContactData
  onClose: () => void
  fetcher: any
}

function EmergencyContactForm({
  contact,
  onClose,
  fetcher,
}: EmergencyContactFormProps) {
  const isEdit = !!contact

  return (
    <fetcher.Form method="post" className="rounded-lg border bg-muted p-4">
      <input
        type="hidden"
        name="intent"
        value={isEdit ? 'edit-contact' : 'add-contact'}
      />
      {isEdit && <input type="hidden" name="contactId" value={contact.id} />}

      <div className="space-y-3">
        <div>
          <Label htmlFor="name">Contact Name *</Label>
          <Input
            id="name"
            name="name"
            defaultValue={contact?.name || ''}
            required
          />
        </div>

        <div>
          <Label htmlFor="phoneNumber">Phone Number *</Label>
          <Input
            id="phoneNumber"
            name="phoneNumber"
            defaultValue={contact?.phone || ''}
            required
          />
        </div>

        <div>
          <Label htmlFor="relationship">Relationship *</Label>
          <Select defaultValue={contact?.relationship || 'spouse'}>
            <SelectTrigger id="relationship">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="spouse">Spouse</SelectItem>
              <SelectItem value="parent">Parent</SelectItem>
              <SelectItem value="sibling">Sibling</SelectItem>
              <SelectItem value="business-partner">Business Partner</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isPrimary"
            name="isPrimary"
            value="true"
            defaultChecked={contact?.isPrimary}
          />
          <Label htmlFor="isPrimary" className="text-sm font-normal">
            Set as primary contact
          </Label>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={fetcher.state === 'submitting'}>
            {fetcher.state === 'submitting'
              ? isEdit
                ? 'Saving...'
                : 'Adding...'
              : isEdit
                ? 'Save Contact'
                : 'Add Contact'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </fetcher.Form>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()
  return <ErrorCard error={error} />
}
