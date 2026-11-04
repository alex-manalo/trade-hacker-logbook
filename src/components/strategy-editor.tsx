import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Trash2, Crosshair } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addStrategy, joinStrategies, removeStrategy, renameStrategy, strategiesOf, useStrategies } from '@/lib/strategies';
import type { Trade } from '@/lib/trades';

export function StrategyEditor({ trades, userId }: { trades: Trade[]; userId?: string | undefined }) {
  const list = useStrategies(userId);
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['strategies'] });
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');

  async function rename(from: string) {
    const to = name.trim();
    if (!to || to === from) return setEditing(null);
    if (list.includes(to)) return toast.error('A strategy with that name already exists.');
    try {
      await renameStrategy(userId, from, to);
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : 'Could not rename the strategy.');
    }
    refresh();
    setEditing(null);
    if (userId) {
      for (const table of ['trades', 'backtests'] as const) {
        const { data, error } = await supabase.from(table).select('id,strategy,strategies').or(`strategy.eq."${from}",strategies.cs.{"${from}"}`);
        if (error) return toast.error(error.message);
        for (const r of data ?? []) {
          const next = [...new Set(strategiesOf(r).map(s => (s === from ? to : s)))];
          const u = await supabase.from(table).update({ strategy: joinStrategies(next), strategies: next }).eq('id', r.id);
          if (u.error) return toast.error(u.error.message);
        }
      }
      qc.invalidateQueries({ queryKey: ['trades'] });
      qc.invalidateQueries({ queryKey: ['backtests'] });
    }
    toast.success(`Renamed to ${to}.`);
  }

  return (
    <section className="panel">
      <div className="panel-head"><div className="panel-title"><Crosshair />Edit strategies</div><span className="panel-meta">{list.length} PLAYBOOKS</span></div>
      <div className="space-y-2 p-5">
        {list.map(s => {
          const used = trades.filter(t => t.strategy === s).length;
          return (
            <div key={s} className="strategy-row gap-2">
              {editing === s ? (
                <form className="flex flex-1 gap-2" onSubmit={e => { e.preventDefault(); rename(s); }}>
                  <Input autoFocus value={name} onChange={e => setName(e.target.value)} />
                  <Button size="icon" type="submit" title="Save name"><Check /></Button>
                </form>
              ) : (
                <>
                  <span className="flex-1">{s} <span className="panel-meta ml-2">{used} TRADES</span></span>
                  <Button size="icon" variant="ghost" title="Rename" onClick={() => { setEditing(s); setName(s); }}><Pencil /></Button>
                  <Button size="icon" variant="ghost" title="Remove" onClick={async () => {
                    if (used && !window.confirm(`${used} trade(s) use "${s}". They keep the label, but it will leave this list. Remove?`)) return;
                    try {
                      await removeStrategy(userId, s);
                      refresh();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Could not remove the strategy.');
                    }
                  }}><Trash2 /></Button>
                </>
              )}
            </div>
          );
        })}
        <form className="flex gap-2 pt-2" onSubmit={async e => { e.preventDefault(); if (!draft.trim()) return; if (list.includes(draft.trim())) { toast.error("Already in your list."); return; } try { await addStrategy(userId, draft); refresh(); setDraft(""); } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not add the strategy.'); } }}>
          <Input placeholder="New strategy name" value={draft} onChange={e => setDraft(e.target.value)} />
          <Button type="submit"><Plus />Add</Button>
        </form>
      </div>
    </section>
  );
}
