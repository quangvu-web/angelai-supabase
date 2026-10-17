import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Flame, Plus, X, Sparkles, Info } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { LampLootPanel } from "./LampLootPanel";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type LootTier = "standard" | "rare" | "epic";
interface Lamp {
  id: string;
  name: string;
  target_light: number;
  current_light: number;
  status: string;
  starts_at: string;
  ends_at: string | null;
  loot_tier?: LootTier;
}

const TIER_PRESETS: Record<LootTier, { label: string; emoji: string; box: number; xp: number; camly: number; cls: string; desc: string }> = {
  standard: { label: "Thường",  emoji: "✨", box: 10, xp: 2000,  camly: 5000,  cls: "border-amber-400/40 bg-amber-500/5",
    desc: "Đèn ngày thường — đủ ấm áp cho cả vòng cùng thắp sáng đều đặn." },
  rare:     { label: "Hiếm",    emoji: "🌟", box: 15, xp: 4000,  camly: 10000, cls: "border-sky-400/40 bg-sky-500/5",
    desc: "Đèn dịp đặc biệt — thưởng dày hơn cho mọi người đã góp ánh sáng." },
  epic:     { label: "Sử thi",  emoji: "💎", box: 20, xp: 8000,  camly: 20000, cls: "border-fuchsia-400/40 bg-fuchsia-500/5",
    desc: "Đèn lễ lớn — món quà hào phóng nhất, vẫn chia đều theo đóng góp." },
};
interface Contrib {
  id: string;
  user_id: string;
  amount: number;
  created_at: string;
  display_name: string;
  avatar_url: string | null;
}
interface LampPayload {
  has_lamp: boolean;
  lamp?: Lamp;
  contributions?: Contrib[];
}

const errMap: Record<string, string> = {
  not_officer: "Chỉ founder/steward mới tạo được đèn",
  lamp_active_exists: "Vòng đã có một ngọn đèn đang hoạt động",
  invalid_target: "Mục tiêu phải > 0 và ≤ 100,000,000",
  invalid_name: "Tên đèn 2–60 ký tự",
};
const initials = (n?: string) => (n || "?").trim().slice(0, 2).toUpperCase();

