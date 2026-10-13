export type Trade = { id: string; symbol: string; market: string; direction: 'Long' | 'Short'; entry: number; exit: number; quantity: number; fees: number; traded_at: string; strategy: string; notes: string };
export function pnl(t: Trade) { return (t.exit - t.entry) * t.quantity * (t.direction === 'Long' ? 1 : -1) - t.fees; }
export function stats(trades: Trade[]) {
  const profits = trades.map(pnl);
  const wins = profits.filter(p => p > 0);
  const losses = profits.filter(p => p < 0);
  const gross = wins.reduce((a,b) => a+b, 0);
  const loss = Math.abs(losses.reduce((a,b) => a+b, 0));
  return { total: profits.reduce((a,b) => a+b,0), winRate: trades.length ? wins.length / trades.length * 100 : 0, wins: wins.length, losses: losses.length, profitFactor: loss ? gross / loss : gross ? Infinity : 0, average: trades.length ? profits.reduce((a,b) => a+b,0) / trades.length : 0 };
}
export const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
export const demoTrades: Trade[] = [
  ['BTC/USDT','Crypto','Long',62450,63820,.8,8,'2026-10-13','Breakout'],
  ['ETH/USDT','Crypto','Short',3420,3485,4,5,'2026-10-13','Reversal'],
  ['SOL/USDT','Crypto','Long',142.5,151.8,60,6,'2026-10-12','Pullback'],
  ['EUR/USD','Forex','Long',1.0924,1.0962,100000,7,'2026-10-12','Breakout'],
  ['NVDA','Stocks','Long',128.4,133.8,80,4,'2026-10-11','Trend following'],
  ['BTC/USDT','Crypto','Short',64200,63410,.6,6,'2026-10-10','Reversal'],
  ['AAPL','Stocks','Long',231,228,50,3,'2026-10-09','Pullback'],
  ['ETH/USDT','Crypto','Long',3210,3400,5,5,'2026-10-08','Breakout'],
  ['SOL/USDT','Crypto','Long',136,141,100,5,'2026-10-07','Trend following'],
  ['GBP/USD','Forex','Short',1.31,1.314,50000,4,'2026-10-06','Reversal'],
  ['NVDA','Stocks','Long',120,126,100,4,'2026-10-05','Breakout'],
  ['BTC/USDT','Crypto','Long',61000,62400,.9,8,'2026-10-03','Pullback'],
].map((v,i) => ({ id:`demo-${i}`, symbol:String(v[0]), market:String(v[1]), direction:v[2] as Trade['direction'], entry:Number(v[3]),exit:Number(v[4]),quantity:Number(v[5]), fees:Number(v[6]),traded_at:String(v[7]),strategy:String(v[8]),notes:'Patient entry at the key level. Followed the trading plan.' }));