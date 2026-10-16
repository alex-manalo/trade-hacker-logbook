import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Check, FlaskConical, ImagePlus, Pencil, Trash2, Trophy, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStrategies } from '@/lib/strategies';
import { extractBacktest } from '@/lib/backtest.functions';

export type BacktestRow = { id: string; strategy: string; target: number; stop: number; outcome: string; screenshot_path: string | null; created_at: string };

export function useBacktests(userId: string | undefined) {
  return useQuery({
    queryKey: ['backtests', userId], enabled: Boolean(userId),
    queryFn: async () => { const { data, error } = await supabase.from('backtests').select('*').order('created_at', { ascending: false }); if (error) throw error; return data as BacktestRow[]; },
  });
}

export function inPeriod(rows: BacktestRow[], period: string) {
  if (period === 'All time') return rows;
  const from = Date.now() - (period === 'Last 7 days' ? 7 : 30) * 86400000;
  return rows.filter(r => new Date(r.created_at).getTime() >= from);
}

// Results are measured in R (1R = the stop loss): a win earns target/stop, a loss costs 1R.
export function backtestStats(rows: BacktestRow[]) {
  const rOf = (r: BacktestRow) => (r.outcome === 'Win' ? (Number(r.target) / Number(r.stop) || 0) : -1);
  const wins = rows.filter(r => r.outcome === 'Win');
  const losses = rows.length - wins.length;
  const grossWin = wins.reduce((a, r) => a + rOf(r), 0);
  const total = rows.reduce((a, r) => a + rOf(r), 0);
  return {
    count: rows.length, wins: wins.length, losses, total,
    winRate: rows.length ? (wins.length / rows.length) * 100 : 0,
    profitFactor: losses ? grossWin / losses : grossWin > 0 ? Infinity : 0,
    expectancy: rows.length ? total / rows.length : 0,
  };
}

function Shot({ path }: { path: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => { supabase.storage.from('trade-screenshots').createSignedUrl(path, 3600).then(r => setUrl(r.data?.signedUrl)); }, [path]);
  return url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Backtest screenshot" className="h-12 w-20 rounded border border-border object-cover" /></a> : <div className="h-12 w-20" />;
}

