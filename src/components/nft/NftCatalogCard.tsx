import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NftArtwork } from "@/components/inventory/NftArtwork";
import { NftCollection, NFT_HOWTO, NFT_ROUTE } from "@/hooks/useNftCollections";
import { Lock, ArrowRight } from "lucide-react";

const GOLD_CODES = new Set(["pet_genesis", "lighthouse_badge", "guardian_crystal"]);

export function NftCatalogCard({ c }: { c: NftCollection }) {
  const navigate = useNavigate();
  const gold = GOLD_CODES.has(c.code);
  const route = NFT_ROUTE[c.code] ?? "/games";
  const supply = c.supply_max
    ? `${c.supply_minted}/${c.supply_max}`
    : `${c.supply_minted} đã tạo`;

  // Seed token for preview artwork — stable per code
  const previewToken = c.code === "treasure_map_fragment" ? 1 : 0;
  const previewTraits =
    c.code === "pet_genesis"
      ? { evolution: "star", personality: "joyful", element: "light" }
      : c.code === "lamp_keeper"
        ? { share_pct: 0.5 }
        : c.code === "treasure_map_fragment"
          ? { rarity: "gold", fragment_index: 1 }
          : c.code === "cosmic_seed"
            ? { stage: "bloom" }
            : c.code === "angel_wing"
              ? { tier: "gold" }
              : c.code === "guardian_crystal"
                ? { hue: "aurora", rank: "guardian", facet: 8 }
                : {};

  return (
    <button
      type="button"
      onClick={() => navigate(route)}
      className="text-left w-full group"
      aria-label={`Xem cách nhận ${c.name}`}
    >
      <Card
        className={`p-3 h-full transition-all border hover:shadow-lg active:scale-[0.99] ${
          gold ? "border-amber-300/60 bg-gradient-to-br from-amber-50 to-white" : "bg-card"
        }`}
      >
        <div className="rounded-xl overflow-hidden ring-1 ring-border/50 mb-2.5">
          <NftArtwork
            collection={c.code}
            tokenId={previewToken}
            traits={previewTraits}
            className="w-full aspect-square"
          />
        </div>

        <div className="flex items-start justify-between gap-1.5 mb-1">
          <h3 className="font-bold text-sm leading-tight">{c.name}</h3>
          {c.soulbound && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
              <Lock className="h-2.5 w-2.5 mr-0.5" /> SBT
            </Badge>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug min-h-[28px]">
          {c.description ?? ""}
        </p>

        <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
            Cách nhận
          </div>
          <p className="text-[11px] leading-snug">{NFT_HOWTO[c.code] ?? "—"}</p>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
            <span>Supply: {supply}</span>
            <span className="flex items-center gap-0.5 font-semibold text-primary group-hover:translate-x-0.5 transition">
              Đến trang <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </Card>
    </button>
  );
}
