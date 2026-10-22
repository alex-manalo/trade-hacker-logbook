import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Check, FlaskConical, ImagePlus, Pencil, Trash2, Trophy, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useStrategies } from '@/lib/strategies';
import { extractBacktest } from '@/lib/backtest.functions';

export type BacktestRow = { id: string; strategy: string; target: number; stop: number; outcome: string; notes: string; screenshot_path: string | null; created_at: string };

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

// Strategies ranked by win rate; ties go to the larger sample, then to total R.
export function rankStrategies(rows: BacktestRow[]) {
  return [...new Set(rows.map(r => r.strategy))].map(s => { const st = backtestStats(rows.filter(r => r.strategy === s)); return { s, n: st.count, wins: st.wins, rate: st.winRate, total: st.total }; })
    .sort((a, b) => b.rate - a.rate || b.n - a.n || b.total - a.total);
}

function useShotUrl(path: string) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let live = true;
    supabase.storage.from('trade-screenshots').createSignedUrl(path, 3600).then(r => { if (live) setUrl(r.data?.signedUrl); });
    return () => { live = false; };
  }, [path]);
  return url;
}

function CardShot({ path }: { path: string }) {
  const url = useShotUrl(path);
  return url ? <img src={url} alt="Backtest screenshot" loading="lazy" /> : null;
}

function BigShot({ path }: { path: string }) {
  const url = useShotUrl(path);
  return url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Backtest screenshot" className="max-h-72 w-full rounded border border-border object-contain bg-background" /></a> : null;
}

