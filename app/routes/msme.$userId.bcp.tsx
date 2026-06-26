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
import { requireAuthenticatedUser } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import { apiClient } from '~/lib/api.server'
import {
  PageHeader,
  SectionCard,
  StatTile,
  TimelineStep,
  EmptyState,
  ErrorCard,
} from '~/components/shared'
import { Button } from '~/components/ui/button'
import { Progress } from '~/components/ui/progress'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '~/components/ui/tabs'
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
import { useTranslation } from '~/hooks/useTranslation'
import { format } from 'date-fns'
import { Grid, Box } from '@mui/material'
import { RotateCcw, Phone, Share2, Download, PackageOpen, ListChecks, AlertCircle } from 'lucide-react'

interface BCPLoaderData {
  userId: string
  shopId: string
  shopName: string
  shopPhoneNumber: string | null
  hasPlan: boolean
  completionPercent: number
  beforeStepsCompleted: number
  beforeStepsTotal: number
  duringStepsCompleted: number
  duringStepsTotal: number
  afterStepsCompleted: number
  afterStepsTotal: number
  bcpPhases: Array<{
    phase: 'BEFORE' | 'DURING' | 'AFTER'
    steps: Array<{
      id: string
      title: string
      description: string
      isCompleted: boolean
      isOptional: boolean
      completedAt?: string
      orderIndex: number
    }>
  }>
  emergencyContacts: Array<{
    id: string
    name: string
    phone: string
    relationship: string
    isPrimary: boolean
  }>
}

export const meta: MetaFunction = () => [
  { title: 'Business Continuity Plan | DisasterShield' },
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
        bcpPlan: {
          include: {
            steps: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
    })

    if (!shopProfile) {
      throw new Response('Shop profile not found', { status: 404 })
    }

    const emergencyContacts = await db.emergencyContact.findMany({
      where: { userId: user.id },
      orderBy: { isPrimary: 'desc' },
    })

    if (!shopProfile.bcpPlan) {
      return json<BCPLoaderData>({
        userId: user.id,
        shopId: shopProfile.id,
        shopName: shopProfile.shopName,
        shopPhoneNumber: shopProfile.phoneNumber ?? null,
        hasPlan: false,
        completionPercent: 0,
        beforeStepsCompleted: 0, beforeStepsTotal: 0,
        duringStepsCompleted: 0, duringStepsTotal: 0,
        afterStepsCompleted: 0, afterStepsTotal: 0,
        bcpPhases: [
          { phase: 'BEFORE', steps: [] },
          { phase: 'DURING', steps: [] },
          { phase: 'AFTER', steps: [] },
        ],
        emergencyContacts: emergencyContacts.map(c => ({
          id: c.id, name: c.name, phone: c.phone,
          relationship: c.relationship, isPrimary: c.isPrimary,
        })),
      })
    }

    const steps = shopProfile.bcpPlan.steps
    const bcpPhases = [
      {
        phase: 'BEFORE' as const,
        steps: steps.filter(s => s.phase === 'BEFORE'),
      },
      {
        phase: 'DURING' as const,
        steps: steps.filter(s => s.phase === 'DURING'),
      },
      {
        phase: 'AFTER' as const,
        steps: steps.filter(s => s.phase === 'AFTER'),
      },
    ]

    const completedCount = steps.filter(s => s.isCompleted).length
    const completionPercent = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0

    const beforeSteps = bcpPhases[0].steps
    const duringSteps = bcpPhases[1].steps
    const afterSteps = bcpPhases[2].steps

    const loaderData: BCPLoaderData = {
      userId: user.id,
      shopId: shopProfile.id,
      shopName: shopProfile.shopName,
      shopPhoneNumber: shopProfile.phoneNumber ?? null,
      hasPlan: true,
      completionPercent,
      beforeStepsCompleted: beforeSteps.filter(s => s.isCompleted).length,
      beforeStepsTotal: beforeSteps.length,
      duringStepsCompleted: duringSteps.filter(s => s.isCompleted).length,
      duringStepsTotal: duringSteps.length,
      afterStepsCompleted: afterSteps.filter(s => s.isCompleted).length,
      afterStepsTotal: afterSteps.length,
      bcpPhases: bcpPhases.map(phase => ({
        ...phase,
        steps: phase.steps.map(step => ({
          id: step.id,
          title: step.title,
          description: step.description,
          isCompleted: step.isCompleted,
          isOptional: step.isOptional,
          completedAt: step.completedAt?.toISOString(),
          orderIndex: step.orderIndex,
        })),
      })),
      emergencyContacts: emergencyContacts.map(contact => ({
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        relationship: contact.relationship,
        isPrimary: contact.isPrimary,
      })),
    }

    return json(loaderData)
  } catch (error) {
    if (error instanceof Response) {
      throw error
    }
    console.error('BCP loader error:', error)
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
    const intent = formData.get('intent')

    const shopProfile = await db.shopProfile.findUnique({
      where: { userId: user.id },
    })

    if (!shopProfile) {
      throw new Response('Shop profile not found', { status: 404 })
    }

    if (intent === 'toggle-step') {
      const stepId = formData.get('stepId') as string
      const isCompleted = formData.get('isCompleted') === 'true'

      await db.bCPStep.update({
        where: { id: stepId },
        data: {
          isCompleted,
          completedAt: isCompleted ? new Date() : null,
        },
      })

      return json({ success: true })
    }

    if (intent === 'regenerate-plan') {
      const bcpPlan = await db.bCPPlan.findUnique({
        where: { shopProfileId: shopProfile.id },
      })

      if (bcpPlan) {
        // Delete existing steps
        await db.bCPStep.deleteMany({
          where: { bcpPlanId: bcpPlan.id },
        })
      }

      // Call Python API to generate new BCP
      const bcpResponse = await apiClient.post(`/bcp/generate`, {
        shopId: shopProfile.id,
      })

      // TODO: Send BCP ready email via sendMail

      return json({ success: true })
    }

    throw new Response('Invalid intent', { status: 400 })
  } catch (error) {
    if (error instanceof Response) {
      throw error
    }
    console.error('BCP action error:', error)
    throw new Response('Failed to process BCP action', { status: 400 })
  }
}

