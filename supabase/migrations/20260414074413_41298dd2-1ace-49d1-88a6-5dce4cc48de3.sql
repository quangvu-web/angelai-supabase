-- Create proofs storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('proofs', 'proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Users can view their own proofs
CREATE POLICY "Users can view own proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can upload proofs to their own folder
CREATE POLICY "Users can upload own proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can update their own proofs
CREATE POLICY "Users can update own proofs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'proofs' AND auth.uid()::text = (storage.foldername(name))[1]);