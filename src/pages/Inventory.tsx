import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Gift, Sparkles, Loader2, Package, Lock, Award } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { NftArtwork } from "@/components/inventory/NftArtwork";
import { NftCatalogGrid } from "@/components/nft/NftCatalogGrid";
import { smartBack } from "@/lib/smartBack";

interface BoxTicket {
  id: string;
  tier_code: string;
  source: string;
  status: string;
  reward_camly: number | null;
  expires_at: string;
  created_at: string;
}

interface InventoryItem {
  id: string;
  item_type: string;
  item_name: string;
  rarity: string | null;
  created_at: string;
}

interface RevealResult {
  tier: string;
  tier_name: string;
  camly: number;
  nft: boolean;
  reveal_hash: string;
}

const tierStyle: Record<string, string> = {
  common: "from-slate-500/20 to-slate-700/20 border-slate-400/40",
  rare: "from-blue-500/20 to-blue-700/20 border-blue-400/40",
  epic: "from-purple-500/20 to-purple-700/20 border-purple-400/40",
  legendary: "from-amber-500/20 to-orange-700/20 border-amber-400/40",
  cosmic: "from-pink-500/30 to-violet-700/30 border-pink-400/50",
};
const tierLabel: Record<string, string> = {
  common: "Common", rare: "Rare", epic: "Epic", legendary: "Legendary", cosmic: "Cosmic",
};

