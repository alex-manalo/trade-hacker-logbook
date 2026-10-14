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
