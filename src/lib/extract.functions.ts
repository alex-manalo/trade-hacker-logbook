import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export type Extracted = Partial<{ symbol: string; market: string; direction: string; entry: number; exit: number; quantity: number; fees: number; traded_at: string; strategy: string; notes: string }>;

export const extractTrade = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { image: string }) => {
    if (typeof d?.image !== 'string' || !d.image.startsWith('data:image/') || d.image.length > 14_000_000) throw new Error('Invalid image');
    return d;
  })
  .handler(async ({ data }): Promise<Extracted> => {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You read trading screenshots (broker fills, charts, positions) and extract one trade. Only fill fields you can see or confidently infer. Dates as YYYY-MM-DD. Symbols like BTC/USDT, EUR/USD, NVDA.' },
          { role: 'user', content: [{ type: 'text', text: 'Extract the trade details from this screenshot.' }, { type: 'image_url', image_url: { url: data.image } }] },
        ],
        tools: [{ type: 'function', function: { name: 'fill_trade', parameters: { type: 'object', properties: {
          symbol: { type: 'string' }, market: { type: 'string', enum: ['Crypto', 'Forex', 'Stocks', 'Futures'] }, direction: { type: 'string', enum: ['Long', 'Short'] },
          entry: { type: 'number' }, exit: { type: 'number' }, quantity: { type: 'number' }, fees: { type: 'number' }, traded_at: { type: 'string' },
          strategy: { type: 'string', enum: ['Breakout', 'Pullback', 'Reversal', 'Trend following'] }, notes: { type: 'string', description: 'Short summary of what the screenshot shows' },
        } } } }],
        tool_choice: { type: 'function', function: { name: 'fill_trade' } },
      }),
    });
    if (res.status === 429) throw new Error('Too many requests, try again shortly.');
    if (res.status === 402) throw new Error('AI credits exhausted. Add credits in workspace settings.');
    if (!res.ok) throw new Error('Could not read the screenshot.');
    const json = await res.json();
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    return args ? JSON.parse(args) : {};
  });
