ALTER TABLE public.trades ADD COLUMN screenshot_path text;
CREATE POLICY "Read own screenshots" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='trade-screenshots' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY "Upload own screenshots" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='trade-screenshots' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY "Update own screenshots" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='trade-screenshots' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY "Delete own screenshots" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='trade-screenshots' AND (storage.foldername(name))[1]=auth.uid()::text);