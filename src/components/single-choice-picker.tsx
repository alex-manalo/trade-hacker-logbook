import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SingleChoicePicker({ value, onChange, options, label, className = 'field' }: { value: string; onChange: (value: string) => void; options: readonly string[]; label: string; className?: string }) {
  return (
    <div className={className}>
      <span>{label}</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map(option => {
          const selected = value === option;
          return (
            <Button
              key={option}
              type="button"
              size="sm"
              variant="outline"
              aria-pressed={selected}
              onClick={() => onChange(option)}
              className={`font-mono text-xs ${selected ? 'border-primary bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary' : 'text-muted-foreground'}`}
            >
              {selected && <Check className="h-3 w-3" />}
              {option}
            </Button>
          );
        })}
      </div>
    </div>
  );
}