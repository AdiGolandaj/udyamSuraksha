import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';
import { useTranslation } from '~/hooks/useTranslation';
import React from 'react';

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
    disabled?: boolean;
  };
  size?: 'sm' | 'md' | 'lg';
}

const sizeConfig = {
  sm: { iconSize: 'h-8 w-8', containerClass: 'py-4 px-2' },
  md: { iconSize: 'h-12 w-12', containerClass: 'py-8 px-4' },
  lg: { iconSize: 'h-16 w-16', containerClass: 'py-12 px-6' },
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = 'md',
}: EmptyStateProps) {
  const { t } = useTranslation();
  const config = sizeConfig[size];

  return (
    <div className={cn('flex flex-col items-center justify-center text-center', config.containerClass)}>
      <Icon className={cn('text-text-tertiary mb-3', config.iconSize)} />
      <h3 className="font-semibold text-text-primary mb-1">{title}</h3>
      <p className="text-sm text-text-secondary mb-4 max-w-xs">{description}</p>
      {action && (
        <Button
          variant="outline"
          size="sm"
          onClick={action.onClick}
          disabled={action.disabled}
          {...(action.href && { asChild: true })}
        >
          {action.href ? <a href={action.href}>{action.label}</a> : action.label}
        </Button>
      )}
    </div>
  );
}
