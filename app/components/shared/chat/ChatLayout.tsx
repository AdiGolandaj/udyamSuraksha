import React from 'react'
import { cn } from '~/lib/utils'

export interface ChatLayoutProps {
  role: 'msme' | 'lrdb'
  userId: string
  activeGroupId?: string
  children: React.ReactNode
}

/**
 * ChatLayout
 * 
 * Root layout container for chat pages.
 * Provides two-column layout with sidebar and thread area.
 * Responsive: stacks on mobile, side-by-side on desktop.
 */
export function ChatLayout({
  role,
  userId,
  activeGroupId,
  children,
}: ChatLayoutProps) {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] gap-0">
      {/* Left panel: Sidebar (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-80 lg:flex-col border-r border-border-default bg-surface-primary">
        {React.Children.map(children, (child) => {
          if (
            React.isValidElement(child) &&
            (child.type as any).displayName === 'ChatSidebar'
          ) {
            return child
          }
          return null
        })}
      </div>

      {/* Mobile sidebar toggle button */}
      <div className="lg:hidden flex items-center px-4 py-2 border-b border-border-default">
        {/* Mobile hamburger can be added here */}
      </div>

      {/* Right panel: Thread area (full width on mobile) */}
      <div className="flex-1 flex flex-col overflow-hidden bg-surface-primary">
        {React.Children.map(children, (child) => {
          if (
            React.isValidElement(child) &&
            ((child.type as any).displayName === 'ChatThread' ||
              !(child.type as any).displayName)
          ) {
            return child
          }
          return null
        })}
      </div>
    </div>
  )
}

ChatLayout.displayName = 'ChatLayout'
