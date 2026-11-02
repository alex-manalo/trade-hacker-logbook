ALTER TABLE public.trades ADD COLUMN strategies text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.backtests ADD COLUMN strategies text[] NOT NULL DEFAULT '{}';
UPDATE public.trades SET strategies = ARRAY[strategy] WHERE strategy <> '';
UPDATE public.backtests SET strategies = ARRAY[strategy] WHERE strategy <> '';