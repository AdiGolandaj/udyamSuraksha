import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { authenticator } from '~/lib/auth.server'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { MapPin, LogIn } from 'lucide-react'

export async function loader({ request }: LoaderFunctionArgs) {
  // If already authenticated, redirect to dashboard
  const user = await authenticator.isAuthenticated(request)
  if (user) {
    if (user.role === 'msme') {
      return { redirect: `/msme/${user.id}/dashboard` }
    } else if (user.role === 'lrdb') {
      return { redirect: `/lrdb/${user.id}/shops` }
    }
  }
  return json({ user: null })
}

export async function action({ request }: ActionFunctionArgs) {
  return authenticator.authenticate('google', request)
}

export function ErrorBoundary() {
  return (
    <div className="min-h-screen bg-surface-secondary flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-brand-primary mb-2">Something went wrong</h1>
          <p className="text-text-secondary">An error occurred during authentication. Please try again.</p>
        </div>
        <a href="/" className="text-brand-primary hover:underline text-sm">
          Return to Login
        </a>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  const data = useLoaderData<typeof loader>()
  const user = 'user' in data ? data.user : null

  return (
    <div className="min-h-screen bg-surface-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <MapPin className="w-10 h-10 text-brand-primary" />
            <h1 className="text-3xl font-bold text-brand-primary">DisasterShield</h1>
          </div>
          <p className="text-lg text-text-secondary mb-1">
            Protect your business. Stay ahead of disasters.
          </p>
          <p className="text-sm text-text-muted">
            For small business owners &amp; disaster management officers
          </p>
        </div>

        {/* Login Card */}
        <Card className="p-8">
          <form method="POST" className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">
                Choose your role to get started:
              </p>
              <ul className="text-sm text-text-muted space-y-2 py-2">
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary mt-0.5">•</span>
                  <span><strong>MSME Owner:</strong> Get personalized disaster alerts &amp; business continuity plans</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary mt-0.5">•</span>
                  <span><strong>LRDB Officer:</strong> Coordinate disaster response across your district</span>
                </li>
              </ul>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign in with Google
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-text-muted text-center">
              By signing in, you agree to our{' '}
              <a href="/terms" className="text-brand-primary hover:underline">
                Terms of Service
              </a>
            </p>
          </div>
        </Card>

        {/* Language Selector - Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-text-muted">
            Language selection available after login
          </p>
        </div>
      </div>
    </div>
  )
}
