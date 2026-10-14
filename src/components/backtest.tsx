import { useMemo, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { money, pnl, stats, type Trade } from '@/lib/trades';
import { useStrategies } from '@/lib/strategies';

/** Replays your logged trades under different rules to see how the result would change. */
export function Backtest({ trades }: { trades: Trade[] }) {
  const strategies = useStrategies();
  const [strategy, setStrategy] = useState('All');
  const [direction, setDirection] = useState('All');
  const [capital, setCapital] = useState(10000);
  const [size, setSize] = useState(1);
  const [feeMult, setFeeMult] = useState(1);
  const [stop, setStop] = useState(0);

  const r = useMemo(() => {
    const picked = [...trades]
      .filter(t => (strategy === 'All' || t.strategy === strategy) && (direction === 'All' || t.direction === direction))
      .sort((a, b) => a.traded_at.localeCompare(b.traded_at));
    const sim = picked.map(t => {
      const gross = pnl({ ...t, fees: 0 }) * size;
      const capped = stop > 0 ? Math.max(gross, -stop) : gross;
      return { ...t, sim: capped - t.fees * size * feeMult };
    });
    let eq = capital, peak = capital, dd = 0;
    const curve = [capital, ...sim.map(t => { eq += t.sim; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); return eq; })];
    const wins = sim.filter(t => t.sim > 0).length;
    return { sim, curve, end: eq, dd, wins, actual: stats(picked).total };
  }, [trades, strategy, direction, capital, size, feeMult, stop]);

  const lo = Math.min(...r.curve), hi = Math.max(...r.curve), span = hi - lo || 1;
  const pts = r.curve.map((v, i) => `${(i / Math.max(1, r.curve.length - 1)) * 600},${150 - ((v - lo) / span) * 130}`).join(' ');
  const ret = ((r.end - capital) / capital) * 100;
  const num = (v: string, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);

  return (
    <section className="panel">
      <div className="panel-head"><div className="panel-title"><FlaskConical />Backtest your journal</div><span className="panel-meta">WHAT-IF SIMULATION</span></div>
      <p className="text-xs text-muted-foreground mb-4">Replay your logged trades with a different size, fees or max loss per trade to see how the result would have changed.</p>
      <div className="form-grid mb-4">
        <label className="field">Strategy<select value={strategy} onChange={e => setStrategy(e.target.value)}><option>All</option>{strategies.map(s => <option key={s}>{s}</option>)}</select></label>
        <label className="field">Direction<select value={direction} onChange={e => setDirection(e.target.value)}><option>All</option><option>Long</option><option>Short</option></select></label>
        <label className="field">Starting capital (USD)<Input type="number" min={1} value={capital} onChange={e => setCapital(num(e.target.value, 10000))} /></label>
        <label className="field">Position size multiplier<Input type="number" step="0.1" min={0} value={size} onChange={e => setSize(num(e.target.value, 1))} /></label>
        <label className="field">Fee multiplier<Input type="number" step="0.1" min={0} value={feeMult} onChange={e => setFeeMult(num(e.target.value, 1))} /></label>
        <label className="field">Max loss per trade (USD, 0 = off)<Input type="number" min={0} value={stop} onChange={e => setStop(num(e.target.value, 0))} /></label>
      </div>
      <div className="metrics mb-4">
        <div className="metric"><div className="metric-name">ENDING EQUITY</div><div className={`metric-value ${r.end >= capital ? 'positive' : 'negative'}`}>{money(r.end)}</div><div className="metric-foot">{ret >= 0 ? '+' : ''}{ret.toFixed(2)}% return</div></div>
        <div className="metric"><div className="metric-name">SIMULATED P&L</div><div className="metric-value">{money(r.end - capital)}</div><div className="metric-foot">Actual: {money(r.actual)}</div></div>
        <div className="metric"><div className="metric-name">WIN RATE</div><div className="metric-value">{r.sim.length ? ((r.wins / r.sim.length) * 100).toFixed(1) : '0.0'}%</div><div className="metric-foot">{r.sim.length} trades replayed</div></div>
        <div className="metric"><div className="metric-name">MAX DRAWDOWN</div><div className="metric-value negative">{money(-r.dd)}</div><div className="metric-foot">Peak to trough</div></div>
      </div>
      {r.sim.length ? (
        <svg viewBox="0 0 600 160" className="equity-chart" role="img" aria-label="Simulated equity curve"><polyline points={pts} className="equity-line" /></svg>
      ) : <div className="empty">No trades match these filters.</div>}
    </section>
  );
}
