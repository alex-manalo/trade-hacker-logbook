import { Check } from 'lucide-react';
import { useStrategies } from '@/lib/strategies';

export function StrategyPicker({ value, onChange, label = 'Strategies', userId }: { value: string[]; onChange: (v: string[]) => void; label?: string; userId?: string | undefined }) {
  const list = useStrategies(userId);
  const options = [...new Set([...list, ...value])];
  return (
    <div className="field full">
      <span>{label} <span className="panel-meta">(pick one or more)</span></span>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map(s => {
          const on = value.includes(s);
          return (
            <button key={s} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter(x => x !== s) : [...value, s])}
              className={`inline-flex items-center gap-1 rounded border px-2 py-1 font-mono text-xs transition-colors ${on ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
              {on && <Check className="h-3 w-3" />}{s}
            </button>
          );
        })}
      </div>
    </div>
  );
}
