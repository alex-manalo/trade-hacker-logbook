import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export type Extracted = Partial<{ symbol: string | null; market: string | null; direction: string | null; entry: number | null; exit: number | null; quantity: number | null; fees: number | null; traded_at: string | null; strategy: string | null; notes: string | null }>;

const n = (t: string, extra: Record<string, unknown> = {}) => ({ type: [t, 'null'], ...extra });
const trade = {
  type: 'object', additionalProperties: false,
  required: ['symbol', 'market', 'direction', 'entry', 'exit', 'quantity', 'fees', 'traded_at', 'strategy', 'notes'],
  properties: {
    symbol: n('string'), market: n('string', { enum: ['Crypto', 'Forex', 'Stocks', 'Futures', null] }), direction: n('string', { enum: ['Long', 'Short', null] }),
    entry: n('number'), exit: n('number'), quantity: n('number'), fees: n('number'), traded_at: n('string'),
    strategy: n('string', { enum: ['Breakout', 'Pullback', 'Reversal', 'Trend following', null] }), notes: n('string'),
  },
};
const schema = { type: 'object', additionalProperties: false, required: ['trades'], properties: { trades: { type: 'array', items: trade } } };

export const extractTrade = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { image: string }) => {
    if (typeof d?.image !== 'string' || !d.image.startsWith('data:image/') || d.image.length > 14_000_000) throw new Error('Invalid image');
    return d;
  })
  .handler(async ({ data }): Promise<Extracted[]> => {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
      method: 'POST',
      headers: { 'Lovable-API-Key': process.env['LOVABLE_API_KEY'] ?? '', 'Content-Type': 'application/json', 'X-Lovable-AIG-SDK': 'fetch' },
      body: JSON.stringify({
        model: 'openai/gpt-6-astra', stream: true, store: false, reasoning: { effort: 'low' },
        instructions: 'You read trading screenshots (broker fills, charts, positions) and extract EVERY trade shown (one item per row/position). Use null for anything not visible or confidently inferable. Dates as YYYY-MM-DD. Symbols like BTC/USDT, EUR/USD, NVDA. If quantity is not shown, compute it: quantity = |PnL + fees| / |exit - entry| when PnL is shown, else margin × leverage / entry; round to 4 decimals. Fees = trading fee + funding fee. Use the close time date as traded_at. Notes: one short sentence describing the setup.',
        input: [{ role: 'user', content: [{ type: 'input_text', text: 'Extract the trade details from this screenshot.' }, { type: 'input_image', image_url: data.image }] }],
        text: { format: { type: 'json_schema', name: 'trade', strict: true, schema } },
      }),
    });
    if (res.status === 429) throw new Error('Too many requests, try again shortly.');
    if (res.status === 402) throw new Error('AI credits exhausted. Add credits in workspace settings.');
    if (!res.ok || !res.body) throw new Error('Could not read the screenshot.');
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''; let out = '';
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop() ?? '';
      for (const l of lines) {
        if (!l.startsWith('data:')) continue;
        try { const ev = JSON.parse(l.slice(5)); if (ev.type === 'response.output_text.delta') out += ev.delta; } catch { /* ignore */ }
      }
    }
    try { return (JSON.parse(out).trades ?? []) as Extracted[]; } catch { throw new Error('Could not read the screenshot.'); }
  });
