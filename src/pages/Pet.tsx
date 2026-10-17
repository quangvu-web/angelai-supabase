import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Send, Loader2, Sparkles, Pencil } from "lucide-react";
import { usePet, xpForLevel, PetElement, PetPersonality } from "@/hooks/usePet";
import { PetAvatar } from "@/components/pet/PetAvatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { PET_IMAGES, PET_IMAGES_BASE, PET_EVOLUTION_ORDER } from "@/assets/pet-images";
import { smartBack } from "@/lib/smartBack";
import { NftCatalogGrid } from "@/components/nft/NftCatalogGrid";

const elements: { v: PetElement; label: string; emoji: string; vibe: string }[] = [
  { v: "fire", label: "Lửa", emoji: "🔥", vibe: "Nhiệt huyết, thúc đẩy hành động" },
  { v: "water", label: "Nước", emoji: "💧", vibe: "Dịu dàng, chữa lành" },
  { v: "earth", label: "Đất", emoji: "🌱", vibe: "Vững chãi, kỷ luật" },
  { v: "air", label: "Khí", emoji: "🌬️", vibe: "Sáng tạo, mở góc nhìn" },
  { v: "light", label: "Ánh sáng", emoji: "✨", vibe: "Tỉnh thức, nâng tầng ý thức" },
];
const personalities: { v: PetPersonality; label: string; emoji: string }[] = [
  { v: "joyful", label: "Vui tươi", emoji: "😄" },
  { v: "wise", label: "Khôn ngoan", emoji: "🧘" },
  { v: "bold", label: "Mạnh mẽ", emoji: "💪" },
  { v: "gentle", label: "Ấm dịu", emoji: "🤗" },
];

