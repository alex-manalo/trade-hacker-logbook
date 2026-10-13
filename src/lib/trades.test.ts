import { describe, it, expect } from 'vitest';
import { splitDuplicates } from './trades';
const t = { symbol: 'LDO/USDT', direction: 'Long', entry: 1.5, exit: 1.6, quantity: 100, traded_at: '2026-09-30' };
describe('splitDuplicates', () => {
  it('skips a trade already in the journal', () => {
    const r = splitDuplicates([{ ...t, symbol: 'ldo/usdt' }], [t]);
    expect(r.fresh).toHaveLength(0); expect(r.duplicates).toBe(1);
  });
  it('skips repeats within the same upload but keeps different trades', () => {
    const r = splitDuplicates([t, t, { ...t, direction: 'Short' }], []);
    expect(r.fresh).toHaveLength(2); expect(r.duplicates).toBe(1);
  });
});