export default function Inventory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [revealing, setRevealing] = useState<string | null>(null);
  const [reveal, setReveal] = useState<RevealResult | null>(null);
  const [newSince, setNewSince] = useState<number | null>(null);
  const [previewNft, setPreviewNft] = useState<any | null>(null);

  useEffect(() => {
    const v = sessionStorage.getItem("inv:newSince");
    if (v) {
      setNewSince(Number(v));
      sessionStorage.removeItem("inv:newSince");
    }
    if (window.location.hash === "#tickets") {
      setTimeout(() => {
        document.getElementById("tickets")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    } else {
      const y = Number(sessionStorage.getItem("inv:scrollY") || 0);
      if (y > 0) {
        // Wait for content to mount before restoring
        setTimeout(() => window.scrollTo({ top: y, behavior: "auto" }), 100);
      }
    }

    const save = () => sessionStorage.setItem("inv:scrollY", String(window.scrollY));
    window.addEventListener("pagehide", save);
    return () => {
      save();
      window.removeEventListener("pagehide", save);
    };
  }, []);

  const ticketsQ = useQuery({
    queryKey: ["box-tickets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("box_tickets")
        .select("id, tier_code, source, status, reward_camly, expires_at, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as BoxTicket[];
    },
  });

  const inventoryQ = useQuery({
    queryKey: ["inventory", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_inventory")
        .select("id, item_type, item_name, rarity, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as InventoryItem[];
    },
  });

  const nftQ = useQuery({
    queryKey: ["nft-items", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nft_items")
        .select("id, collection_code, token_id, traits, source_type, source_ref, mint_status, tx_hash, created_at, nft_mint_queue(status, attempts, last_error)")
        .eq("owner_user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  const [retryingId, setRetryingId] = useState<string | null>(null);
  const retryMut = useMutation({
    mutationFn: async (itemId: string) => {
      setRetryingId(itemId);
      const { data, error } = await supabase.rpc("retry_nft_mint", { p_item_id: itemId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Đã đưa lại vào hàng đợi mint");
      qc.invalidateQueries({ queryKey: ["nft-items", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message || "Thử lại thất bại"),
    onSettled: () => setRetryingId(null),
  });

  const revealMut = useMutation({
    mutationFn: async (ticketId: string) => {
      const { data, error } = await supabase.rpc("reveal_box_ticket", { p_ticket_id: ticketId });
      if (error) throw error;
      return data as unknown as RevealResult;
    },
    onSuccess: (data) => {
      setReveal(data);
      qc.invalidateQueries({ queryKey: ["box-tickets", user?.id] });
      qc.invalidateQueries({ queryKey: ["inventory", user?.id] });
      qc.invalidateQueries({ queryKey: ["camly-balance"] });
    },
    onError: (e: Error) => toast.error(e.message || "Mở hộp thất bại"),
    onSettled: () => setRevealing(null),
  });

  const onReveal = (ticketId: string) => {
    setRevealing(ticketId);
    setTimeout(() => revealMut.mutate(ticketId), 600); // animation pre-roll
  };

  const tickets = ticketsQ.data ?? [];
  const items = inventoryQ.data ?? [];
  const unrevealed = tickets.filter((t) => t.status === "unrevealed");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => smartBack(navigate)} className="min-h-11">
            <ChevronLeft className="h-4 w-4 mr-1" /> Quay lại
          </Button>
          <Badge variant="outline" className="text-xs">{unrevealed.length} hộp chưa mở</Badge>
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <Package className="h-7 w-7 text-primary" /> Kho báu của bạn
          </h1>
          <p className="text-sm text-muted-foreground">Mystery Box • NFT • Vật phẩm thưởng</p>
        </div>

        {/* Box section */}
        <section id="tickets" className="space-y-3 scroll-mt-20">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Gift className="h-5 w-5" /> Mystery Box
          </h2>
          {ticketsQ.isLoading ? (
            <Card className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></Card>
          ) : tickets.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <Gift className="h-10 w-10 mx-auto opacity-40 mb-2" />
              <p>Chưa có hộp nào. Giữ streak 7 ngày để nhận Common Box đầu tiên!</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {tickets.map((t) => {
                const isNew = newSince !== null && new Date(t.created_at).getTime() >= newSince && t.status === "unrevealed";
                return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={isNew
                    ? { opacity: 1, scale: 1, boxShadow: ["0 0 0 0 rgba(255,215,0,0)", "0 0 0 6px rgba(255,215,0,0.35)", "0 0 0 0 rgba(255,215,0,0)"] }
                    : { opacity: 1, scale: 1 }}
                  transition={isNew ? { boxShadow: { duration: 1.6, repeat: Infinity }, default: { duration: 0.3 } } : { duration: 0.3 }}
                  className="rounded-lg"
                >
                  <Card className={`p-4 bg-gradient-to-br ${tierStyle[t.tier_code]} border relative overflow-hidden ${isNew ? "ring-2 ring-amber-400/70" : ""}`}>
                    {isNew && (
                      <Badge className="absolute top-1.5 right-1.5 bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold text-[9px] px-1.5 py-0 z-20">
                        ✨ MỚI
                      </Badge>
                    )}
                    <AnimatePresence>
                      {revealing === t.id && (
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-br from-[#ffd700] to-[#ffec8b] flex items-center justify-center z-10"
                          initial={{ opacity: 0 }} animate={{ opacity: 1, rotate: [0, 5, -5, 0] }} exit={{ opacity: 0 }}
                          transition={{ duration: 0.6, repeat: Infinity, repeatType: "mirror" }}
                        >
                          <Sparkles className="h-10 w-10 !text-black animate-spin" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <Gift className="h-8 w-8 mb-2" />
                    <div className="text-sm font-semibold">{tierLabel[t.tier_code]}</div>
                    <div className="text-[10px] text-muted-foreground capitalize">{t.source.replace("_", " ")}</div>
                    {t.status === "unrevealed" ? (
                      <Button size="sm" className="w-full mt-3 min-h-9" disabled={revealing === t.id}
                        onClick={() => onReveal(t.id)}>
                        {revealing === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mở ngay"}
                      </Button>
                    ) : t.status === "revealed" ? (
                      <Badge variant="outline" className="mt-3 text-[10px]">+{t.reward_camly} Camly</Badge>
                    ) : (
                      <Badge variant="destructive" className="mt-3 text-[10px]">Hết hạn</Badge>
                    )}
                  </Card>
                </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* NFT catalog — toàn bộ collection có thể sưu tập */}
        <section id="catalog" className="space-y-3 scroll-mt-20">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Catalog NFT của hệ
          </h2>
          <p className="text-xs text-muted-foreground -mt-1">
            8 bộ sưu tập đang mở. Bấm vào từng card để biết cách nhận.
          </p>
          <NftCatalogGrid />
        </section>

        {/* NFT collection của user */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" /> NFT của bạn
            <Badge variant="outline" className="text-[10px]">{nftQ.data?.length ?? 0}</Badge>
          </h2>
          {nftQ.isLoading ? (
            <Card className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></Card>
          ) : (nftQ.data?.length ?? 0) === 0 ? (
            <Card className="p-6 text-center text-muted-foreground text-sm">
              Chưa có NFT. Adopt Pet để nhận Pet Genesis · giữ streak 7+ ngày để nhận Lighthouse Badge · mở box rare+ để săn Light Spark.
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {nftQ.data!.map((n: any) => {
                const traits = (n.traits ?? {}) as Record<string, any>;
                const cfg = (() => {
                  switch (n.collection_code) {
                    case "lighthouse_badge":
                      return { label: "Lighthouse", emoji: "🪔", style: "from-amber-500/20 to-orange-700/20 border-amber-400/40", soulbound: true,
                        sub: `Streak ${traits.milestone_days ?? "?"} ngày` };
                    case "lamp_keeper":
                      return { label: "Lamp Keeper", emoji: "🏮", style: "from-amber-500/20 to-yellow-700/20 border-amber-400/40", soulbound: true,
                        sub: `${traits.lamp_name ?? "Đèn"} · ${Math.round((traits.share_pct ?? 0) * 100)}%` };
                    case "pet_genesis": {
                      const ev = (traits.evolution ?? "spark") as string;
                      const evEmoji: Record<string,string> = { spark:"✨", glow:"🌟", flame:"🔥", star:"⭐", sun:"☀️", cosmos:"🌌" };
                      return { label: "Pet Genesis", emoji: evEmoji[ev] ?? "🐣", style: "from-emerald-500/20 to-teal-700/20 border-emerald-400/40", soulbound: true,
                        sub: `${traits.pet_name ?? "Pet"} · Lv${traits.level ?? 1} · ${ev}` };
                    }
                    case "treasure_map_fragment":
                      return { label: "Map Fragment", emoji: "🗺️", style: "from-yellow-600/20 to-amber-800/20 border-yellow-500/40", soulbound: false,
                        sub: `Mảnh ${traits.fragment_index ?? "?"}/5 · ${traits.rarity ?? "paper"}` };
                    case "cosmic_seed":
                      return { label: "Cosmic Seed", emoji: "🌱", style: "from-indigo-600/30 to-violet-900/30 border-indigo-400/40", soulbound: false,
                        sub: `${traits.element ?? "light"} · ${traits.stage ?? "seed"}` };
                    case "angel_wing":
                      return { label: "Angel Wing", emoji: "🪽", style: "from-rose-300/30 to-pink-500/20 border-rose-300/40", soulbound: true,
                        sub: `${traits.tier ?? "bronze"}${traits.deed ? ` · ${traits.deed}` : ""}` };
                    case "guardian_crystal":
                      return { label: "Guardian", emoji: "💎", style: "from-cyan-500/20 to-indigo-700/30 border-cyan-400/40", soulbound: true,
                        sub: `${traits.rank ?? "seed"} · ${traits.hue ?? "aurora"}` };
                    default:
                      return { label: "Light Spark", emoji: "✨", style: "from-violet-500/20 to-fuchsia-700/20 border-violet-400/40", soulbound: false,
                        sub: `${traits.color ?? ""} · ${traits.glyph ?? ""}` };
                  }
                })();
                return (
                  <Card key={n.id} className={`p-3 border bg-gradient-to-br ${cfg.style} cursor-pointer hover:ring-2 hover:ring-primary/40 transition`}
                    onClick={() => setPreviewNft({ ...n, _cfg: cfg })}>
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>{cfg.label}</span>
                      <span>#{n.token_id}</span>
                    </div>
                    <div className="my-2 rounded-lg overflow-hidden shadow-inner ring-1 ring-white/30"><NftArtwork collection={n.collection_code} tokenId={n.token_id} traits={traits} ownerId={user?.id} className="w-full aspect-square" /></div>
                    <div className="text-xs font-semibold text-center capitalize line-clamp-2">{cfg.sub}</div>
                    {(() => {
                      const q = Array.isArray(n.nft_mint_queue) ? n.nft_mint_queue[0] : n.nft_mint_queue;
                      const qStatus: string | undefined = q?.status;
                      const onchain = n.mint_status === "onchain";
                      const failed = qStatus === "failed";
                      const processing = qStatus === "processing";
                      const queued = qStatus === "queued" || (!onchain && !qStatus);
                      const variant: "default" | "outline" | "destructive" | "secondary" =
                        onchain ? "default" : failed ? "destructive" : processing ? "secondary" : "outline";
                      const label = onchain ? "✓ Đã mint on-chain"
                        : failed ? "✗ Mint thất bại"
                        : processing ? "⟳ Đang mint"
                        : queued ? "⏳ Chờ mint"
                        : n.mint_status;
                      return (
                        <div className="space-y-1 mt-2">
                          <div className="flex items-center justify-center gap-1">
                            {cfg.soulbound && <Lock className="h-3 w-3 text-muted-foreground" />}
                            <Badge variant={variant} className="text-[9px]">{label}</Badge>
                          </div>
                          {n.tx_hash && (
                            <div className="text-[9px] text-center text-muted-foreground font-mono truncate">
                              {n.tx_hash.slice(0, 10)}…
                            </div>
                          )}
                          {failed && q?.last_error && (
                            <div className="text-[9px] text-center text-destructive line-clamp-1" title={q.last_error}>
                              {q.last_error}
                            </div>
                          )}
                          {failed && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full h-7 text-[10px] mt-1"
                              disabled={retryingId === n.id || (q?.attempts ?? 0) >= 10}
                              onClick={(e) => { e.stopPropagation(); retryMut.mutate(n.id); }}
                            >
                              {retryingId === n.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "↻ Thử lại mint"}
                            </Button>
                          )}
                        </div>
                      );
                    })()}
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Inventory items */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Vật phẩm
          </h2>
          {items.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground text-sm">Chưa có vật phẩm. Hãy mở hộp Epic+ để có cơ hội nhận NFT.</Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {items.map((it) => (
                <Card key={it.id} className={`p-3 bg-gradient-to-br ${tierStyle[it.rarity || "common"]} border`}>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{it.item_type}</div>
                  <div className="text-sm font-semibold mt-1 line-clamp-2">{it.item_name}</div>
                  {it.rarity && <Badge variant="outline" className="mt-2 text-[10px] capitalize">{it.rarity}</Badge>}
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Reveal modal */}
      <Dialog open={!!reveal} onOpenChange={(o) => { if (!o) setReveal(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">🎉 {reveal?.tier_name}</DialogTitle>
          </DialogHeader>
          {reveal && (
            <motion.div className="text-center space-y-4 py-4"
              initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <div className="text-5xl">{reveal.nft ? "✨🎁" : "💰"}</div>
              <div className="text-3xl font-bold bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] bg-clip-text text-transparent">
                +{reveal.camly} Camly
              </div>
              {reveal.nft && (
                <div className="text-sm font-medium text-violet-400">+ 1 NFT Light Spark đã thêm vào kho!</div>
              )}
              <p className="text-[10px] text-muted-foreground font-mono break-all">hash: {reveal.reveal_hash.slice(0, 32)}…</p>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>

      {/* NFT preview modal */}
      <Dialog open={!!previewNft} onOpenChange={(o) => { if (!o) setPreviewNft(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span>{previewNft?._cfg?.label ?? "NFT"}</span>
              <span className="text-xs font-mono text-muted-foreground">#{previewNft?.token_id}</span>
            </DialogTitle>
          </DialogHeader>
          {previewNft && (
            <div className="space-y-4">
              <div className={`rounded-xl overflow-hidden ring-1 ring-white/30 shadow-inner bg-gradient-to-br ${previewNft._cfg.style}`}>
                <NftArtwork
                  collection={previewNft.collection_code}
                  tokenId={previewNft.token_id}
                  traits={previewNft.traits ?? {}}
                  ownerId={user?.id}
                  className="w-full aspect-square"
                />
              </div>
              <div className="text-sm font-semibold text-center capitalize">{previewNft._cfg.sub}</div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {previewNft._cfg.soulbound && (
                  <Badge variant="secondary" className="text-[10px]"><Lock className="h-3 w-3 mr-1" /> Soulbound</Badge>
                )}
                <Badge variant="outline" className="text-[10px]">{previewNft.mint_status}</Badge>
                <Badge variant="outline" className="text-[10px] font-mono">{previewNft.collection_code}</Badge>
              </div>
              {previewNft.traits && Object.keys(previewNft.traits).length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Traits</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {Object.entries(previewNft.traits as Record<string, any>).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2 border-b border-border/40 py-0.5">
                        <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                        <span className="font-medium truncate text-right" title={String(v)}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {previewNft.tx_hash && (
                <div className="text-[10px] text-center text-muted-foreground font-mono break-all">
                  tx: {previewNft.tx_hash}
                </div>
              )}
              <div className="text-[10px] text-center text-muted-foreground">
                Minted {new Date(previewNft.created_at).toLocaleString("vi-VN")}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
