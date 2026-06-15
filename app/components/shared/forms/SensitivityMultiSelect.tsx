import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { SensitivityTag } from '~/components/shared/data-display';
import { useTranslation } from '~/hooks/useTranslation';
import { X } from 'lucide-react';

type SensitivityType = 'water' | 'heat' | 'fragile' | 'perishable' | 'flammable' | 'theft' | 'humidity';

const SENSITIVITY_TYPES: SensitivityType[] = ['water', 'heat', 'fragile', 'perishable', 'flammable', 'theft', 'humidity'];

interface SensitivityMultiSelectProps {
  selected: SensitivityType[];
  onChange: (selected: SensitivityType[]) => void;
  disabled?: boolean;
}

export function SensitivityMultiSelect({
  selected,
  onChange,
  disabled = false,
}: SensitivityMultiSelectProps) {
  const { t } = useTranslation();

  const toggleSensitivity = (type: SensitivityType) => {
    if (selected.includes(type)) {
      onChange(selected.filter((s) => s !== type));
    } else {
      onChange([...selected, type]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {SENSITIVITY_TYPES.map((type) => (
          <Button
            key={type}
            variant={selected.includes(type) ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleSensitivity(type)}
            disabled={disabled}
            className="gap-2"
          >
            <SensitivityTag type={type} size="sm" showIcon={true} />
          </Button>
        ))}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((type) => (
            <Badge key={type} variant="secondary" className="gap-2">
              {t(`sensitivity.${type}`)}
              <button
                onClick={() => toggleSensitivity(type)}
                disabled={disabled}
                className="ml-1 hover:opacity-70"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
