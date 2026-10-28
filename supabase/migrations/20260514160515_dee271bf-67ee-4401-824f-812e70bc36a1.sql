CREATE POLICY "nft_mint_queue owner read"
  ON public.nft_mint_queue FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.nft_items i
    WHERE i.id = nft_mint_queue.item_id
      AND i.owner_user_id = auth.uid()
  ));