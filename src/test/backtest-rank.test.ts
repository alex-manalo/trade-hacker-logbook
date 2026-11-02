import { describe, expect, it } from 'vitest';
import { rankStrategies, type BacktestRow } from '../components/backtest';
const row = (strategy: string, outcome: string, target = 2, stop = 1): BacktestRow => ({ id: Math.random().toString(), strategy, outcome, target, stop, notes: '', screenshot_path: null, created_at: '2026-10-15T00:00:00Z' });
describe('Most winnable strategy', () => {
  it('ranks the strategy with the highest win rate first', () => {
    const r = rankStrategies([row('Breakout', 'Win'), row('Breakout', 'Loss'), row('Pullback', 'Win'), row('Pullback', 'Win'), row('Pullback', 'Loss')]);
    expect(r[0]!.s).toBe('Pullback');
    expect(r[0]!.rate).toBeCloseTo(66.67, 1);
  });
  it('breaks a win-rate tie with the larger sample', () => {
    const r = rankStrategies([row('Reversal', 'Win'), row('Breakout', 'Win'), row('Breakout', 'Win')]);
    expect(r[0]!.s).toBe('Breakout');
  });
  it('returns nothing without backtests', () => expect(rankStrategies([])).toEqual([]));
});
describe('Multiple strategies per backtest', () => {
  it('counts a backtest fully in each of its strategies', () => {
    const multi = { ...row('Breakout + Pullback', 'Win'), strategies: ['Breakout', 'Pullback'] };
    const r = rankStrategies([multi, row('Breakout', 'Loss')]);
    expect(r.find(x => x.s === 'Pullback')).toMatchObject({ n: 1, wins: 1 });
    expect(r.find(x => x.s === 'Breakout')).toMatchObject({ n: 2, wins: 1 });
  });
});
