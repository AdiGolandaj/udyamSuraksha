import { type LoaderFunctionArgs } from '@remix-run/node'
import { authenticator } from '~/lib/auth.server'

export async function loader({ request }: LoaderFunctionArgs) {
  // remix-auth throws a Response (redirect) on both success and failure,
  // so we must let Response instances propagate and only catch real errors.
  try {
    return await authenticator.authenticate('google', request, {
      successRedirect: '/register',
      failureRedirect: '/login',
    })
  } catch (error) {
    if (error instanceof Response) throw error
    throw new Response('OAuth authentication failed', { status: 500 })
  }
}

export function ErrorBoundary() {
  return (
    <div className="min-h-screen bg-surface-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-feedback-error/10 border border-feedback-error rounded-lg p-6 text-center">
          <h2 className="text-lg font-bold text-feedback-error mb-2">Authentication Error</h2>
          <p className="text-text-secondary mb-4">
            There was a problem signing you in with Google. Please try again.
          </p>
          <a href="/login" className="text-brand-primary hover:underline font-medium">
            Return to Login
          </a>
        </div>
      </div>
    </div>
  )
}
