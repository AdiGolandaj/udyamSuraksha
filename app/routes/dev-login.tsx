import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node'
import { useLoaderData, Form, Link } from '@remix-run/react'
import { db } from '~/lib/db.server'
import { getSession, commitSession } from '~/lib/session.server'
import type { SessionUser } from '~/lib/auth.server'
import { Shield, ArrowLeft, User, Building2 } from 'lucide-react'

// ── Blocked in production ─────────────────────────────────────────────────────
function guardDev() {
  if (process.env.NODE_ENV === 'production') {
    throw new Response('Not Found', { status: 404 })
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  guardDev()

  const users = await db.user.findMany({
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    include: {
      shopProfile: { select: { shopName: true, district: true, category: true } },
      lrdbOfficer: { select: { designation: true, district: true } },
    },
  })

  return json({ users })
}

export async function action({ request }: ActionFunctionArgs) {
  guardDev()

  const formData = await request.formData()
  const userId   = formData.get('userId') as string | null

  if (!userId) throw new Response('userId is required', { status: 400 })

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new Response('User not found', { status: 404 })

  const sessionUser: SessionUser = {
    id:       user.id,
    role:     user.role.toLowerCase() as 'msme' | 'lrdb',
    name:     user.name,
    email:    user.email,
    avatar:   user.avatarUrl ?? undefined,
    language: (user.language ?? 'en') as 'en' | 'mr' | 'hi',
  }

  const session = await getSession(request.headers.get('Cookie'))
  session.set('user', sessionUser)

  const redirectTo = user.role === 'MSME'
    ? `/msme/${user.id}/dashboard`
    : `/lrdb/${user.id}/shops`

  return redirect(redirectTo, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export default function DevLoginPage() {
  const { users } = useLoaderData<typeof loader>()

  const msmeUsers = users.filter(u => u.role === 'MSME')
  const lrdbUsers = users.filter(u => u.role === 'LRDB')
  const isSeedUser = (email: string) => email.endsWith('@disastershield.test')

  return (
    <div className="min-h-screen bg-surface-secondary p-4 flex flex-col items-center justify-start pt-12">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-7 w-7 text-brand-primary" />
          <h1 className="text-2xl font-bold text-brand-primary">DisasterShield</h1>
        </div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Dev Login</h2>
            <p className="text-sm text-text-secondary">
              Click any user to log in instantly — no Google OAuth, no password.
            </p>
          </div>
          <Link
            to="/login"
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
        </div>

        {/* Dev-only warning banner */}
        <div className="mb-6 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <strong>Development only.</strong> This page does not exist in production.
        </div>

        {/* MSME Users */}
        <Section
          title="MSME Shop Owners"
          icon={<Building2 className="h-4 w-4" />}
          count={msmeUsers.length}
        >
          {msmeUsers.length === 0 && (
            <EmptyNote>No MSME users found. Register one via Google or run the seed script.</EmptyNote>
          )}
          {msmeUsers.map(user => (
            <UserCard
              key={user.id}
              name={user.name}
              email={user.email}
              subtitle={user.shopProfile?.shopName ?? 'No shop profile yet'}
              detail={user.shopProfile ? `${user.shopProfile.category} · ${user.shopProfile.district}` : undefined}
              isSeed={isSeedUser(user.email)}
              userId={user.id}
            />
          ))}
        </Section>

        {/* LRDB Users */}
        <Section
          title="LRDB Officers"
          icon={<User className="h-4 w-4" />}
          count={lrdbUsers.length}
        >
          {lrdbUsers.length === 0 && (
            <EmptyNote>No LRDB users found. Register one via Google or run the seed script.</EmptyNote>
          )}
          {lrdbUsers.map(user => (
            <UserCard
              key={user.id}
              name={user.name}
              email={user.email}
              subtitle={user.lrdbOfficer?.designation ?? 'No officer profile yet'}
              detail={user.lrdbOfficer ? `District: ${user.lrdbOfficer.district}` : undefined}
              isSeed={isSeedUser(user.email)}
              userId={user.id}
            />
          ))}
        </Section>

      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, icon, count, children }: {
  title: string
  icon: React.ReactNode
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-text-secondary">{icon}</span>
        <h3 className="font-semibold text-text-primary">{title}</h3>
        <span className="ml-auto text-xs text-text-tertiary">{count} user{count !== 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function UserCard({ name, email, subtitle, detail, isSeed, userId }: {
  name: string
  email: string
  subtitle: string
  detail?: string
  isSeed: boolean
  userId: string
}) {
  return (
    <Form method="POST">
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        className="w-full text-left flex items-center justify-between gap-4 px-4 py-3 rounded-lg border border-border-default bg-surface-primary hover:border-brand-primary hover:bg-brand-primary-light transition-colors group"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-medium text-text-primary text-sm">{name}</span>
            {isSeed && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-surface-tertiary text-text-tertiary font-mono">
                seed
              </span>
            )}
          </div>
          <div className="text-xs text-text-secondary truncate">{email}</div>
          <div className="text-xs text-text-tertiary mt-0.5">{subtitle}{detail ? ` · ${detail}` : ''}</div>
        </div>
        <span className="text-xs text-brand-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          Log in →
        </span>
      </button>
    </Form>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-6 text-center text-sm text-text-tertiary border border-dashed border-border-default rounded-lg">
      {children}
    </div>
  )
}
