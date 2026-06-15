import { useState } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '~/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { Button } from '~/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '~/lib/utils';
import { useTranslation } from '~/hooks/useTranslation';

const CATEGORIES = [
  'Grocery',
  'Pharmacy',
  'Hardware',
  'Textiles',
  'Food & Beverage',
  'Electronics',
  'Agricultural Supplies',
  'Timber & Wood',
  'Dairy',
  'Fuel & Gas',
  'Stationery',
  'Medical Equipment',
  'General Store',
  'Other',
] as const;

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CategorySelect({
  value,
  onChange,
  placeholder,
  disabled = false,
}: CategorySelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {value ? CATEGORIES.find((cat) => cat === value) : placeholder || t('forms.selectCategory')}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder={placeholder || t('forms.searchCategory')} />
          <CommandEmpty>{t('common.noResults')}</CommandEmpty>
          <CommandGroup>
            <CommandList>
              {CATEGORIES.map((category) => (
                <CommandItem
                  key={category}
                  value={category}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? '' : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === category ? 'opacity-100' : 'opacity-0')} />
                  {category}
                </CommandItem>
              ))}
            </CommandList>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