export function Backtest({ userId, onSignIn, period = 'All time' }: { userId: string | undefined; onSignIn: () => void; period?: string }) {
  const strategies = useStrategies();
  const qc = useQueryClient();
  const read = useServerFn(extractBacktest);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();
  const [reading, setReading] = useState(false);
  const [form, setForm] = useState({ target: '', stop: '', strategy: '', outcome: 'Win' });
  const [filter, setFilter] = useState('All');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ target: '', stop: '', strategy: '', outcome: 'Win' });

  const list = useBacktests(userId);

  async function pick(f?: File) {
    if (!f) return;
    if (!userId) return onSignIn();
    setFile(f); setPreview(URL.createObjectURL(f)); setReading(true);
    try {
      const image = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
      const x = await read({ data: { image } });
      setForm(p => ({ ...p, target: x.target != null ? String(x.target) : p.target, stop: x.stop != null ? String(x.stop) : p.stop, outcome: x.outcome ?? p.outcome }));
      toast.success('Screenshot read. Check the fields, pick a strategy, then save.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not read the screenshot.'); }
    finally { setReading(false); }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Sign in to save backtests.');
      let screenshot_path: string | null = null;
      if (file) {
        const path = `${userId}/backtest-${crypto.randomUUID()}.${file.name.split('.').pop() || 'png'}`;
        const up = await supabase.storage.from('trade-screenshots').upload(path, file, { contentType: file.type });
        if (up.error) throw up.error; screenshot_path = path;
      }
      const { error } = await supabase.from('backtests').insert({ user_id: userId, strategy: form.strategy || strategies[0] || 'Breakout', target: Number(form.target), stop: Number(form.stop), outcome: form.outcome, screenshot_path });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['backtests'] }); toast.success('Backtest saved.'); setFile(null); setPreview(undefined); setForm(p => ({ ...p, target: '', stop: '' })); },
    onError: e => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (id: string) => {
      const target = Number(draft.target), stop = Number(draft.stop);
      if (!(target > 0) || !(stop > 0)) throw new Error('Target and stop loss must be greater than 0.');
      const { error } = await supabase.from('backtests').update({ strategy: draft.strategy, target, stop, outcome: draft.outcome }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['backtests'] }); toast.success('Backtest updated.'); setEditing(null); },
    onError: e => toast.error(e.message),
  });

  function startEdit(r: BacktestRow) { setEditing(r.id); setDraft({ target: String(Number(r.target)), stop: String(Number(r.stop)), strategy: r.strategy, outcome: r.outcome }); }

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('backtests').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backtests'] }),
    onError: e => toast.error(e.message),
  });

  const all = inPeriod(list.data ?? [], period);
  const rows = all.filter(r => filter === 'All' || r.strategy === filter);
  const wins = rows.filter(r => r.outcome === 'Win').length;
  const byStrategy = [...new Set(all.map(r => r.strategy))].map(s => { const rs = all.filter(r => r.strategy === s); const st = backtestStats(rs); return { s, n: rs.length, wins: st.wins, rate: st.winRate, total: st.total }; })
    .sort((a, b) => b.rate - a.rate || b.n - a.n || b.total - a.total);
  const best = byStrategy[0];

  return (
    <>
      <section className="panel">
        <div className="panel-head"><div className="panel-title"><FlaskConical />Log a backtest</div><span className="panel-meta">UPLOAD & AUTO-FILL</span></div>
        <div className="p-5 space-y-4">
          {preview && <img src={preview} alt="Backtest screenshot preview" className="max-h-64 w-full rounded border border-border object-contain bg-background" />}
          <Button type="button" variant="outline" disabled={reading} asChild><label className="cursor-pointer"><ImagePlus />{reading ? 'Reading screenshot...' : preview ? 'Replace screenshot' : 'Upload backtest screenshot'}<input type="file" accept="image/*" className="hidden" disabled={reading} onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} /></label></Button>
          <form className="form-grid" onSubmit={e => { e.preventDefault(); if (!userId) return onSignIn(); save.mutate(); }}>
            <label className="field">Target (%)<Input type="number" step="any" min={0} required value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} /></label>
            <label className="field">Stop loss (%)<Input type="number" step="any" min={0} required value={form.stop} onChange={e => setForm({ ...form, stop: e.target.value })} /></label>
            <label className="field">Strategy<select value={form.strategy || strategies[0]} onChange={e => setForm({ ...form, strategy: e.target.value })}>{strategies.map(s => <option key={s}>{s}</option>)}</select></label>
            <label className="field">Result<select value={form.outcome} onChange={e => setForm({ ...form, outcome: e.target.value })}><option>Win</option><option>Loss</option></select></label>
            <div className="field full flex-row justify-end"><Button disabled={save.isPending || reading}>{save.isPending ? 'Saving...' : 'Save backtest'}</Button></div>
          </form>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><div className="panel-title"><FlaskConical />Backtest results</div>
          <select aria-label="Filter by strategy" value={filter} onChange={e => setFilter(e.target.value)}><option>All</option>{strategies.map(s => <option key={s}>{s}</option>)}</select></div>
        <div className="p-5 space-y-4">
          {!userId ? <div className="empty">Sign in to log and view your backtests.</div> : <>
            <div className="text-sm font-mono">{rows.length} tests · <span className="positive">{wins} wins</span> · <span className="negative">{rows.length - wins} losses</span> · win rate {rows.length ? ((wins / rows.length) * 100).toFixed(1) : '0.0'}%</div>
            {best && (
              <div className="rounded border border-primary/40 bg-primary/5 p-4 space-y-2" aria-label="Most winnable strategy">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground"><Trophy className="h-4 w-4 text-primary" />Most winnable strategy</div>
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="text-xl font-mono font-semibold">{best.s}</span>
                  <span className="positive font-mono">{best.rate.toFixed(0)}% win rate</span>
                  <span className="text-xs font-mono text-muted-foreground">{best.wins} of {best.n} {best.n === 1 ? 'test' : 'tests'} · {best.total >= 0 ? '+' : ''}{best.total.toFixed(2)}R</span>
                </div>
                {best.n < 5 && <div className="text-xs text-muted-foreground">Based on only {best.n} {best.n === 1 ? 'backtest' : 'backtests'} so far. Log more to make this reliable.</div>}
                {byStrategy.length > 1 && <div className="flex flex-wrap gap-3 text-xs font-mono text-muted-foreground">{byStrategy.slice(1).map(b => <span key={b.s}>{b.s}: {b.rate.toFixed(0)}% of {b.n}</span>)}</div>}
              </div>
            )}
            {rows.length ? <div className="space-y-2">{rows.map(r => (
              <div key={r.id} className="strategy-row gap-3 flex-wrap">
                {r.screenshot_path ? <Shot path={r.screenshot_path} /> : <div className="h-12 w-20" />}
                {editing === r.id ? (
                  <>
                    <select aria-label="Strategy" value={draft.strategy} onChange={e => setDraft({ ...draft, strategy: e.target.value })}>{[...new Set([draft.strategy, ...strategies])].map(x => <option key={x}>{x}</option>)}</select>
                    <Input aria-label="Target (%)" className="w-24" type="number" step="any" min={0} value={draft.target} onChange={e => setDraft({ ...draft, target: e.target.value })} />
                    <Input aria-label="Stop loss (%)" className="w-24" type="number" step="any" min={0} value={draft.stop} onChange={e => setDraft({ ...draft, stop: e.target.value })} />
                    <select aria-label="Result" value={draft.outcome} onChange={e => setDraft({ ...draft, outcome: e.target.value })}><option>Win</option><option>Loss</option></select>
                    <span className="flex-1" />
                    <Button size="icon" variant="ghost" title="Save changes" disabled={update.isPending} onClick={() => update.mutate(r.id)}><Check /></Button>
                    <Button size="icon" variant="ghost" title="Cancel" onClick={() => setEditing(null)}><X /></Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1">{r.strategy} <span className="panel-meta ml-2">{new Date(r.created_at).toLocaleDateString()}</span></span>
                    <span className="text-xs font-mono">TP {Number(r.target)}% · SL {Number(r.stop)}% · R:R {(Number(r.target) / Number(r.stop) || 0).toFixed(2)}</span>
                    <span className={r.outcome === 'Win' ? 'positive' : 'negative'}>{r.outcome.toUpperCase()}</span>
                    <Button size="icon" variant="ghost" title="Edit" onClick={() => startEdit(r)}><Pencil /></Button>
                    <Button size="icon" variant="ghost" title="Delete" onClick={() => { if (window.confirm('Delete this backtest?')) remove.mutate(r.id); }}><Trash2 /></Button>
                  </>
                )}
              </div>))}</div> : <div className="empty">No backtests yet. Upload your first screenshot above.</div>}
          </>}
        </div>
      </section>
    </>
  );
}
