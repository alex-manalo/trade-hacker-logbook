import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const defaultStrategies = ['Breakout', 'Pullback', 'Reversal', 'Trend following'];
export const TIMEFRAMES = ['1min=15min', '15min=4H'] as const;
const KEY = 'zero-strategies';

// Signed-out visitors get a browser-local list; signed-in users read/write the database.
function readLocal(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return Array.isArray(v) && v.every(x => typeof x === 'string') ? v : defaultStrategies;
  } catch {
    return defaultStrategies;
  }
}

function writeLocal(list: string[]) {
  localStorage.setItem(KEY, JSON.stringify([...new Set(list.map(s => s.trim()).filter(Boolean))]));
}

export function useStrategies(userId?: string) {
  const { data } = useQuery({
    queryKey: ['strategies', userId ?? 'local'],
    queryFn: async (): Promise<string[]> => {
      if (!userId) return readLocal();
      const { data, error } = await supabase.from('strategies').select('name').order('name');
      if (error) throw error;
      return data.map(r => r.name);
    },
  });
  return data ?? (userId ? [] : readLocal());
}

export async function addStrategy(userId: string | undefined, name: string) {
  const n = name.trim();
  if (!n) return;
  if (!userId) return writeLocal([...readLocal(), n]);
  const { error } = await supabase.from('strategies').insert({ user_id: userId, name: n });
  if (error) throw error;
}

export async function renameStrategy(userId: string | undefined, from: string, to: string) {
  if (!userId) return writeLocal(readLocal().map(s => (s === from ? to : s)));
  const { error } = await supabase.from('strategies').update({ name: to }).eq('user_id', userId).eq('name', from);
  if (error) throw error;
}

export async function removeStrategy(userId: string | undefined, name: string) {
  if (!userId) return writeLocal(readLocal().filter(s => s !== name));
  const { error } = await supabase.from('strategies').delete().eq('user_id', userId).eq('name', name);
  if (error) throw error;
}

// A record may carry several strategies; older rows only have the single `strategy` label.
export function strategiesOf(r: { strategy: string; strategies?: string[] | null }): string[] {
  return r.strategies?.length ? r.strategies : r.strategy ? [r.strategy] : [];
}
export const joinStrategies = (list: string[]) => list.join(' + ');
