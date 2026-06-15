import { Skeleton } from '~/components/ui/skeleton';
import { cn } from '~/lib/utils';

type SkeletonVariant = 'card' | 'table' | 'stat' | 'list' | 'chat' | 'chart' | 'form';

interface LoadingSkeletonProps {
  variant: SkeletonVariant;
  count?: number;
  className?: string;
}

export function LoadingSkeleton({ variant, count = 3, className }: LoadingSkeletonProps) {
  const renderCard = () => (
    <div className="space-y-3 rounded-lg border border-border-secondary p-4">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );

  const renderTable = () => (
    <div className="space-y-2">
      <div className="flex gap-2 rounded-lg border border-border-secondary p-4">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-2 rounded-lg border border-border-secondary p-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      ))}
    </div>
  );

  const renderStat = () => (
    <div className="space-y-2 rounded-lg border border-border-secondary p-4">
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );

  const renderList = () => (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-lg border border-border-secondary p-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderChat = () => (
    <div className="space-y-3">
      <div className="flex justify-start">
        <Skeleton className="h-10 w-2/3 rounded-lg" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-10 w-1/2 rounded-lg" />
      </div>
      <div className="flex justify-start">
        <Skeleton className="h-10 w-3/5 rounded-lg" />
      </div>
      {Array.from({ length: count - 3 }).map((_, i) => (
        <div key={i} className={i % 2 === 0 ? 'flex justify-start' : 'flex justify-end'}>
          <Skeleton className={cn('h-10 rounded-lg', i % 2 === 0 ? 'w-2/3' : 'w-1/2')} />
        </div>
      ))}
    </div>
  );

  const renderChart = () => (
    <div className="rounded-lg border border-border-secondary p-4">
      <Skeleton className="h-64 w-full" />
    </div>
  );

  const renderForm = () => (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );

  const renderContent = () => {
    switch (variant) {
      case 'card':
        return renderCard();
      case 'table':
        return renderTable();
      case 'stat':
        return renderStat();
      case 'list':
        return renderList();
      case 'chat':
        return renderChat();
      case 'chart':
        return renderChart();
      case 'form':
        return renderForm();
      default:
        return null;
    }
  };

  return <div className={className}>{renderContent()}</div>;
}
