import { type ActionFunctionArgs } from '@remix-run/node'
import { authenticator } from '~/lib/auth.server'

/**
 * Logout Route
 *
 * This route handles user logout. It's accessed via a POST form submission
 * from the app shell navigation.
 *
 * The authenticator destroys the session and redirects to /login.
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    throw new Response('Method not allowed', { status: 405 })
  }

  await authenticator.logout(request, { redirectTo: '/login' })
}

/**
 * If someone tries to access this route via GET, throw an error.
 */
export async function loader() {
  throw new Response('Not Found', { status: 404 })
}

export function ErrorBoundary() {
  return (
    <div className="min-h-screen bg-surface-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <h2 className="text-lg font-bold text-text-primary mb-2">Page Not Found</h2>
        <p className="text-text-secondary mb-4">
          This page does not exist.
        </p>
        <a href="/login" className="text-brand-primary hover:underline font-medium">
          Return to Login
        </a>
      </div>
    </div>
  )
}
