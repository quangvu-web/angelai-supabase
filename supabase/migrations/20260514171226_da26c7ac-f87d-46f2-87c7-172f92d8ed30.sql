-- ============================================================
-- Phase 6A — Season & Quest Pass
-- ============================================================

-- 0) Add enum value for camly transactions from season pass
ALTER TYPE coin_transaction_type ADD VALUE IF NOT EXISTS 'season_pass_reward';
