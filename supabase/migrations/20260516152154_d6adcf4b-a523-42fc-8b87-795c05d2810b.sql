
-- Add 4 new display NFT collections (artwork shown in inventory when granted)
INSERT INTO public.nft_collections (code, name, description, supply_max, soulbound, traits_schema, active) VALUES
('treasure_map_fragment', 'Treasure Map Fragment',
 'Mảnh bản đồ kho báu — gom đủ 5 mảnh để mở Cosmic Treasure Box.',
 8000, false,
 '{"fragment_index": [1,2,3,4,5], "season": "string", "rarity": ["paper","silk","gold"]}'::jsonb, true),
('cosmic_seed', 'Cosmic Seed',
 'Hạt giống vũ trụ — drop hiếm từ Legendary/Cosmic Box, nuôi lớn thành Cosmos Pet.',
 2000, false,
 '{"element": ["fire","water","earth","air","light"], "stage": ["seed","sprout","bloom"]}'::jsonb, true),
('angel_wing', 'Angel Wing',
 'Soulbound — trao cho người giúp đỡ cộng đồng (validator, mentor, gift giver).',
 NULL, true,
 '{"tier": ["bronze","silver","gold","diamond"], "deed": "string"}'::jsonb, true),
('guardian_crystal', 'Guardian Crystal',
 'Tinh thể bảo hộ — early adopter & founding believer của FUN.',
 1111, true,
 '{"facet": [6,8,12], "hue": ["aurora","ember","frost","void"], "rank": ["seed","founder","guardian"]}'::jsonb, true)
ON CONFLICT (code) DO NOTHING;