function BacktestDialog({ row, onClose, onEdit, onDelete }: { row: BacktestRow | null; onClose: () => void; onEdit: (r: BacktestRow) => void; onDelete: (id: string) => void }) {
  if (!row) return null;
  const rr = Number(row.target) / Number(row.stop) || 0;
  const r = row.outcome === 'Win' ? rr : -1;
  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-auto space-y-4">
        <DialogTitle className="font-mono">Backtest record <span className={r >= 0 ? 'positive' : 'negative'}>{r >= 0 ? '+' : ''}{r.toFixed(2)}R</span></DialogTitle>
        <DialogDescription>Strategy test & outcome</DialogDescription>
        {row.screenshot_path && <BigShot path={row.screenshot_path} />}
        <div className="grid grid-cols-2 gap-3 text-sm font-mono">
          <div><div className="panel-meta">STRATEGY</div>{row.strategy}</div>
          <div><div className="panel-meta">DATE</div>{new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</div>
          <div><div className="panel-meta">TARGET</div>{Number(row.target)}%</div>
          <div><div className="panel-meta">STOP LOSS</div>{Number(row.stop)}%</div>
          <div><div className="panel-meta">RISK : REWARD</div>{rr.toFixed(2)}</div>
          <div><div className="panel-meta">RESULT</div><span className={row.outcome === 'Win' ? 'positive' : 'negative'}>{row.outcome.toUpperCase()}</span></div>
        </div>
        {row.notes && <div><div className="panel-meta">NOTES</div><p className="text-sm text-muted-foreground whitespace-pre-wrap">{row.notes}</p></div>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onEdit(row)}><Pencil />Edit</Button>
          <Button variant="outline" onClick={() => { if (window.confirm('Delete this backtest?')) onDelete(row.id); }}><Trash2 />Delete</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Backtest({ userId, onSignIn, period = 'All time' }: { userId: string | undefined; onSignIn: () => void; period?: string }) {
  const strategies = useStrategies();
  const qc = useQueryClient();
  const read = useServerFn(extractBacktest);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();
  const [reading, setReading] = useState(false);
  const [form, setForm] = useState({ target: '', stop: '', strategy: '', outcome: 'Win', notes: '' });
  const [filter, setFilter] = useState('All');
  const [editing, setEditing] = useState<string | null>(null);
  const [viewing, setViewing] = useState<BacktestRow | null>(null);
  const [draft, setDraft] = useState({ target: '', stop: '', strategy: '', outcome: 'Win', notes: '' });

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
      const { error } = await supabase.from('backtests').insert({ user_id: userId, strategy: form.strategy || strategies[0] || 'Breakout', target: Number(form.target), stop: Number(form.stop), outcome: form.outcome, notes: form.notes, screenshot_path });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['backtests'] }); toast.success('Backtest saved.'); setFile(null); setPreview(undefined); setForm(p => ({ ...p, target: '', stop: '', notes: '' })); },
    onError: e => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (id: string) => {
      const target = Number(draft.target), stop = Number(draft.stop);
      if (!(target > 0) || !(stop > 0)) throw new Error('Target and stop loss must be greater than 0.');
      const { error } = await supabase.from('backtests').update({ strategy: draft.strategy, target, stop, outcome: draft.outcome, notes: draft.notes }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['backtests'] }); toast.success('Backtest updated.'); setEditing(null); },
    onError: e => toast.error(e.message),
  });

  function startEdit(r: BacktestRow) { setEditing(r.id); setDraft({ target: String(Number(r.target)), stop: String(Number(r.stop)), strategy: r.strategy, outcome: r.outcome, notes: r.notes ?? '' }); }

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('backtests').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backtests'] }),
    onError: e => toast.error(e.message),
  });

  const all = inPeriod(list.data ?? [], period);
  const rows = all.filter(r => filter === 'All' || r.strategy === filter);
  const filterOptions = [...new Set([...strategies, ...all.map(r => r.strategy)])];
  const wins = rows.filter(r => r.outcome === 'Win').length;
  const byStrategy = rankStrategies(all);
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
            <label className="field full">Notes<Input placeholder="What did you test? Market, session, conditions..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
            <div className="field full flex-row justify-end"><Button disabled={save.isPending || reading}>{save.isPending ? 'Saving...' : 'Save backtest'}</Button></div>
          </form>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><div className="panel-title"><FlaskConical />Backtest results</div>
          <select aria-label="Filter by strategy" value={filter} onChange={e => setFilter(e.target.value)}><option>All</option>{filterOptions.map(s => <option key={s}>{s}</option>)}</select></div>
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
            {rows.length ? <div className="bt-grid">{rows.map(r => {
              const rr = Number(r.target) / Number(r.stop) || 0;
              const win = r.outcome === 'Win';
              return editing === r.id ? (
                <div key={r.id} className="bt-card bt-edit">
                  <label className="field">Strategy<select aria-label="Strategy" value={draft.strategy} onChange={e => setDraft({ ...draft, strategy: e.target.value })}>{[...new Set([draft.strategy, ...strategies])].map(x => <option key={x}>{x}</option>)}</select></label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="field">Target (%)<Input aria-label="Target (%)" type="number" step="any" min={0} value={draft.target} onChange={e => setDraft({ ...draft, target: e.target.value })} /></label>
                    <label className="field">Stop loss (%)<Input aria-label="Stop loss (%)" type="number" step="any" min={0} value={draft.stop} onChange={e => setDraft({ ...draft, stop: e.target.value })} /></label>
                  </div>
                  <label className="field">Result<select aria-label="Result" value={draft.outcome} onChange={e => setDraft({ ...draft, outcome: e.target.value })}><option>Win</option><option>Loss</option></select></label>
                  <label className="field">Notes<Input aria-label="Notes" placeholder="Notes" value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></label>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button size="sm" disabled={update.isPending} onClick={() => update.mutate(r.id)}><Check />Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X />Cancel</Button>
                  </div>
                </div>
              ) : (
                <article key={r.id} className="bt-card" role="button" tabIndex={0} title="Open backtest details" onClick={() => setViewing(r)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setViewing(r); } }}>
                  <div className="bt-shot">
                    {r.screenshot_path ? <CardShot path={r.screenshot_path} /> : <div className="bt-none"><ImagePlus className="h-5 w-5" />NO SCREENSHOT</div>}
                    <span className={`bt-badge ${win ? 'win' : 'loss'}`}>{win ? 'WIN' : 'LOSS'}</span>
                    <span className="bt-rr">R:R {rr.toFixed(2)}</span>
                  </div>
                  <div className="bt-body">
                    <div className="bt-name"><span>{r.strategy}</span><span className="bt-date">{new Date(r.created_at).toLocaleDateString()}</span></div>
                    <div className="bt-specs"><span>TP {Number(r.target)}%</span><span>SL {Number(r.stop)}%</span></div>
                    {r.notes && <p className="bt-note">{r.notes}</p>}
                  </div>
                  <div className="bt-foot">
                    <Button size="icon" variant="ghost" title="Edit" onClick={e => { e.stopPropagation(); startEdit(r); }}><Pencil /></Button>
                    <Button size="icon" variant="ghost" title="Delete" onClick={e => { e.stopPropagation(); if (window.confirm('Delete this backtest?')) remove.mutate(r.id); }}><Trash2 /></Button>
                  </div>
                </article>
              );
            })}</div> : <div className="empty">No backtests yet. Upload your first screenshot above.</div>}
          </>}
        </div>
      </section>
      <BacktestDialog row={viewing} onClose={() => setViewing(null)} onEdit={r => { setViewing(null); startEdit(r); }} onDelete={id => { setViewing(null); remove.mutate(id); }} />
    </>
  );
}
