import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export type BacktestExtract = { target: number | null; stop: number | null; outcome: 'Win' | 'Loss' | null };

const schema = {
  type: 'object', additionalProperties: false, required: ['target', 'stop', 'outcome'],
  properties: { target: { type: ['number', 'null'] }, stop: { type: ['number', 'null'] }, outcome: { type: ['string', 'null'], enum: ['Win', 'Loss', null] } },
};

export const extractBacktest = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { image: string }) => {
    if (typeof d?.image !== 'string' || !d.image.startsWith('data:image/') || d.image.length > 14_000_000) throw new Error('Invalid image');
    return d;
  })
  .handler(async ({ data }): Promise<BacktestExtract> => {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
      method: 'POST',
      headers: { 'Lovable-API-Key': process.env['LOVABLE_API_KEY'] ?? '', 'Content-Type': 'application/json', 'X-Lovable-AIG-SDK': 'fetch' },
      body: JSON.stringify({
        model: 'openai/gpt-6-astra', stream: true, store: false, reasoning: { effort: 'low' },
        instructions: 'You read a TradingView long/short position tool screenshot from a backtest. Return target = the target distance in PERCENT (e.g. label "Target: 0.0093 (2.184%)" -> 2.184), stop = the stop distance in PERCENT (e.g. "Stop: 0.0047 (1.104%)" -> 1.104). outcome: "Win" if price reached the target zone before the stop (or Closed PnL is positive), "Loss" if it hit the stop first (or Closed PnL negative). Use null if not visible.',
        input: [{ role: 'user', content: [{ type: 'input_text', text: 'Extract target %, stop %, and outcome.' }, { type: 'input_image', image_url: data.image }] }],
        text: { format: { type: 'json_schema', name: 'backtest', strict: true, schema } },
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
    try { return JSON.parse(out) as BacktestExtract; } catch { throw new Error('Could not read the screenshot.'); }
  });
