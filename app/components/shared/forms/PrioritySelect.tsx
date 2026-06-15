import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { useTranslation } from '~/hooks/useTranslation';

type QueryPriority = 'low' | 'medium' | 'high' | 'critical';

const PRIORITY_OPTIONS: { value: QueryPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low Priority', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'medium', label: 'Medium Priority', color: 'bg-amber-100 text-amber-700' },
  { value: 'high', label: 'High Priority', color: 'bg-orange-100 text-orange-700' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700' },
];

interface PrioritySelectProps {
  value: QueryPriority;
  onChange: (value: QueryPriority) => void;
  disabled?: boolean;
}

export function PrioritySelect({ value, onChange, disabled = false }: PrioritySelectProps) {
  const { t } = useTranslation();

  return (
    <Select value={value} onValueChange={(val) => onChange(val as QueryPriority)} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t('forms.selectPriority')} />
      </SelectTrigger>
      <SelectContent>
        {PRIORITY_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {t(`priority.${option.value}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
