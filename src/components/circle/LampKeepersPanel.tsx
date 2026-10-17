import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Award, Lock, CheckCircle2, Hourglass, Copy, ExternalLink, AlertCircle, RefreshCw, Search, X } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface KeeperItem {
  id: string;
  token_id: number;
  traits: {
    lamp_id?: string;
    lamp_name?: string;
    circle_id?: string;
    share_pct?: number;
    contribution?: number;
    completed_at?: string;
  };
  mint_status: string;
  tx_hash: string | null;
  minted_at: string | null;
  created_at: string;
}

const statusBadge = (s: string) => {
  if (s === "minted") return { icon: CheckCircle2, label: "On-chain", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" };
  if (s === "simulated") return { icon: Hourglass, label: "Off-chain (đang chờ on-chain)", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" };
  if (s === "failed") return { icon: AlertCircle, label: "Mint lỗi", cls: "bg-destructive/15 text-destructive" };
  return { icon: Hourglass, label: s, cls: "bg-muted text-muted-foreground" };
};

function useRetryMint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await (supabase.rpc as any)("retry_nft_mint", { p_item_id: itemId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Đã gửi lại yêu cầu mint", { description: "NFT sẽ được đưa lại vào hàng đợi on-chain." });
      qc.invalidateQueries({ queryKey: ["my-lamp-keepers"] });
    },
    onError: (e: any) => {
      const msg = e?.message ?? "unknown";
      toast.error("Gửi lại thất bại", {
        description: msg === "not_retryable" ? "NFT này không ở trạng thái Mint lỗi." : msg,
      });
    },
  });
}

type FilterKey = "all" | "in_circle" | "other_circles" | "onchain" | "failed";