export function CircleLampPanel({ circleId, myRole }: { circleId: string; myRole?: string }) {
  const qc = useQueryClient();
  const isOfficer = myRole === "founder" || myRole === "steward";
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState<string>("100000");
  const [tier, setTier] = useState<LootTier>("standard");

  const lampQ = useQuery({
    queryKey: ["circle-lamp", circleId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_active_circle_lamp");
      if (error) throw error;
      return data as unknown as LampPayload;
    },
  });

  // Realtime: cập nhật khi đèn hoặc đóng góp thay đổi + bắn toast khi đạt 100%
  useEffect(() => {
    const notifiedKey = `lamp-completed-notified:${circleId}`;
    const ch = supabase
      .channel(`circle-lamp:${circleId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "light_circle_lamps", filter: `circle_id=eq.${circleId}` },
        (payload) => {
          const newRow = payload.new as Partial<Lamp> | undefined;
          const oldRow = payload.old as Partial<Lamp> | undefined;
          if (
            newRow?.id &&
            newRow.status === "completed" &&
            oldRow?.status !== "completed" &&
            sessionStorage.getItem(notifiedKey) !== newRow.id
          ) {
            sessionStorage.setItem(notifiedKey, newRow.id);
            toast.success(`🎉 Ngọn đèn "${newRow.name ?? ""}" đã sáng đủ 100%!`, {
              description: "Cả vòng vừa cùng nhau toả sáng — chúc mừng!",
              duration: 8000,
            });
          }
          qc.invalidateQueries({ queryKey: ["circle-lamp", circleId] });
        })
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "light_circle_lamp_contributions", filter: `circle_id=eq.${circleId}` },
        () => qc.invalidateQueries({ queryKey: ["circle-lamp", circleId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [circleId, qc]);

  const create = useMutation({
    mutationFn: async () => {
      const t = parseInt(target, 10);
      const { data, error } = await supabase.rpc("create_circle_lamp", {
        p_name: name, p_target: t, p_ends_at: null, p_loot_tier: tier,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Đã thắp ngọn đèn mới ✨");
      setShowCreate(false); setName(""); setTarget("100000"); setTier("standard");
      qc.invalidateQueries({ queryKey: ["circle-lamp", circleId] });
    },
    onError: (e: Error) => toast.error(errMap[e.message] ?? "Có lỗi, thử lại nhé"),
  });

  const close = useMutation({
    mutationFn: async (lampId: string) => {
      const { error } = await supabase.rpc("close_circle_lamp", { p_lamp_id: lampId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã đóng ngọn đèn");
      qc.invalidateQueries({ queryKey: ["circle-lamp", circleId] });
    },
    onError: (e: Error) => toast.error(errMap[e.message] ?? "Có lỗi"),
  });

  if (lampQ.isLoading) return <p className="text-sm text-center text-muted-foreground py-4">Đang tải đèn…</p>;

  const data = lampQ.data;

  if (!data?.has_lamp) {
    return (
      <Card className="p-4 space-y-3 border-amber-400/30 bg-gradient-to-br from-amber-500/5 to-yellow-500/5">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-amber-500" />
          <p className="font-bold text-sm flex-1">Chưa có ngọn đèn nào đang sáng</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Ngọn đèn là một mục tiêu chung — mỗi điểm Season XP của thành viên tự cộng ×5 ánh sáng vào đèn theo thời gian thực.
        </p>
        {isOfficer && !showCreate && (
          <Button size="sm" onClick={() => setShowCreate(true)}
            className="w-full bg-gradient-to-br from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold">
            <Plus className="h-3.5 w-3.5 mr-1" /> Thắp ngọn đèn
          </Button>
        )}
        {isOfficer && showCreate && (
          <div className="space-y-2 pt-1 border-t">
            <div>
              <Label className="text-xs">Tên ngọn đèn</Label>
              <Input value={name} onChange={(e) => setName(e.target.value.slice(0, 60))}
                placeholder="VD: Ánh sáng tuần đầu tháng 5" maxLength={60} />
            </div>
            <div>
              <Label className="text-xs">Mục tiêu ánh sáng</Label>
              <Input type="number" value={target} onChange={(e) => setTarget(e.target.value)}
                min={1} max={100000000} placeholder="100000" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <Label className="text-xs">Cấp phần thưởng</Label>
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-foreground">
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[260px] text-[11px] leading-relaxed">
                      <p className="font-bold mb-1">Triết lý không cạnh tranh</p>
                      <p>
                        Cấp đèn chỉ quyết định <b>tổng phần thưởng</b> mà cả vòng cùng nhận. Mỗi thành viên đã góp ≥ 1 ánh sáng đều được chia theo
                        đúng tỉ lệ <code>đóng góp / tổng ánh sáng</code> — không xếp hạng, không ai bị bỏ sót (tối thiểu 1 vé hộp / 50 XP / 100 Camly).
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <TooltipProvider delayDuration={150}>
                <div className="grid grid-cols-3 gap-1.5 mt-1">
                  {(Object.keys(TIER_PRESETS) as LootTier[]).map((k) => {
                    const p = TIER_PRESETS[k];
                    const active = tier === k;
                    return (
                      <Tooltip key={k}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setTier(k)}
                            className={`rounded-lg border p-2 text-center transition ${active ? "ring-2 ring-amber-500 " + p.cls : "hover:bg-amber-500/5 border-border"}`}
                          >
                            <div className="text-base">{p.emoji}</div>
                            <div className="text-[11px] font-bold">{p.label}</div>
                            <div className="text-[9px] text-muted-foreground tabular-nums">{p.box}🎁 · {(p.xp/1000)}k XP</div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[240px] text-[11px] leading-relaxed">
                          <p className="font-bold mb-0.5">{p.emoji} Đèn {p.label}</p>
                          <p className="italic mb-1">{p.desc}</p>
                          <p className="text-muted-foreground">
                            Tổng quà: <b>{p.box}</b> vé hộp · <b>{p.xp.toLocaleString()}</b> XP · <b>{p.camly.toLocaleString()}</b> Camly
                          </p>
                          <p className="text-muted-foreground mt-1">
                            Người góp <b>10%</b> ánh sáng → ~{Math.max(1, Math.round(p.box*0.1))} vé · {Math.max(50, Math.round(p.xp*0.1)).toLocaleString()} XP · {Math.max(100, Math.round(p.camly*0.1)).toLocaleString()} Camly.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
              <p className="text-[10px] text-muted-foreground italic mt-1">
                Đèn cấp cao hơn cho mọi thành viên góp ánh sáng nhiều phần thưởng hơn — vẫn chia theo tỉ lệ, không cạnh tranh.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)} className="flex-1">Huỷ</Button>
              <Button size="sm" onClick={() => create.mutate()}
                disabled={create.isPending || !name || name.length < 2 || !target}
                className="flex-1 bg-gradient-to-br from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold">
                Thắp đèn
              </Button>
            </div>
          </div>
        )}
        {!isOfficer && (
          <p className="text-[10px] italic text-muted-foreground">Chỉ founder/steward mới có thể thắp đèn mới.</p>
        )}
      </Card>
    );
  }

  const lamp = data.lamp!;
  const contribs = data.contributions ?? [];
  const pct = Math.min(100, Math.round((lamp.current_light / lamp.target_light) * 100));

  // Flame intensity: scale + speed + glow theo %
  const flameScale = 0.7 + (pct / 100) * 0.8; // 0.7 → 1.5
  const flameDuration = Math.max(0.4, 1.6 - (pct / 100) * 1.2); // nhanh dần
  const glowOpacity = 0.2 + (pct / 100) * 0.6;

  return (
    <Card className="p-4 space-y-3 border-amber-400/40 bg-gradient-to-br from-amber-500/5 via-yellow-500/5 to-amber-500/10">
      <div className="flex items-start gap-2">
        <div className="relative h-10 w-10 shrink-0 flex items-center justify-center">
          {/* Glow halo */}
          <div
            className="absolute inset-0 rounded-full blur-xl bg-amber-400 animate-pulse"
            style={{ opacity: glowOpacity }}
          />
          {/* Flame jumping */}
          <Flame
            className="relative h-7 w-7 text-amber-500 drop-shadow-[0_0_8px_rgba(255,200,50,0.8)]"
            style={{
              animation: `lamp-flame ${flameDuration}s ease-in-out infinite`,
              transformOrigin: "center bottom",
              ['--flame-scale' as never]: flameScale,
            }}
            fill="currentColor"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold leading-tight truncate">{lamp.name}</p>
          <p className="text-[10px] text-muted-foreground">
            Thắp từ {new Date(lamp.starts_at).toLocaleDateString("vi-VN")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="outline" className="text-xs">{pct}%</Badge>
          {(() => {
            const p = TIER_PRESETS[(lamp.loot_tier ?? "standard") as LootTier];
            return (
              <Badge variant="outline" className="text-[10px] gap-0.5" title={`Mỗi 1% đóng góp ≈ ${(p.box/100).toFixed(2)} vé hộp`}>
                <span>{p.emoji}</span>{p.label}
              </Badge>
            );
          })()}
        </div>
      </div>

      <div>
        <Progress value={pct} className="h-3" />
        <div className="flex justify-between items-center mt-1 text-xs">
          <span className="font-bold text-amber-600 tabular-nums">
            {lamp.current_light.toLocaleString()}
          </span>
          <span className="text-muted-foreground tabular-nums">
            / {lamp.target_light.toLocaleString()} ánh sáng
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-bold flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-amber-500" /> Đóng góp gần đây (realtime)
        </p>
        {contribs.length === 0 ? (
          <p className="text-[11px] italic text-muted-foreground text-center py-3">
            Chưa có đóng góp nào — hãy hoàn thành quest để thắp sáng đèn!
          </p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {contribs.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-background/50">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={c.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[9px]">{initials(c.display_name)}</AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate">{c.display_name}</span>
                <span className="font-bold text-amber-600 tabular-nums">+{c.amount.toLocaleString()}</span>
                <span className="text-[9px] text-muted-foreground w-14 text-right">
                  {formatDistanceToNow(new Date(c.created_at), { locale: vi, addSuffix: false })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {isOfficer && lamp.status === "active" && (
        <Button size="sm" variant="outline" className="w-full text-destructive border-destructive/30"
          onClick={() => { if (confirm("Đóng ngọn đèn này?")) close.mutate(lamp.id); }}
          disabled={close.isPending}>
          <X className="h-3.5 w-3.5 mr-1" /> Đóng đèn
        </Button>
      )}
      {lamp.status === "completed" && (
        <>
          <Badge className="w-full justify-center bg-amber-500/20 text-amber-700 dark:text-amber-300">
            🎉 Đèn đã đạt mục tiêu — cùng nhau toả sáng!
          </Badge>
          <LampLootPanel lampId={lamp.id} />
        </>
      )}
    </Card>
  );
}
