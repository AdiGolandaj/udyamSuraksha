import { useState } from 'react'
import { useLocation, Link } from '@remix-run/react'
import {
  LayoutDashboard,
  Package,
  AlertTriangle,
  TrendingUp,
  FileText,
  Users,
  Settings,
  LogOut,
  Menu,
  Shield,
  Clock,
  BarChart3,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '~/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Badge } from '~/components/ui/badge'
import { Separator } from '~/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import { cn } from '~/lib/utils'
import { useTranslation } from '~/hooks/useTranslation'
import { MobileSideDrawer } from './MobileSideDrawer'
import { BottomTabBar } from './BottomTabBar'

export interface AppShellProps {
  role: 'msme' | 'lrdb'
  userId: string
  userName: string
  userAvatar?: string
  userEmail: string
  unreadAlertCount?: number
  unreadChatCount?: number
  children: ReactNode
  /** User's preferred language (unused by shell, passed through for context) */
  language?: string
}

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  badge?: number
}

function getMobileNavItems(role: 'msme' | 'lrdb', userId: string): NavItem[] {
  if (role === 'msme') {
    return [
      { id: 'dashboard', label: 'shared.navigation.dashboard', icon: LayoutDashboard, href: `/msme/${userId}/dashboard` },
      { id: 'stock',     label: 'shared.navigation.stock',     icon: Package,         href: `/msme/${userId}/stock` },
      { id: 'alerts',    label: 'shared.navigation.alerts',    icon: AlertTriangle,   href: `/msme/${userId}/alerts` },
      { id: 'community', label: 'shared.navigation.chat',      icon: Users,           href: `/msme/${userId}/chat` },
      { id: 'more',      label: 'shared.buttons.more',         icon: Menu,            href: '#' },
    ]
  }
  // LRDB doesn't have bottom tab bar
  return []
}

function getDesktopNavItems(role: 'msme' | 'lrdb', userId: string): NavItem[] {
  if (role === 'msme') {
    return [
      { id: 'dashboard', label: 'shared.navigation.dashboard', icon: LayoutDashboard, href: `/msme/${userId}/dashboard` },
      { id: 'stock',     label: 'shared.navigation.stock',     icon: Package,         href: `/msme/${userId}/stock` },
      { id: 'bcp',       label: 'shared.navigation.bcp',       icon: Shield,          href: `/msme/${userId}/bcp` },
      { id: 'alerts',    label: 'shared.navigation.alerts',    icon: AlertTriangle,   href: `/msme/${userId}/alerts` },
      { id: 'risk',      label: 'shared.navigation.risk',      icon: TrendingUp,      href: `/msme/${userId}/risk` },
      { id: 'trends',    label: 'shared.navigation.trends',    icon: BarChart3,       href: `/msme/${userId}/trends` },
      { id: 'forecasts', label: 'shared.navigation.forecasts', icon: Clock,           href: `/msme/${userId}/forecasts` },
      { id: 'community', label: 'shared.navigation.chat',      icon: Users,           href: `/msme/${userId}/chat` },
      { id: 'settings',  label: 'shared.navigation.settings',  icon: Settings,        href: `/msme/${userId}/settings` },
    ]
  }

  return [
    { id: 'shops',      label: 'shared.navigation.shops',      icon: Package,     href: `/lrdb/${userId}/shops` },
    { id: 'queries',    label: 'shared.navigation.queries',    icon: FileText,    href: `/lrdb/${userId}/queries` },
    { id: 'alerts',     label: 'shared.navigation.alerts',     icon: AlertTriangle, href: `/lrdb/${userId}/alerts` },
    { id: 'reports',    label: 'shared.navigation.reports',    icon: BarChart3,   href: `/lrdb/${userId}/reports` },
    { id: 'estimation', label: 'shared.navigation.estimation', icon: TrendingUp,  href: `/lrdb/${userId}/estimation` },
    { id: 'community',  label: 'shared.navigation.chat',       icon: Users,       href: `/lrdb/${userId}/chat` },
    { id: 'settings',   label: 'shared.navigation.settings',   icon: Settings,    href: `/lrdb/${userId}/settings` },
  ]
}

export function AppShell({
  role,
  userId,
  userName,
  userAvatar,
  userEmail,
  unreadAlertCount,
  unreadChatCount,
  children,
}: AppShellProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  const desktopNavItems = getDesktopNavItems(role, userId)
  const mobileNavItems = getMobileNavItems(role, userId)

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const NavItemComponent = ({
    item,
    isMobile = false,
  }: {
    item: NavItem
    isMobile?: boolean
  }) => {
    const isActive = item.href !== '#' && location.pathname.startsWith(item.href)
    const Icon = item.icon
    const badge =
      item.id === 'alerts'
        ? unreadAlertCount
        : item.id === 'community'
          ? unreadChatCount
          : undefined

    if (isMobile) {
      return (
        <Link
          to={item.href}
          className={cn(
            'flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors relative',
            isActive
              ? 'bg-brand-primary text-white'
              : 'text-text-secondary hover:bg-surface-tertiary'
          )}
        >
          <div className="relative">
            <Icon className="h-5 w-5" />
            {badge && badge > 0 && (
              <Badge className="absolute -right-2 -top-2 h-5 w-5 flex items-center justify-center p-0 bg-status-critical">
                {badge > 99 ? '99+' : badge}
              </Badge>
            )}
          </div>
          <span>{t(item.label)}</span>
        </Link>
      )
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors relative',
                isActive
                  ? 'bg-brand-primary-light text-brand-primary'
                  : 'text-text-secondary hover:bg-surface-tertiary'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="flex-1">{t(item.label)}</span>
              {badge && badge > 0 && (
                <Badge className="bg-status-critical ml-auto">{badge > 99 ? '99+' : badge}</Badge>
              )}
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">{t(item.label)}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-surface-secondary lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden h-screen w-60 flex-col border-r border-border-default bg-surface-primary lg:flex">
        {/* Logo/Brand */}
        <div className="flex items-center gap-2 border-b border-border-default px-4 py-4">
          <Shield className="h-6 w-6 text-brand-primary" />
          <h1 className="text-lg font-bold text-brand-primary">{t('common.appName')}</h1>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1">
          <nav className="space-y-2 p-4">
            {desktopNavItems.map((item) => (
              <NavItemComponent key={item.id} item={item} />
            ))}
          </nav>
        </ScrollArea>

        {/* User Section */}
        <div className="border-t border-border-default p-4">
          <div className="flex items-center gap-3 rounded-lg px-2 py-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={userAvatar} alt={userName} />
              <AvatarFallback>{getInitials(userName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{userName}</p>
              <p className="text-xs text-text-secondary truncate">{userEmail}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-text-secondary hover:text-text-primary"
            onClick={() => {
              // Logout action
              window.location.href = '/logout'
            }}
          >
            <LogOut className="h-4 w-4" />
            {t('shared.navigation.logout')}
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="flex items-center justify-between border-b border-border-default bg-surface-primary px-4 py-3 lg:hidden">
          <h1 className="text-lg font-bold text-brand-primary">{t('common.appName')}</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileDrawerOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>

        {/* Mobile Bottom Tab Bar (MSME only) */}
        {role === 'msme' && (
          <BottomTabBar
            userId={userId}
            unreadAlertCount={unreadAlertCount}
            unreadChatCount={unreadChatCount}
          />
        )}
      </div>

      {/* Mobile Drawer */}
      <MobileSideDrawer
        role={role}
        userId={userId}
        userName={userName}
        userAvatar={userAvatar}
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
      />
    </div>
  )
}