export function LampKeepersPanel({ circleId }: { circleId?: string }) {
  const [selected, setSelected] = useState<KeeperItem | null>(null);
  const [filter, setFilter] = useState<FilterKey>(circleId ? "in_circle" : "all");
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["my-lamp-keepers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nft_items")
        .select("id, token_id, traits, mint_status, tx_hash, minted_at, created_at")
        .eq("collection_code", "lamp_keeper")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as KeeperItem[];
    },
  });

  if (q.isLoading) return <p className="text-sm text-center text-muted-foreground py-4">Đang tải NFT…</p>;
  const items = q.data ?? [];

  const counts = {
    all: items.length,
    in_circle: circleId ? items.filter((i) => i.traits?.circle_id === circleId).length : 0,
    other_circles: circleId ? items.filter((i) => i.traits?.circle_id !== circleId).length : 0,
    onchain: items.filter((i) => i.mint_status === "minted").length,
    failed: items.filter((i) => i.mint_status === "failed").length,
  };

  const sq = search.trim().toLowerCase();
  const filtered = items.filter((i) => {
    if (filter === "in_circle" && !(circleId && i.traits?.circle_id === circleId)) return false;
    if (filter === "other_circles" && !(circleId && i.traits?.circle_id !== circleId)) return false;
    if (filter === "onchain" && i.mint_status !== "minted") return false;
    if (filter === "failed" && i.mint_status !== "failed") return false;
    if (sq) {
      const hay = [
        String(i.token_id ?? ""),
        i.tx_hash ?? "",
        i.id ?? "",
        i.traits?.lamp_id ?? "",
        i.traits?.lamp_name ?? "",
      ].join(" ").toLowerCase();
      if (!hay.includes(sq)) return false;
    }
    return true;
  });

  const FILTERS: { key: FilterKey; label: string; show: boolean }[] = [
    { key: "all", label: `Tất cả (${counts.all})`, show: true },
    { key: "in_circle", label: `Trong vòng này (${counts.in_circle})`, show: !!circleId },
    { key: "other_circles", label: `Vòng khác (${counts.other_circles})`, show: !!circleId },
    { key: "onchain", label: `On-chain (${counts.onchain})`, show: true },
    { key: "failed", label: `Mint lỗi (${counts.failed})`, show: true },
  ];

  return (
    <div className="space-y-3">
      <Card className="p-3 space-y-1.5 border-amber-400/30 bg-gradient-to-br from-[#b8860b]/8 via-[#daa520]/8 to-[#ffd700]/12">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-600" />
          <p className="font-extrabold text-sm flex-1">NFT Lamp Keeper của bạn</p>
          <Badge variant="outline" className="text-[10px] gap-1">
            <Lock className="h-2.5 w-2.5" /> Soulbound
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          Trao tự động cho người góp ≥25% ánh sáng vào một ngọn đèn đã hoàn thành.
          NFT này không thể chuyển nhượng. Chạm vào thẻ để xem chi tiết.
        </p>
      </Card>

      {items.length > 0 && (
        <div className="relative">
          <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo token_id, tx hash, lamp id…"
            className="h-9 pl-8 pr-8 text-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Xoá tìm kiếm"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {items.length > 0 && (
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => v && setFilter(v as FilterKey)}
          className="flex flex-wrap justify-start gap-1.5"
        >
          {FILTERS.filter((f) => f.show).map((f) => (
            <ToggleGroupItem
              key={f.key}
              value={f.key}
              size="sm"
              className="text-[11px] h-7 px-2.5 data-[state=on]:bg-amber-500/20 data-[state=on]:text-amber-700 data-[state=on]:border-amber-400"
              variant="outline"
            >
              {f.key === "failed" && <AlertCircle className="h-3 w-3 mr-1" />}
              {f.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      {items.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground italic border-dashed">
          Bạn chưa có NFT Lamp Keeper nào.
          <br />
          <span className="text-[11px]">Hoàn thành quest để góp ánh sáng vào đèn của vòng — đạt ≥25% đóng góp khi đèn sáng đủ là nhận.</span>
        </Card>
      )}

      {items.length > 0 && filtered.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground italic border-dashed">
          Không có NFT nào khớp bộ lọc này.
        </Card>
      )}

      {filtered.length > 0 && (
        <Section items={filtered} onSelect={setSelected} />
      )}

      {items.length > 0 && (
        <p className="text-[10px] text-center italic text-muted-foreground">
          Xem toàn bộ kho NFT tại <Link to="/inventory" className="underline text-amber-600 font-bold">/inventory</Link>.
        </p>
      )}

      <KeeperDetailDialog item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Section({ items, onSelect }: { items: KeeperItem[]; onSelect: (it: KeeperItem) => void }) {
  const retry = useRetryMint();
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

        {items.map((it) => {
          const s = statusBadge(it.mint_status);
          const Icon = s.icon;
          return (
            <Card
              key={it.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(it)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(it); } }}
              className="p-3 space-y-2 border-amber-400/40 bg-gradient-to-br from-amber-500/5 to-yellow-500/5 hover:shadow-md hover:border-amber-400/70 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <div className="flex items-start gap-2">
                <div className="h-12 w-12 shrink-0 rounded-lg bg-gradient-to-br from-[#b8860b] via-[#daa520] to-[#ffd700] flex items-center justify-center">
                  <Award className="h-6 w-6 !text-black" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-sm leading-tight truncate">
                    {it.traits.lamp_name ?? "Ngọn đèn"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Lamp Keeper #{it.token_id}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className="rounded bg-background/60 p-1.5 text-center">
                  <p className="text-[9px] text-muted-foreground">Đóng góp</p>
                  <p className="font-extrabold text-amber-600 tabular-nums">
                    {(it.traits.share_pct ?? 0)}%
                  </p>
                </div>
                <div className="rounded bg-background/60 p-1.5 text-center">
                  <p className="text-[9px] text-muted-foreground">Ánh sáng</p>
                  <p className="font-extrabold text-amber-600 tabular-nums">
                    {(it.traits.contribution ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge className={`text-[10px] gap-1 ${s.cls}`}>
                  <Icon className="h-2.5 w-2.5" /> {s.label}
                </Badge>
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Lock className="h-2.5 w-2.5" /> Soulbound
                </Badge>
              </div>

              <p className="text-[9px] text-muted-foreground">
                Trao {new Date(it.created_at).toLocaleString("vi-VN")} · chạm để xem chi tiết
              </p>

              {it.mint_status === "failed" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={retry.isPending}
                  onClick={(e) => { e.stopPropagation(); retry.mutate(it.id); }}
                  className="w-full h-8 text-[11px] gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  <RefreshCw className={`h-3 w-3 ${retry.isPending && retry.variables === it.id ? "animate-spin" : ""}`} />
                  {retry.isPending && retry.variables === it.id ? "Đang gửi…" : "Thử mint lại"}
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

const copyText = (v: string, label: string) => {
  navigator.clipboard.writeText(v);
  toast.success(`Đã copy ${label}`);
};

function Row({ label, value, mono, copyable }: { label: string; value: React.ReactNode; mono?: boolean; copyable?: string }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-border/50 last:border-b-0">
      <p className="text-[11px] text-muted-foreground w-28 shrink-0 pt-0.5">{label}</p>
      <div className={`flex-1 min-w-0 text-xs ${mono ? "font-mono break-all" : "font-bold"}`}>{value}</div>
      {copyable && (
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => copyText(copyable, label)}>
          <Copy className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

function KeeperDetailDialog({ item, onClose }: { item: KeeperItem | null; onClose: () => void }) {
  const open = !!item;
  const retry = useRetryMint();
  if (!item) {
    return <Dialog open={open} onOpenChange={(o) => !o && onClose()}><DialogContent /></Dialog>;
  }
  const s = statusBadge(item.mint_status);
  const Icon = s.icon;
  const t = item.traits ?? {};
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 shrink-0 rounded-xl bg-gradient-to-br from-[#b8860b] via-[#daa520] to-[#ffd700] flex items-center justify-center shadow-lg">
              <Award className="h-8 w-8 !text-black" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <DialogTitle className="text-base truncate">{t.lamp_name ?? "Ngọn đèn"}</DialogTitle>
              <DialogDescription className="text-xs">
                Lamp Keeper #{item.token_id} · Soulbound NFT
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge className={`text-[10px] gap-1 ${s.cls}`}>
            <Icon className="h-2.5 w-2.5" /> {s.label}
          </Badge>
          <Badge variant="outline" className="text-[10px] gap-1">
            <Lock className="h-2.5 w-2.5" /> Không thể chuyển nhượng
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="rounded-lg bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border border-amber-400/30 p-3 text-center">
            <p className="text-[10px] text-muted-foreground">Tỉ lệ đóng góp</p>
            <p className="text-2xl font-extrabold text-amber-600 tabular-nums">
              {(t.share_pct ?? 0)}%
            </p>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border border-amber-400/30 p-3 text-center">
            <p className="text-[10px] text-muted-foreground">Ánh sáng đã góp</p>
            <p className="text-2xl font-extrabold text-amber-600 tabular-nums">
              {(t.contribution ?? 0).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="border rounded-lg px-3 mt-2">
          <Row label="Lamp ID" value={t.lamp_id ?? "—"} mono copyable={t.lamp_id} />
          <Row label="Circle ID" value={t.circle_id ?? "—"} mono copyable={t.circle_id} />
          <Row label="NFT Item ID" value={item.id} mono copyable={item.id} />
          <Row label="Token ID" value={`#${item.token_id}`} />
          <Row label="Collection" value="lamp_keeper" mono />
          <Row label="Đèn hoàn thành" value={t.completed_at ? new Date(t.completed_at).toLocaleString("vi-VN") : "—"} />
          <Row label="NFT trao lúc" value={new Date(item.created_at).toLocaleString("vi-VN")} />
          <Row label="Mint on-chain lúc" value={item.minted_at ? new Date(item.minted_at).toLocaleString("vi-VN") : <span className="text-muted-foreground italic font-normal">Chưa mint on-chain</span>} />
          <Row
            label="Tx hash"
            value={item.tx_hash
              ? <a href={`https://testnet.bscscan.com/tx/${item.tx_hash}`} target="_blank" rel="noreferrer" className="text-amber-600 underline inline-flex items-center gap-1">{item.tx_hash.slice(0, 10)}…{item.tx_hash.slice(-6)} <ExternalLink className="h-3 w-3" /></a>
              : <span className="text-muted-foreground italic font-normal">—</span>}
            copyable={item.tx_hash ?? undefined}
          />
        </div>

        {item.mint_status === "failed" && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2 mt-1">
            <p className="text-[11px] text-destructive font-bold flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> Mint on-chain thất bại
            </p>
            <p className="text-[11px] text-muted-foreground">
              Có thể thử gửi lại — NFT sẽ trở lại trạng thái off-chain và được pipeline mint lại trong lần xử lý kế tiếp.
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={retry.isPending}
              onClick={() => retry.mutate(item.id)}
              className="w-full h-9 gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${retry.isPending ? "animate-spin" : ""}`} />
              {retry.isPending ? "Đang gửi yêu cầu…" : "Thử mint lại"}
            </Button>
          </div>
        )}

        <p className="text-[10px] text-center italic text-muted-foreground">
          NFT này là minh chứng vĩnh viễn cho lần con đã thắp sáng vòng — không thể bị thu hồi hay chuyển nhượng.
        </p>
      </DialogContent>
    </Dialog>
  );
}
