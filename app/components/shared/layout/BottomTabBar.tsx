import { useState } from 'react'
import { useLocation, Link } from '@remix-run/react'
import { LayoutDashboard, Package, AlertTriangle, Users, MoreVertical } from 'lucide-react'

import { Badge } from '~/components/ui/badge'
import { cn } from '~/lib/utils'
import { useTranslation } from '~/hooks/useTranslation'
import { MobileSideDrawer } from './MobileSideDrawer'

export interface BottomTabBarProps {
  userId: string
  userName?: string
  userAvatar?: string
  unreadAlertCount?: number
  unreadChatCount?: number
}

interface TabItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: string
}

function getMainTabs(userId: string): TabItem[] {
  return [
    { id: 'dashboard', label: 'shared.navigation.dashboard', icon: LayoutDashboard, href: `/msme/${userId}/dashboard` },
    { id: 'stock',     label: 'shared.navigation.stock',     icon: Package,         href: `/msme/${userId}/stock` },
    { id: 'alerts',    label: 'shared.navigation.alerts',    icon: AlertTriangle,   href: `/msme/${userId}/alerts` },
    { id: 'community', label: 'shared.navigation.chat',      icon: Users,           href: `/msme/${userId}/chat` },
  ]
}

export function BottomTabBar({
  userId,
  userName = 'User',
  userAvatar,
  unreadAlertCount,
  unreadChatCount,
}: BottomTabBarProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const mainTabs = getMainTabs(userId)

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 border-t border-border-default bg-surface-primary px-0 py-2 lg:hidden">
        <div className="flex items-center justify-around">
          {mainTabs.map((tab) => {
            const isActive = location.pathname.startsWith(tab.href)
            const Icon = tab.icon
            const badge =
              tab.id === 'alerts'
                ? unreadAlertCount
                : tab.id === 'community'
                  ? unreadChatCount
                  : undefined

            return (
              <Link
                key={tab.id}
                to={tab.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors relative',
                  isActive
                    ? 'text-brand-primary'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {badge && badge > 0 && (
                    <Badge className="absolute -right-2 -top-2 h-5 w-5 flex items-center justify-center p-0 bg-status-critical text-white text-xs">
                      {badge > 99 ? '99+' : badge}
                    </Badge>
                  )}
                </div>
                <span className="text-xs">{t(tab.label)}</span>
              </Link>
            )
          })}

          {/* More Button */}
          <button
            onClick={() => setDrawerOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
              'text-text-secondary hover:text-text-primary'
            )}
          >
            <div className="relative">
              <MoreVertical className="h-5 w-5" />
            </div>
            <span className="text-xs">{t('shared.buttons.more')}</span>
          </button>
        </div>
      </nav>

      {/* Mobile Drawer for "More" items */}
      <MobileSideDrawer
        role="msme"
        userId={userId}
        userName={userName}
        userAvatar={userAvatar}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  )
}
