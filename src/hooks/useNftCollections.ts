import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NftCollection {
  code: string;
  name: string;
  description: string | null;
  supply_max: number | null;
  supply_minted: number;
  soulbound: boolean;
  image_url: string | null;
  traits_schema: Record<string, any>;
}

const ORDER = [
  "pet_genesis",
  "lighthouse_badge",
  "light_spark",
  "lamp_keeper",
  "treasure_map_fragment",
  "cosmic_seed",
  "angel_wing",
  "guardian_crystal",
];

export function useNftCollections() {
  return useQuery({
    queryKey: ["nft-collections-catalog"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nft_collections")
        .select("code, name, description, supply_max, supply_minted, soulbound, image_url, traits_schema")
        .eq("active", true);
      if (error) throw error;
      const list = (data ?? []) as NftCollection[];
      list.sort((a, b) => {
        const ai = ORDER.indexOf(a.code);
        const bi = ORDER.indexOf(b.code);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
      return list;
    },
  });
}

export const NFT_HOWTO: Record<string, string> = {
  pet_genesis: "Nhận nuôi Pet & tiến hoá qua từng stage (spark → cosmos).",
  lighthouse_badge: "Giữ streak Daily Quest tới mốc 7/30/90/180/365 ngày.",
  light_spark: "Mở Mystery Box rare trở lên — drop ngẫu nhiên.",
  lamp_keeper: "Góp ≥25% ánh sáng cho một Ngọn đèn Vòng Sáng tới khi hoàn thành.",
  treasure_map_fragment: "Săn Treasure Hunt theo mùa — gom đủ 5 mảnh mở Cosmic Box.",
  cosmic_seed: "Drop hiếm từ Legendary / Cosmic Box.",
  angel_wing: "Đóng góp cộng đồng: validator, mentor, tặng quà.",
  guardian_crystal: "Early adopter & founding believer của FUN (giới hạn 1111).",
};

export const NFT_ROUTE: Record<string, string> = {
  pet_genesis: "/pet",
  lighthouse_badge: "/quest",
  light_spark: "/inventory",
  lamp_keeper: "/circle",
  treasure_map_fragment: "/treasure",
  cosmic_seed: "/inventory",
  angel_wing: "/community",
  guardian_crystal: "/identity",
};
