import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Button } from '~/components/ui/button';
import { useTranslation } from '~/hooks/useTranslation';
import { useLanguage } from '~/hooks/useLanguage';

const LANGUAGE_OPTIONS = [
  { value: 'en', label: '🇬🇧 English', name: 'English' },
  { value: 'mr', label: '🇮🇳 मराठी', name: 'Marathi' },
  { value: 'hi', label: '🇮🇳 हिंदी', name: 'Hindi' },
] as const;

interface LanguageSelectorProps {
  currentLanguage: 'en' | 'mr' | 'hi';
  variant?: 'full' | 'compact';
}

export function LanguageSelector({ currentLanguage, variant = 'full' }: LanguageSelectorProps) {
  const { t } = useTranslation();
  const { setLanguage } = useLanguage();

  const currentOption = LANGUAGE_OPTIONS.find((opt) => opt.value === currentLanguage);

  const handleChange = (value: string) => {
    setLanguage(value as 'en' | 'mr' | 'hi');
  };

  if (variant === 'compact') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" title={t('settings.language')}>
            {currentOption?.label.split(' ')[0]}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {LANGUAGE_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleChange(option.value)}
              className={currentLanguage === option.value ? 'bg-surface-tertiary' : ''}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Select value={currentLanguage} onValueChange={handleChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LANGUAGE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
