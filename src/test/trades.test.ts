import { describe, expect, it } from 'vitest';
import { pnl, stats, type Trade } from '../lib/trades';
const base: Trade = { id:'test', symbol:'BTC', market:'Crypto', direction:'Long', traded_at:'2026-10-13', strategy:'Breakout', notes:'', entry:100, exit:110, quantity:2, fees:3 };
describe('Trading calculations', () => {
  it('subtracts fees from long profit', () => expect(pnl({...base,direction:'Long'})).toBe(17));
  it('reverses price movement for shorts', () => expect(pnl({...base,direction:'Short'})).toBe(-23));
  it('counts profitable trades for win rate', () => expect(stats([{...base,direction:'Long'}, {...base,direction:'Short'}]).winRate).toBe(50));
  it('calculates profit factor from gains divided by absolute losses', () => expect(stats([{...base,direction:'Long'}, {...base,direction:'Short'}]).profitFactor).toBeCloseTo(17/23));
  it('handles an empty journal', () => expect(stats([]).total).toBe(0));
});