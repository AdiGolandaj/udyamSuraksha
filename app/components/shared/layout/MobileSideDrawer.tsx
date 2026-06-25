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
  Shield,
  Clock,
  BarChart3,
  X,
} from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import { Separator } from '~/components/ui/separator'
import { ScrollArea } from '~/components/ui/scroll-area'
import { cn } from '~/lib/utils'
import { useTranslation } from '~/hooks/useTranslation'

export interface MobileSideDrawerProps {
  role: 'msme' | 'lrdb'
  userId: string
  userName: string
  userAvatar?: string
  open: boolean
  onClose: () => void
}

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: string
}

function getMobileNavItems(role: 'msme' | 'lrdb', userId: string): NavItem[] {
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
    { id: 'shops',      label: 'shared.navigation.shops',      icon: Package,       href: `/lrdb/${userId}/shops` },
    { id: 'queries',    label: 'shared.navigation.queries',    icon: FileText,      href: `/lrdb/${userId}/queries` },
    { id: 'alerts',     label: 'shared.navigation.alerts',     icon: AlertTriangle, href: `/lrdb/${userId}/alerts` },
    { id: 'reports',    label: 'shared.navigation.reports',    icon: BarChart3,     href: `/lrdb/${userId}/reports` },
    { id: 'estimation', label: 'shared.navigation.estimation', icon: TrendingUp,    href: `/lrdb/${userId}/estimation` },
    { id: 'community',  label: 'shared.navigation.chat',       icon: Users,         href: `/lrdb/${userId}/chat` },
    { id: 'settings',   label: 'shared.navigation.settings',   icon: Settings,      href: `/lrdb/${userId}/settings` },
  ]
}

export function MobileSideDrawer({
  role,
  userId,
  userName,
  userAvatar,
  open,
  onClose,
}: MobileSideDrawerProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const navItems = getMobileNavItems(role, userId)

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="w-64 p-0 flex flex-col">
        <SheetHeader className="border-b border-border-default px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-brand-primary" />
              <SheetTitle className="text-brand-primary">{t('common.appName')}</SheetTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Navigation */}
        <ScrollArea className="flex-1">
          <nav className="space-y-2 p-4">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.href)
              const Icon = item.icon

              return (
                <Link
                  key={item.id}
                  to={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-primary-light text-brand-primary'
                      : 'text-text-secondary hover:bg-surface-tertiary'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{t(item.label)}</span>
                </Link>
              )
            })}
          </nav>
        </ScrollArea>

        {/* User Section */}
        <div className="border-t border-border-default p-4">
          <div className="flex items-center gap-3 rounded-lg px-2 py-3 mb-2">
            <Avatar className="h-10 w-10">
              <AvatarImage src={userAvatar} alt={userName} />
              <AvatarFallback>{getInitials(userName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{userName}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-text-secondary hover:text-text-primary"
            onClick={() => {
              onClose()
              window.location.href = '/logout'
            }}
          >
            <LogOut className="h-4 w-4" />
            {t('shared.navigation.logout')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
