import { useState } from 'react';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { MapPin, Loader2 } from 'lucide-react';
import { useTranslation } from '~/hooks/useTranslation';

interface LocationPickerProps {
  value: string;
  onChange: (value: string) => void;
  onCoordinatesChange?: (coords: { lat: number; lng: number }) => void;
  disabled?: boolean;
}

export function LocationPicker({
  value,
  onChange,
  onCoordinatesChange,
  disabled = false,
}: LocationPickerProps) {
  const { t } = useTranslation();
  const [isLocating, setIsLocating] = useState(false);

  const handleGetLocation = async () => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported');
      return;
    }

    setIsLocating(true);
    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          onCoordinatesChange?.({ lat: latitude, lng: longitude });

          try {
            // Reverse geocode to get human-readable address
            const response = await fetch(
              `/api/reverse-geocode?lat=${latitude}&lng=${longitude}`,
              { method: 'GET' },
            );
            if (response.ok) {
              const data = await response.json();
              onChange(data.address || `${latitude}, ${longitude}`);
            } else {
              onChange(`${latitude}, ${longitude}`);
            }
          } catch {
            onChange(`${latitude}, ${longitude}`);
          } finally {
            setIsLocating(false);
          }
        },
        () => {
          setIsLocating(false);
          console.error('Failed to get geolocation');
        },
      );
    } catch (error) {
      console.error('Geolocation error:', error);
      setIsLocating(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('forms.enterLocation')}
          disabled={disabled || isLocating}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleGetLocation}
          disabled={disabled || isLocating}
          size="icon"
        >
          {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-xs text-text-secondary">{t('forms.locationHint')}</p>
    </div>
  );
}
