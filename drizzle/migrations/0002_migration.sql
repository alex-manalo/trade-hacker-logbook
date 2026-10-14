CREATE TABLE public.backtests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  strategy text NOT NULL DEFAULT 'Breakout',
  target numeric NOT NULL,
  stop numeric NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('Win','Loss')),
  screenshot_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backtests TO authenticated;
GRANT ALL ON public.backtests TO service_role;
ALTER TABLE public.backtests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own backtests" ON public.backtests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Insert own backtests" ON public.backtests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own backtests" ON public.backtests FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own backtests" ON public.backtests FOR DELETE TO authenticated USING (auth.uid() = user_id);