export default function PetPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialElement = (searchParams.get("element") as PetElement) || "light";
  const { pet, isLoading, adoptAsync, isAdopting, chatHistory, chat, isChatting, rename, isRenaming } = usePet();
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [name, setName] = useState("");
  const [element, setElement] = useState<PetElement>(
    ["fire", "water", "earth", "air", "light"].includes(initialElement) ? initialElement : "light"
  );
  const [personality, setPersonality] = useState<PetPersonality>("gentle");
  const [msg, setMsg] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewStage, setPreviewStage] = useState<import("@/hooks/usePet").PetEvolution>("flame");
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedElement = elements.find((e) => e.v === element)!;
  const selectedPersonality = personalities.find((p) => p.v === personality)!;
  const trimmedName = name.trim();

  const handleConfirmAdopt = async () => {
    try {
      await adoptAsync({ name: trimmedName, element, personality });
      setConfirmOpen(false);
      // Clean ?element= param so back/refresh không tái mở picker
      navigate("/pet", { replace: true });
      // Cuộn lên đầu để thấy ngay thẻ pet vừa nhận
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    } catch {
      /* toast đã hiển thị trong usePet */
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatHistory.length, isChatting]);

  // Near-evolution alert: notify once per stage when within 100 XP of next stage
  useEffect(() => {
    if (!pet) return;
    const stages = [
      { key: "spark", min: 0 },
      { key: "glow", min: 500 },
      { key: "flame", min: 2000 },
      { key: "star", min: 6000 },
      { key: "sun", min: 15000 },
      { key: "cosmos", min: 40000 },
    ] as const;
    const idx = stages.findIndex((s) => s.key === pet.evolution);
    const next = stages[idx + 1];
    if (!next) return;
    const xpToNext = next.min - (pet.total_xp ?? 0);
    if (xpToNext <= 0 || xpToNext > 100) return;
    const flagKey = `pet:near:${pet.id}:${next.key}`;
    if (sessionStorage.getItem(flagKey)) return;
    sessionStorage.setItem(flagKey, "1");
    const nextGain = idx + 2; // spark+1, glow+2, flame+3, star+4, sun+5, cosmos+6
    const projectedAura = Math.min(100, (pet.aura ?? 0) + nextGain);
    toast.success(`✨ Sắp lên stage ${next.key.toUpperCase()}!`, {
      description: `Còn ${xpToNext} XP. Aura sau khi lên stage: ${projectedAura}/100 (+${nextGain}/XP).`,
      duration: 6000,
    });
  }, [pet?.total_xp, pet?.evolution, pet?.id, pet?.aura]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const onSend = () => {
    if (!msg.trim()) return;
    chat(msg.trim());
    setMsg("");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => smartBack(navigate)} className="min-h-11">
            <ChevronLeft className="h-4 w-4 mr-1" /> Quay lại
          </Button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> AI Companion Pet
          </h1>
          <div className="w-20" />
        </div>

        {!pet ? (
          <Card className="p-6 space-y-5">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Đón thú cưng ánh sáng đầu tiên</h2>
              <p className="text-sm text-muted-foreground">Bạn đồng hành cùng bạn trên hành trình ánh sáng — tăng XP cùng quest, nâng evolution, mở multiplier Camly.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Đặt tên</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="VD: Lumi, Sora, Tia..." />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Chọn linh thú đồng hành</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {elements.map((e) => {
                  const active = element === e.v;
                  return (
                    <button
                      key={e.v}
                      type="button"
                      onClick={() => setElement(e.v)}
                      className={`group relative p-3 rounded-2xl border-2 text-center transition-all ${
                        active
                          ? "border-primary bg-gradient-to-b from-primary/15 to-primary/5 shadow-lg scale-[1.02]"
                          : "border-border hover:border-primary/40 hover:bg-muted/40"
                      }`}
                    >
                      {active && (
                        <span className="absolute top-2 right-2 text-[10px] font-bold bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black px-2 py-0.5 rounded-full">
                          ✓
                        </span>
                      )}
                      <div className={`mx-auto w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br ${
                        active ? "from-primary/20 to-transparent" : "from-muted to-transparent"
                      } transition-transform group-hover:scale-105`}>
                        <img
                          src={PET_IMAGES_BASE[e.v]}
                          alt={`Linh thú ${e.label}`}
                          width={224}
                          height={224}
                          loading="lazy"
                          className="w-full h-full object-contain drop-shadow-md"
                          draggable={false}
                        />
                      </div>
                      <div className="text-sm font-bold mt-2 flex items-center justify-center gap-1">
                        <span>{e.emoji}</span> {e.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                        {e.vibe}
                      </div>
                    </button>
                  );
                })}
              </div>

              <StagePreviewStrip
                element={element}
                stage={previewStage}
                onPick={setPreviewStage}
                elementLabel={selectedElement.label}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tính cách</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {personalities.map((p) => (
                  <button key={p.v} type="button" onClick={() => setPersonality(p.v)}
                    className={`p-3 rounded-lg border text-center min-h-16 transition ${personality === p.v ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40"}`}>
                    <div className="text-2xl">{p.emoji}</div>
                    <div className="text-xs font-medium mt-1">{p.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={isAdopting || trimmedName.length < 1}
              className="w-full min-h-11"
            >
              {isAdopting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang đón...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Đón thú cưng</>
              )}
            </Button>

            <AlertDialog open={confirmOpen} onOpenChange={(o) => !isAdopting && setConfirmOpen(o)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" /> Xác nhận nhận nuôi
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3 pt-1">
                      <p>Sau khi nhận nuôi, mỗi tài khoản chỉ có <b>một</b> thú cưng đồng hành. Bạn có chắc chắn?</p>
                      <div className="rounded-lg border p-3 bg-muted/40 space-y-1.5 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Tên</span><b className="text-foreground">{trimmedName || "—"}</b></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Linh thú</span><b className="text-foreground">{selectedElement.emoji} {selectedElement.label}</b></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Tính cách</span><b className="text-foreground">{selectedPersonality.emoji} {selectedPersonality.label}</b></div>
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isAdopting}>Để sau</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isAdopting || trimmedName.length < 1}
                    onClick={(e) => { e.preventDefault(); handleConfirmAdopt(); }}
                  >
                    {isAdopting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang nhận nuôi...</>
                    ) : (
                      <><Sparkles className="h-4 w-4 mr-2" /> Đồng ý nhận nuôi</>
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Card>
        ) : (
          <>
            <Card className="p-5 bg-gradient-to-br from-primary/10 to-transparent">
              <div className="flex items-center gap-4">
                <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                  <PetAvatar pet={pet} size={88} />
                </motion.div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold truncate">{pet.name}</h2>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 min-h-0 min-w-0"
                      onClick={() => { setNewName(pet.name); setRenameOpen(true); }}
                      aria-label="Đổi tên thú cưng"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Badge variant="outline">Lv {pet.level}</Badge>
                    <Badge className="bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold border-0">
                      {pet.evolution}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 capitalize">
                    {pet.element} • {pet.personality}
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>XP</span>
                      <span>{pet.xp}/{xpForLevel(pet.level)}</span>
                    </div>
                    <Progress value={(pet.xp / xpForLevel(pet.level)) * 100} className="h-2" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4">
                <Stat icon="⚡" label="Energy" value={pet.energy} />
                <Stat icon="💖" label="Mood" value={pet.mood} />
                <Stat icon="🌟" label="Aura" value={pet.aura} />
              </div>

              <EvolutionTrack totalXp={pet.total_xp ?? 0} current={pet.evolution} element={pet.element} />
            </Card>

            <AuraBreakdown aura={pet.aura} evolution={pet.evolution} totalXp={pet.total_xp ?? 0} />


            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b font-semibold text-sm">Trò chuyện cùng {pet.name}</div>
              <div ref={scrollRef} className="h-[360px] overflow-y-auto px-4 py-3 space-y-3 bg-muted/20">
                {chatHistory.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Hãy chào {pet.name} câu đầu tiên ✨
                  </p>
                )}
                {chatHistory.map((m) => (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border"
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {isChatting && (
                  <div className="flex justify-start">
                    <div className="bg-card border rounded-2xl px-3 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Đang trả lời...
                    </div>
                  </div>
                )}
              </div>
              <div className="p-3 border-t flex gap-2">
                <Input
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
                  placeholder={`Nhắn ${pet.name}...`}
                  maxLength={500}
                  disabled={isChatting}
                />
                <Button onClick={onSend} disabled={isChatting || !msg.trim()} size="icon" className="min-h-11 min-w-11">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </Card>

            <p className="text-xs text-muted-foreground text-center">
              Multiplier Camly hiện tại: <b>×{petMultiplier(pet.level).toFixed(2)}</b> • Cap kết hợp ≤ 2.5×
            </p>

            <AlertDialog open={renameOpen} onOpenChange={(o) => !isRenaming && setRenameOpen(o)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <Pencil className="h-4 w-4 text-primary" /> Đổi tên thú cưng
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Đặt một cái tên mới cho người bạn ánh sáng của bạn (1–24 ký tự).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={24}
                  placeholder="VD: Lumi, Sora, Tia..."
                  autoFocus
                  disabled={isRenaming}
                />
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isRenaming}>Huỷ</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isRenaming || newName.trim().length < 1 || newName.trim() === pet.name}
                    onClick={async (e) => {
                      e.preventDefault();
                      try {
                        await rename(newName);
                        setRenameOpen(false);
                      } catch { /* toast trong hook */ }
                    }}
                  >
                    {isRenaming ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang lưu...</>
                    ) : (
                      <>Lưu tên mới</>
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}

        <PetCollectionShowcase />

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Bộ sưu tập NFT
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate("/inventory")} className="text-xs">
              Xem tất cả
            </Button>
          </div>
          <NftCatalogGrid compact limit={4} />
        </Card>
      </div>
    </div>
  );
}

function PetCollectionShowcase() {
  return (
    <Card className="p-4 space-y-3">
      <div>
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Bộ sưu tập linh thú
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          5 hệ × 6 stage tiến hoá theo XP &amp; Ánh sáng
        </p>
      </div>
      <div className="space-y-3">
        {elements.map((e) => (
          <div key={e.v}>
            <div className="flex items-center gap-1.5 text-xs font-semibold mb-1.5">
              <span>{e.emoji}</span>
              <span>{e.label}</span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {PET_EVOLUTION_ORDER.map((stage) => (
                <div key={stage} className="flex flex-col items-center gap-1">
                  <div className="w-full aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-muted to-transparent border">
                    <img
                      src={PET_IMAGES[e.v][stage]}
                      alt={`${e.label} ${stage}`}
                      loading="lazy"
                      className="w-full h-full object-contain"
                      draggable={false}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground capitalize leading-none">{stage}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-lg">{icon}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}

const EVOLUTION_STAGES: { key: import("@/hooks/usePet").PetEvolution; label: string; min: number; emoji: string; aura: string }[] = [
  { key: "spark",  label: "Spark",  min: 0,     emoji: "✨", aura: "+1 Aura/XP" },
  { key: "glow",   label: "Glow",   min: 500,   emoji: "🌟", aura: "+2 Aura/XP" },
  { key: "flame",  label: "Flame",  min: 2000,  emoji: "🔥", aura: "+3 Aura/XP" },
  { key: "star",   label: "Star",   min: 6000,  emoji: "⭐", aura: "+4 Aura/XP" },
  { key: "sun",    label: "Sun",    min: 15000, emoji: "☀️", aura: "+5 Aura/XP" },
  { key: "cosmos", label: "Cosmos", min: 40000, emoji: "🌌", aura: "+6 Aura/XP" },
];

function EvolutionTrack({
  totalXp,
  current,
  element,
}: {
  totalXp: number;
  current: import("@/hooks/usePet").PetEvolution;
  element: PetElement;
}) {
  const idx = EVOLUTION_STAGES.findIndex((s) => s.key === current);
  const next = EVOLUTION_STAGES[idx + 1];
  const pct = next
    ? Math.min(100, ((totalXp - EVOLUTION_STAGES[idx].min) / (next.min - EVOLUTION_STAGES[idx].min)) * 100)
    : 100;
  const [preview, setPreview] = useState<import("@/hooks/usePet").PetEvolution>(current);
  // Keep preview in sync khi pet tự lên stage
  useEffect(() => { setPreview(current); }, [current]);
  const previewStageInfo = EVOLUTION_STAGES.find((s) => s.key === preview)!;
  const previewIdx = EVOLUTION_STAGES.findIndex((s) => s.key === preview);
  const previewReached = previewIdx <= idx;
  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold">Hành trình tiến hoá</span>
        <span className="text-muted-foreground">Tổng: <b className="text-foreground">{totalXp.toLocaleString()}</b></span>
      </div>

      <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3">
        <div className="relative h-20 w-20 shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-muted to-transparent ring-2 ring-primary/30">
          <img
            src={PET_IMAGES[element][preview]}
            alt={`Preview ${previewStageInfo.label}`}
            className={`h-full w-full object-contain ${previewReached ? "" : "grayscale opacity-80"}`}
            draggable={false}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">Đang xem trước</div>
          <div className="font-bold flex items-center gap-1.5">
            <span>{previewStageInfo.emoji}</span>
            <span>{previewStageInfo.label}</span>
            {preview === current && (
              <span className="text-[10px] font-bold bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black px-1.5 py-0.5 rounded-full">Hiện tại</span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {previewReached
              ? `Đã mở • ${previewStageInfo.aura}`
              : `Cần ${previewStageInfo.min.toLocaleString()} XP để mở • ${previewStageInfo.aura}`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {EVOLUTION_STAGES.map((s, i) => {
          const active = s.key === current;
          const reached = i <= idx;
          const isPreview = s.key === preview;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setPreview(s.key)}
              title={reached ? `${s.label} • đã mở` : `Đạt ${s.min.toLocaleString()} XP để mở`}
              className={`rounded-xl border p-2 text-center transition min-h-[88px] ${
                isPreview
                  ? "border-primary ring-2 ring-primary/40 bg-primary/10"
                  : active
                    ? "border-primary/60 bg-primary/5"
                    : reached
                      ? "border-border bg-muted/20 hover:border-primary/40"
                      : "border-border/70 bg-muted/10 opacity-70 hover:opacity-100"
              }`}
            >
              <div className="mx-auto mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-muted to-transparent overflow-hidden">
                <img
                  src={PET_IMAGES[element][s.key]}
                  alt={`${s.label} ${element}`}
                  width={96}
                  height={96}
                  loading="lazy"
                  className={`h-full w-full object-contain ${reached ? "" : "grayscale"}`}
                  draggable={false}
                />
              </div>
              <div className="text-[10px] font-semibold">{s.label}</div>
              <div className="text-[9px] text-muted-foreground">{s.min.toLocaleString()} XP</div>
            </button>
          );
        })}
      </div>
      {next ? (
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span>Đến <b>{next.label}</b> ({next.aura})</span>
            <span className="text-muted-foreground">{Math.max(0, next.min - totalXp).toLocaleString()} XP nữa</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700]" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : (
        <div className="text-center text-[11px] text-muted-foreground">Đã đạt evolution tối đa 🌌</div>
      )}
    </div>
  );
}

const AURA_TABLE: { key: import("@/hooks/usePet").PetEvolution; label: string; emoji: string; gain: number }[] = [
  { key: "spark",  label: "Spark",  emoji: "✨", gain: 1 },
  { key: "glow",   label: "Glow",   emoji: "🌟", gain: 2 },
  { key: "flame",  label: "Flame",  emoji: "🔥", gain: 3 },
  { key: "star",   label: "Star",   emoji: "⭐", gain: 4 },
  { key: "sun",    label: "Sun",    emoji: "☀️", gain: 5 },
  { key: "cosmos", label: "Cosmos", emoji: "🌌", gain: 6 },
];

function AuraBreakdown({ aura, evolution, totalXp }: { aura: number; evolution: import("@/hooks/usePet").PetEvolution; totalXp: number }) {
  const max = 100;
  const pct = Math.min(100, (aura / max) * 100);
  const current = AURA_TABLE.find((s) => s.key === evolution)!;
  const idx = EVOLUTION_STAGES.findIndex((s) => s.key === evolution);
  const next = EVOLUTION_STAGES[idx + 1];
  const nextAura = next ? AURA_TABLE.find((a) => a.key === next.key)! : null;
  const xpToNext = next ? Math.max(0, next.min - totalXp) : 0;
  const stagePct = next
    ? Math.min(100, ((totalXp - EVOLUTION_STAGES[idx].min) / (next.min - EVOLUTION_STAGES[idx].min)) * 100)
    : 100;
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">🌟 Aura Breakdown</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Mỗi lần nhận XP, Aura tăng theo stage tiến hoá hiện tại.
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] bg-clip-text text-transparent">
            {aura}<span className="text-sm text-muted-foreground font-normal"> / {max}</span>
          </div>
          <div className="text-[11px] text-muted-foreground">Stage hiện tại: <b>+{current.gain}</b>/XP</div>
        </div>
      </div>

      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700]" style={{ width: `${pct}%` }} />
      </div>

      <div className="grid grid-cols-6 gap-1">
        {AURA_TABLE.map((s) => {
          const active = s.key === evolution;
          return (
            <div key={s.key} className={`text-center rounded-md py-2 border ${active ? "bg-primary/10 border-primary/50" : "border-border opacity-60"}`}>
              <div className="text-base leading-none">{s.emoji}</div>
              <div className="text-[10px] mt-1 font-medium">{s.label}</div>
              <div className={`text-[11px] font-bold ${active ? "text-primary" : "text-muted-foreground"}`}>+{s.gain}</div>
            </div>
          );
        })}
      </div>

      {next && nextAura ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span>
              Cần thêm <b className="text-primary">{xpToNext.toLocaleString()} XP</b> để lên{" "}
              <b>{next.label} {nextAura.emoji}</b>
            </span>
            <span className="text-muted-foreground">
              <b className="text-primary">+{current.gain}</b> → <b className="text-primary">+{nextAura.gain}</b>/XP
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700]" style={{ width: `${stagePct}%` }} />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{EVOLUTION_STAGES[idx].min.toLocaleString()} XP</span>
            <span>Tổng hiện tại: {totalXp.toLocaleString()}</span>
            <span>{next.min.toLocaleString()} XP</span>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center text-xs">
          🌌 Đã đạt Cosmos — Aura nhận <b>+{current.gain}</b>/XP (mức tối đa)
        </div>
      )}


      <p className="text-[11px] text-muted-foreground text-center">
        Aura tối đa {max}. Nâng evolution để tăng Aura nhanh hơn mỗi lần claim quest hoặc trò chuyện.
      </p>
    </Card>
  );
}

function StagePreviewStrip({
  element,
  stage,
  onPick,
  elementLabel,
}: {
  element: PetElement;
  stage: import("@/hooks/usePet").PetEvolution;
  onPick: (s: import("@/hooks/usePet").PetEvolution) => void;
  elementLabel: string;
}) {
  const info = EVOLUTION_STAGES.find((s) => s.key === stage)!;
  return (
    <div className="rounded-2xl border bg-gradient-to-br from-primary/5 to-transparent p-3 space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative h-24 w-24 shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-muted to-transparent ring-2 ring-primary/30">
          <img
            src={PET_IMAGES[element][stage]}
            alt={`Preview ${elementLabel} ${info.label}`}
            className="h-full w-full object-contain"
            draggable={false}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-muted-foreground">Xem trước tiến hoá</div>
          <div className="font-bold flex items-center gap-1.5">
            <span>{info.emoji}</span>
            <span>{elementLabel} • {info.label}</span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Mở khi đạt <b className="text-foreground">{info.min.toLocaleString()} XP</b> • {info.aura}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Bấm các stage bên dưới để xem trước hình tiến hoá trước khi nhận nuôi.
          </div>
        </div>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {PET_EVOLUTION_ORDER.map((key) => {
          const s = EVOLUTION_STAGES.find((x) => x.key === key)!;
          const active = key === stage;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(key)}
              title={`${s.label} • ${s.min.toLocaleString()} XP`}
              className={`rounded-lg border p-1.5 text-center transition ${
                active
                  ? "border-primary ring-2 ring-primary/40 bg-primary/10"
                  : "border-border hover:border-primary/40 bg-muted/20"
              }`}
            >
              <div className="mx-auto h-10 w-10 rounded-full overflow-hidden bg-gradient-to-br from-muted to-transparent">
                <img
                  src={PET_IMAGES[element][key]}
                  alt={s.label}
                  className="h-full w-full object-contain"
                  loading="lazy"
                  draggable={false}
                />
              </div>
              <div className="text-[9px] font-semibold mt-0.5 truncate">{s.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function petMultiplier(lvl: number) {
  if (lvl >= 91) return 1.20;
  if (lvl >= 61) return 1.15;
  if (lvl >= 31) return 1.10;
  if (lvl >= 11) return 1.05;
  return 1.0;
}
