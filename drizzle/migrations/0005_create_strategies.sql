CREATE TABLE public.strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategies TO authenticated;
GRANT ALL ON public.strategies TO service_role;

ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own strategies" ON public.strategies FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Insert own strategies" ON public.strategies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own strategies" ON public.strategies FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own strategies" ON public.strategies FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Seed each user's list from the strategies already used on their trades and backtests.
INSERT INTO public.strategies (user_id, name)
SELECT DISTINCT user_id, s FROM (
  SELECT user_id, unnest(CASE WHEN cardinality(strategies) > 0 THEN strategies ELSE ARRAY[strategy] END) AS s FROM public.trades
  UNION
  SELECT user_id, unnest(CASE WHEN cardinality(strategies) > 0 THEN strategies ELSE ARRAY[strategy] END) AS s FROM public.backtests
) t
WHERE s <> ''
ON CONFLICT (user_id, name) DO NOTHING;