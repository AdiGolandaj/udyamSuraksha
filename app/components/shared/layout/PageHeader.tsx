import { ReactNode, ComponentType } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from '@remix-run/react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '~/components/ui/breadcrumb'
import { cn } from '~/lib/utils'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: ComponentType<{ className?: string }>
  action?: ReactNode
  breadcrumb?: Array<{
    label: string
    href?: string
  }>
}

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  action,
  breadcrumb,
}: PageHeaderProps) {
  return (
    <div className="space-y-4 border-b border-border-default bg-surface-primary px-4 py-6 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      {breadcrumb && breadcrumb.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumb.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                {index > 0 && (
                  <BreadcrumbSeparator>
                    <ChevronRight className="h-4 w-4" />
                  </BreadcrumbSeparator>
                )}
                <BreadcrumbItem>
                  {item.href ? (
                    <BreadcrumbLink asChild>
                      <Link to={item.href}>{item.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </div>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Title Section */}
        <div className="flex items-start gap-3 flex-1">
          {Icon && <Icon className="h-6 w-6 text-brand-primary mt-1 flex-shrink-0" />}
          <div className="min-w-0 flex-1">
            <h1 className="text-h1 font-bold text-text-primary">{title}</h1>
            {subtitle && <p className="mt-1 text-body text-text-secondary">{subtitle}</p>}
          </div>
        </div>

        {/* Action Slot */}
        {action && (
          <div className="w-full sm:w-auto sm:flex-shrink-0">{action}</div>
        )}
      </div>
    </div>
  )
}
