import { useMemo, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { ChevronLeft, Loader2, Flame, Sparkles, Coins, Zap, Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { smartBack } from "@/lib/smartBack";
import { useLightForge, type ForgeRecipe, type NftLite } from "@/hooks/useLightForge";

const TIER_META: Record<string, { label: string; color: string; ring: string }> = {
  common: { label: "Common", color: "bg-slate-200 text-slate-800", ring: "ring-slate-300" },
  rare: { label: "Rare", color: "bg-sky-200 text-sky-900", ring: "ring-sky-400" },
  epic: { label: "Epic", color: "bg-violet-200 text-violet-900", ring: "ring-violet-400" },
  legendary: { label: "Legendary", color: "bg-amber-200 text-amber-900", ring: "ring-amber-400" },
  cosmic: { label: "Cosmic", color: "bg-fuchsia-200 text-fuchsia-900", ring: "ring-fuchsia-400" },
};

export default function Forge() {
  const navigate = useNavigate();
  const { state, nfts, isLoading, combine, isCombining } = useLightForge();
  const [activeRecipe, setActiveRecipe] = useState<ForgeRecipe | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const nftsByTier = useMemo(() => {
    const map: Record<string, NftLite[]> = {};
    for (const n of nfts) {
      const tier = String((n.traits as Record<string, unknown>)?.tier ?? "");
      if (!tier) continue;
      (map[tier] ??= []).push(n);
    }
    return map;
  }, [nfts]);

  if (isLoading || !state?.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const openRecipe = (r: ForgeRecipe) => {
    setActiveRecipe(r);
    setSelected([]);
  };

  const toggleNft = (id: string) => {
    if (!activeRecipe) return;
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (s.length >= activeRecipe.input_count) return s;
      return [...s, id];
    });
  };

  const handleForge = async () => {
    if (!activeRecipe) return;
    if (selected.length !== activeRecipe.input_count) {
      toast.error(`Cần chọn đủ ${activeRecipe.input_count} NFT`);
      return;
    }
    try {
      const res = await combine({ recipe_id: activeRecipe.id, nft_ids: selected });
      if (!res.ok) {
        toast.error(`Không forge được: ${res.reason ?? "lỗi"}`);
        return;
      }
      toast.success(
        `✨ Đúc thành NFT ${res.output_tier} · -${res.camly_burned} Camly · +${res.xp_awarded} XP${
          res.echo_granted ? " · 🎁 Forge Echo!" : ""
        }`
      );
      setActiveRecipe(null);
      setSelected([]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Lỗi không xác định";
      toast.error(msg);
    }
  };

  const remaining = state.daily_cap - state.today_burn;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-5 py-5 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => smartBack(navigate)} className="min-h-11 -ml-2">
            <ChevronLeft className="h-4 w-4 mr-1" /> Quay lại
          </Button>
          <Badge className="bg-gradient-to-r from-orange-500 to-rose-500 text-white border-0">
            <Flame className="h-3.5 w-3.5 mr-1" /> Light Forge
          </Badge>
        </div>

        {/* Hero */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3.5 rounded-3xl bg-orange-50">
            <Flame className="h-9 w-9 text-orange-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Light Forge</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Gộp 3 NFT cùng tier → 1 NFT tier cao hơn. Hiến Camly, nhận XP Mastery,
            5% drop vé Cosmic Box.
          </p>
        </div>

        {/* Daily cap */}
        <Card className="p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Camly hiến hôm nay</div>
            <div className="font-bold text-lg">
              {state.today_burn.toLocaleString()} / {state.daily_cap.toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Còn lại</div>
            <div className={`font-bold ${remaining <= 0 ? "text-rose-500" : "text-emerald-600"}`}>
              {Math.max(0, remaining).toLocaleString()}
            </div>
          </div>
        </Card>

        {/* Recipes */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Công thức</h2>
          {state.recipes.map((r) => {
            const have = nftsByTier[r.input_tier]?.length ?? 0;
            const enough = have >= r.input_count;
            const inMeta = TIER_META[r.input_tier] ?? TIER_META.common;
            const outMeta = TIER_META[r.output_tier] ?? TIER_META.rare;
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`px-2 py-1 rounded-md text-xs font-bold ${inMeta.color}`}>
                    {r.input_count}× {inMeta.label}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className={`px-2 py-1 rounded-md text-xs font-bold ${outMeta.color}`}>
                    1× {outMeta.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 flex-wrap">
                  <span className="flex items-center gap-1"><Coins className="h-3.5 w-3.5" /> -{r.camly_cost.toLocaleString()} Camly</span>
                  <span className="flex items-center gap-1"><Zap className="h-3.5 w-3.5" /> +{r.xp_reward} XP</span>
                  <span className="flex items-center gap-1"><Gem className="h-3.5 w-3.5" /> {Math.round(r.echo_chance * 100)}% Echo</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs">
                    Bạn có <span className={`font-bold ${enough ? "text-emerald-600" : "text-muted-foreground"}`}>{have}</span> NFT {inMeta.label}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => openRecipe(r)}
                    disabled={!enough || remaining < r.camly_cost}
                    className="bg-gradient-to-r from-orange-500 to-rose-500"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" /> Forge
                  </Button>
                </div>
              </Card>
            );
          })}
        </section>

        {/* Active recipe NFT picker */}
        {activeRecipe && (
          <Card className="p-4 space-y-3 border-2 border-orange-300">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold">
                  Chọn {activeRecipe.input_count} NFT {TIER_META[activeRecipe.input_tier]?.label}
                </div>
                <div className="text-xs text-muted-foreground">
                  Đã chọn {selected.length}/{activeRecipe.input_count}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setActiveRecipe(null); setSelected([]); }}>
                Huỷ
              </Button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {(nftsByTier[activeRecipe.input_tier] ?? []).map((n) => {
                const isSelected = selected.includes(n.id);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => toggleNft(n.id)}
                    className={`relative p-2 rounded-xl border text-xs aspect-square flex flex-col items-center justify-center transition ${
                      isSelected
                        ? "bg-orange-50 border-orange-400 ring-2 ring-orange-300"
                        : "bg-card border-border hover:border-orange-300"
                    }`}
                  >
                    <Gem className="h-5 w-5 mb-1 text-orange-500" />
                    <span className="font-mono text-[10px] truncate w-full">
                      {n.id.slice(0, 6)}
                    </span>
                    {isSelected && (
                      <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-orange-500 text-white text-[10px] flex items-center justify-center font-bold">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <Button
              className="w-full bg-gradient-to-r from-orange-500 to-rose-500"
              disabled={selected.length !== activeRecipe.input_count || isCombining}
              onClick={handleForge}
            >
              {isCombining ? (
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
              ) : (
                <Flame className="h-4 w-4 mr-2" />
              )}
              Đúc thành NFT {TIER_META[activeRecipe.output_tier]?.label}
            </Button>
          </Card>
        )}

        {/* Notes */}
        <div className="p-4 bg-muted/40 rounded-2xl text-xs text-muted-foreground space-y-1">
          <p>• Hạn mức hiến: tối đa 30.000 Camly/người/ngày (reset 00:00 VN).</p>
          <p>• NFT đầu vào sẽ bị xoá vĩnh viễn. NFT đầu ra được tạo qua hàng đợi mint.</p>
          <p>• 5% may mắn nhận thêm 1 vé Cosmic Mystery Box ("Forge Echo").</p>
        </div>
      </div>
    </div>
  );
}
