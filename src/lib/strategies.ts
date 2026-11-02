import { useSyncExternalStore } from 'react';

const KEY = 'zero-strategies';
export const defaultStrategies = ['Breakout', 'Pullback', 'Reversal', 'Trend following'];
const listeners = new Set<() => void>();
let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    cache = Array.isArray(v) && v.every(x => typeof x === 'string') ? v : defaultStrategies;
  } catch { cache = defaultStrategies; }
  return cache;
}

export function setStrategies(list: string[]) {
  cache = [...new Set(list.map(s => s.trim()).filter(Boolean))];
  localStorage.setItem(KEY, JSON.stringify(cache));
  listeners.forEach(l => l());
}

export function useStrategies() {
  return useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, read, () => defaultStrategies);
}

// A record may carry several strategies; older rows only have the single `strategy` label.
export function strategiesOf(r: { strategy: string; strategies?: string[] | null }): string[] {
  return r.strategies?.length ? r.strategies : r.strategy ? [r.strategy] : [];
}
export const joinStrategies = (list: string[]) => list.join(' + ');
