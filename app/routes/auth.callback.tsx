import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { authenticator } from '~/lib/auth.server'

/**
 * Google OAuth Callback Handler
 *
 * This route receives the authorization code from Google's OAuth callback.
 * It exchanges the code for an access token, fetches the user profile,
 * and creates or retrieves the user from the database.
 *
 * Always redirects to /register for profile setup/verification.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await authenticator.authenticate('google', request, {
      successRedirect: '/register',
      failureRedirect: '/login',
    })
    return json({ user })
  } catch (error) {
    // Fallback error handling - authenticator handles most cases
    throw new Response('OAuth authentication failed', { status: 401 })
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
