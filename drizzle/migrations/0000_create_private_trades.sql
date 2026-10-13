CREATE TABLE public.trades (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, symbol text NOT NULL, market text NOT NULL DEFAULT 'Crypto', direction text NOT NULL CHECK (direction IN ('Long','Short')), entry numeric NOT NULL CHECK (entry > 0), exit numeric NOT NULL CHECK (exit > 0), quantity numeric NOT NULL CHECK (quantity > 0), fees numeric NOT NULL DEFAULT 0 CHECK (fees >= 0), traded_at date NOT NULL DEFAULT CURRENT_DATE, strategy text NOT NULL DEFAULT 'Breakout', notes text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades TO authenticated;
GRANT ALL ON public.trades TO service_role;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own trades" ON public.trades FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Insert own trades" ON public.trades FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own trades" ON public.trades FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own trades" ON public.trades FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX trades_owner_date ON public.trades (user_id, traded_at DESC);