export default function MsmeBCP() {
  const { t } = useTranslation()
  const data = useLoaderData<BCPLoaderData>()
  const fetcher = useFetcher()
  const isGenerating = fetcher.state !== 'idle' && fetcher.formData?.get('intent') === 'regenerate-plan'

  const handleToggleStep = (stepId: string, isCompleted: boolean) => {
    fetcher.submit(
      {
        intent: 'toggle-step',
        stepId,
        isCompleted: (!isCompleted).toString(),
      },
      { method: 'POST' }
    )
  }

  const handleRegeneratePlan = () => {
    fetcher.submit(
      { intent: 'regenerate-plan' },
      { method: 'POST' }
    )
  }

  const handleDownloadPDF = async () => {
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const marginL = 20
    const marginR = 20
    const contentW = pageW - marginL - marginR
    let y = 20

    const phaseLabels: Record<string, string> = {
      BEFORE: 'Before Disaster',
      DURING: 'During Disaster',
      AFTER: 'After Disaster',
    }

    const totalSteps = data.beforeStepsTotal + data.duringStepsTotal + data.afterStepsTotal
    const totalCompleted = data.beforeStepsCompleted + data.duringStepsCompleted + data.afterStepsCompleted

    // ── Helper: check if we need a new page ──
    const ensureSpace = (needed: number) => {
      if (y + needed > pageH - 20) {
        doc.addPage()
        y = 20
      }
    }

    // ── Header ──
    doc.setFillColor(37, 99, 235) // brand blue
    doc.rect(0, 0, pageW, 3, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(17, 24, 39)
    doc.text('Business Continuity Plan', pageW / 2, y, { align: 'center' })
    y += 8

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128)
    doc.text(
      `${data.shopName}  |  Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      pageW / 2, y, { align: 'center' }
    )
    y += 4

    // divider
    doc.setDrawColor(229, 231, 235)
    doc.setLineWidth(0.5)
    doc.line(marginL, y, pageW - marginR, y)
    y += 8

    // ── Stat cards ──
    const cardW = (contentW - 8) / 3 // 3 cards with 4mm gaps
    const stats = [
      { label: 'OVERALL PROGRESS', value: `${data.completionPercent}%` },
      { label: 'STEPS COMPLETED', value: `${totalCompleted}/${totalSteps}` },
      { label: 'EMERGENCY CONTACTS', value: `${data.emergencyContacts.length}` },
    ]

    stats.forEach((stat, i) => {
      const x = marginL + i * (cardW + 4)
      doc.setFillColor(249, 250, 251)
      doc.setDrawColor(229, 231, 235)
      doc.roundedRect(x, y, cardW, 22, 2, 2, 'FD')

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(107, 114, 128)
      doc.text(stat.label, x + cardW / 2, y + 8, { align: 'center' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(17, 24, 39)
      doc.text(stat.value, x + cardW / 2, y + 18, { align: 'center' })
    })
    y += 30

    // ── Phase sections ──
    data.bcpPhases.forEach(phase => {
      if (phase.steps.length === 0) return

      const completed = phase.steps.filter(s => s.isCompleted).length
      const total = phase.steps.length

      ensureSpace(20)

      // Phase heading
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(17, 24, 39)
      doc.text(phaseLabels[phase.phase] || phase.phase, marginL, y)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(107, 114, 128)
      const labelW = doc.getTextWidth((phaseLabels[phase.phase] || phase.phase) + '  ')
      doc.text(`(${completed}/${total} completed)`, marginL + labelW, y)
      y += 2

      // underline
      doc.setDrawColor(229, 231, 235)
      doc.setLineWidth(0.4)
      doc.line(marginL, y, pageW - marginR, y)
      y += 6

      // Steps
      phase.steps.forEach((step, idx) => {
        // Estimate height: title ~5mm + description wrapping + optional completed line + padding
        const descLines = doc.splitTextToSize(step.description, contentW - 14) as string[]
        const stepHeight = 6 + descLines.length * 4 + (step.completedAt ? 5 : 0) + (step.isOptional ? 0 : 0) + 4
        ensureSpace(stepHeight)

        // Step number circle
        const circleX = marginL + 4
        const circleY = y + 1
        doc.setFillColor(step.isCompleted ? 22 : 107, step.isCompleted ? 163 : 114, step.isCompleted ? 74 : 128)
        doc.circle(circleX, circleY, 3, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(255, 255, 255)
        doc.text(`${idx + 1}`, circleX, circleY + 1, { align: 'center' })

        // Title
        const textX = marginL + 12
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(17, 24, 39)
        const checkMark = step.isCompleted ? '[done] ' : '[ ] '
        const titleText = `${checkMark}${step.title}${step.isOptional ? '  (Optional)' : ''}`
        doc.text(titleText, textX, y + 2)
        y += 6

        // Description (wrapped)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(107, 114, 128)
        descLines.forEach((line: string) => {
          ensureSpace(5)
          doc.text(line, textX, y)
          y += 4
        })

        // Completed date
        if (step.completedAt) {
          doc.setFontSize(8)
          doc.setTextColor(22, 163, 74)
          doc.text(`Completed: ${new Date(step.completedAt).toLocaleDateString('en-IN')}`, textX, y)
          y += 4
        }

        y += 3
      })

      y += 4
    })

    // ── Emergency Contacts ──
    ensureSpace(20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(17, 24, 39)
    doc.text('Emergency Contacts', marginL, y)
    y += 2
    doc.setDrawColor(229, 231, 235)
    doc.line(marginL, y, pageW - marginR, y)
    y += 6

    if (data.emergencyContacts.length === 0) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(10)
      doc.setTextColor(156, 163, 175)
      doc.text('No emergency contacts configured.', marginL, y)
      y += 8
    } else {
      // Table header
      doc.setFillColor(249, 250, 251)
      doc.rect(marginL, y - 3, contentW, 7, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(107, 114, 128)
      doc.text('NAME', marginL + 2, y + 1)
      doc.text('RELATIONSHIP', marginL + 60, y + 1)
      doc.text('PHONE', marginL + 110, y + 1)
      doc.text('PRIMARY', marginL + 145, y + 1)
      y += 8

      data.emergencyContacts.forEach(contact => {
        ensureSpace(8)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(17, 24, 39)
        doc.text(contact.name, marginL + 2, y)
        doc.setTextColor(107, 114, 128)
        doc.text(contact.relationship, marginL + 60, y)
        doc.setTextColor(17, 24, 39)
        doc.text(contact.phone, marginL + 110, y)
        doc.text(contact.isPrimary ? 'Yes' : '', marginL + 145, y)
        y += 6
      })
    }

    // ── Footer ──
    const footerY = pageH - 10
    doc.setDrawColor(229, 231, 235)
    doc.setLineWidth(0.3)
    doc.line(marginL, footerY - 4, pageW - marginR, footerY - 4)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(156, 163, 175)
    doc.text(
      `Generated by DisasterShield on ${new Date().toLocaleString('en-IN')}`,
      pageW / 2, footerY, { align: 'center' }
    )

    doc.save(`BCP-Plan-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const handleShareWhatsApp = () => {
    const totalSteps = data.beforeStepsTotal + data.duringStepsTotal + data.afterStepsTotal
    const totalCompleted = data.beforeStepsCompleted + data.duringStepsCompleted + data.afterStepsCompleted

    const phaseLabels: Record<string, string> = {
      BEFORE: '📋 Before Disaster',
      DURING: '⚠️ During Disaster',
      AFTER: '🔄 After Disaster',
    }

    const phaseSummaries = data.bcpPhases
      .map(phase => {
        if (phase.steps.length === 0) return ''
        const completed = phase.steps.filter(s => s.isCompleted).length
        const lines = phase.steps
          .map((step, idx) => `  ${step.isCompleted ? '✅' : '☐'} ${idx + 1}. ${step.title}`)
          .join('\n')
        return `${phaseLabels[phase.phase]} (${completed}/${phase.steps.length})\n${lines}`
      })
      .filter(Boolean)
      .join('\n\n')

    const contactLines = data.emergencyContacts.length > 0
      ? data.emergencyContacts
          .map(c => `  • ${c.name} (${c.relationship}): ${c.phone}${c.isPrimary ? ' ⭐' : ''}`)
          .join('\n')
      : '  No contacts configured'

    const message = [
      `🛡️ *Business Continuity Plan*`,
      `📍 ${data.shopName}`,
      `📊 Progress: ${data.completionPercent}% (${totalCompleted}/${totalSteps} steps)`,
      `📅 Shared on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      '',
      phaseSummaries,
      '',
      `📞 *Emergency Contacts*`,
      contactLines,
      '',
      `— Sent from DisasterShield`,
    ].join('\n')

    // Clean the phone number: remove spaces, dashes, and ensure country code
    let phone = (data.shopPhoneNumber || '').replace(/[\s\-()]/g, '')
    if (phone && !phone.startsWith('+')) {
      // Assume Indian number if no country code
      phone = phone.startsWith('91') ? `+${phone}` : `+91${phone}`
    }

    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = phone
      ? `https://wa.me/${phone.replace('+', '')}?text=${encodedMessage}`
      : `https://wa.me/?text=${encodedMessage}`

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
  }

  if (!data.hasPlan) {
    return (
      <div className="min-h-screen bg-surface-secondary p-4 md:p-6">
        <PageHeader
          title="Business Continuity Plan"
          subtitle="Your personalised disaster response guide"
        />
        <SectionCard title="">
          <EmptyState
            icon={ListChecks}
            title="No BCP plan yet"
            description="Generate your personalised Business Continuity Plan based on your shop profile, location, and stock data."
            action={{
              label: isGenerating ? 'Generating…' : 'Generate My Plan',
              onClick: handleRegeneratePlan,
              disabled: isGenerating,
            }}
          />
        </SectionCard>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-secondary p-4 md:p-6">
      {/* Page Header */}
      <PageHeader
        title="Business Continuity Plan"
        subtitle="Your personalised disaster response guide"
        action={
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Regenerate Plan
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Regenerate BCP?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will create a new plan based on your current business profile. Your completed steps will be reset.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex gap-3 justify-end">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRegeneratePlan}>
                  Regenerate
                </AlertDialogAction>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        }
      />

      {/* Progress Badge */}
      <div className="mb-6 text-sm text-muted-foreground">
        {data.beforeStepsCompleted + data.duringStepsCompleted + data.afterStepsCompleted} of{' '}
        {data.beforeStepsTotal + data.duringStepsTotal + data.afterStepsTotal} steps completed
      </div>

      {/* Completion Overview */}
      <SectionCard title="Completion Overview" className="mb-6">
        <Grid container spacing={2} className="mb-4">
          <Grid item xs={12} sm={6} md={4}>
            <StatTile
              label="Before Disaster"
              value={`${data.beforeStepsCompleted}/${data.beforeStepsTotal}`}
              icon={ListChecks}
              variant="default"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatTile
              label="During Disaster"
              value={`${data.duringStepsCompleted}/${data.duringStepsTotal}`}
              icon={AlertCircle}
              variant="default"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatTile
              label="After Disaster"
              value={`${data.afterStepsCompleted}/${data.afterStepsTotal}`}
              icon={RotateCcw}
              variant="default"
            />
          </Grid>
        </Grid>
        <Progress value={data.completionPercent} className="h-3" />
        <div className="text-sm text-muted-foreground mt-2 text-right">
          {data.completionPercent}% complete
        </div>
      </SectionCard>

      {/* BCP Phases - Tabbed */}
      <SectionCard title="Your Plan" className="mb-6">
        <Tabs defaultValue="BEFORE" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="BEFORE">Before</TabsTrigger>
            <TabsTrigger value="DURING">During</TabsTrigger>
            <TabsTrigger value="AFTER">After</TabsTrigger>
          </TabsList>

          {data.bcpPhases.map(phase => (
            <TabsContent key={phase.phase} value={phase.phase} className="space-y-4 mt-4">
              {phase.steps.length === 0 ? (
                <EmptyState
                  icon={PackageOpen}
                  title="No steps yet"
                  description={`No ${phase.phase.toLowerCase()} disaster steps have been generated yet.`}
                />
              ) : (
                phase.steps.map((step, idx) => (
                  <TimelineStep
                    key={step.id}
                    stepNumber={idx + 1}
                    title={step.title}
                    description={step.description}
                    isCompleted={step.isCompleted}
                    isOptional={step.isOptional}
                    onToggle={() => handleToggleStep(step.id, step.isCompleted)}
                  />
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      </SectionCard>

      {/* Emergency Contacts */}
      <SectionCard title="Emergency Contacts" className="mb-6">
        {data.emergencyContacts.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="No emergency contacts"
            description="Add emergency contacts in Settings to display them here."
          />
        ) : (
          <div className="space-y-3">
            {data.emergencyContacts.map(contact => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-4 border rounded-lg bg-background"
              >
                <div>
                  <div className="font-medium">{contact.name}</div>
                  <div className="text-sm text-muted-foreground">{contact.relationship}</div>
                  {contact.isPrimary && (
                    <div className="text-xs text-brand-primary font-medium mt-1">Primary</div>
                  )}
                </div>
                <a
                  href={`tel:${contact.phone}`}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-brand-primary text-white hover:bg-brand-primary/90 transition"
                >
                  <Phone className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Share / Download */}
      <SectionCard title="Share Your Plan">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button variant="outline" className="gap-2" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4" />
            Download as PDF
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleShareWhatsApp}>
            <Share2 className="w-4 h-4" />
            Share via WhatsApp
          </Button>
        </div>
      </SectionCard>
    </div>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()
  return (
    <div className="min-h-screen bg-surface-secondary p-4 md:p-6">
      <ErrorCard
        title="Error loading BCP"
        message={
          isRouteErrorResponse(error) ? error.statusText : 'Failed to load your business continuity plan'
        }
      />
    </div>
  )
}
