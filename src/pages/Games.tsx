import { useEffect } from "react";
import { smartBack } from "@/lib/smartBack";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles, Package, PawPrint, Map, Ticket, Sun, Users2,
  Send, Smartphone, Share2, ChevronLeft, Gamepad2, Flame,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setCanonical, cleanupSeo, getSeoOrigin } from "@/lib/seoHelpers";
import { PetCareCard } from "@/components/pet/PetCareCard";
import { NftCatalogGrid } from "@/components/nft/NftCatalogGrid";
import { usePet } from "@/hooks/usePet";
import { PET_IMAGES_BASE } from "@/assets/pet-images";

const PET_ELEMENT_OPTIONS = [
  { v: "fire" as const, label: "Lửa", emoji: "🔥" },
  { v: "water" as const, label: "Nước", emoji: "💧" },
  { v: "earth" as const, label: "Đất", emoji: "🌱" },
  { v: "air" as const, label: "Khí", emoji: "🌬️" },
  { v: "light" as const, label: "Ánh sáng", emoji: "✨" },
];

type Game = {
  href: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  tag?: string;
  featured?: boolean;
};

type GroupKey = "Mỗi ngày" | "Co-op" | "Bot" | "Mini App" | "Khác";

type GroupTheme = {
  label: string;
  desc: string;
  countBg: string;
  countText: string;
  cardBg: string;
  cardBorder: string;
  iconBg: string;
  iconText: string;
  tagBg: string;
  tagText: string;
};

const GROUP_THEME: Record<GroupKey, GroupTheme> = {
  "Mỗi ngày": {
    label: "Mỗi ngày",
    desc: "Giữ streak & nhận light",
    countBg: "bg-amber-100", countText: "text-amber-700",
    cardBg: "bg-amber-50/60", cardBorder: "border-amber-100",
    iconBg: "bg-amber-100", iconText: "text-amber-600",
    tagBg: "bg-amber-100", tagText: "text-amber-700",
  },
  "Co-op": {
    label: "Co-op",
    desc: "Cộng đồng liên kết",
    countBg: "bg-indigo-100", countText: "text-indigo-700",
    cardBg: "bg-indigo-50/60", cardBorder: "border-indigo-100",
    iconBg: "bg-indigo-100", iconText: "text-indigo-600",
    tagBg: "bg-indigo-100", tagText: "text-indigo-700",
  },
  "Bot": {
    label: "Bot",
    desc: "Tương tác qua Telegram",
    countBg: "bg-sky-100", countText: "text-sky-700",
    cardBg: "bg-sky-50/60", cardBorder: "border-sky-100",
    iconBg: "bg-sky-500", iconText: "text-white",
    tagBg: "bg-sky-100", tagText: "text-sky-700",
  },
  "Mini App": {
    label: "Mini App",
    desc: "Trải nghiệm rút gọn",
    countBg: "bg-emerald-100", countText: "text-emerald-700",
    cardBg: "bg-emerald-50/60", cardBorder: "border-emerald-100",
    iconBg: "bg-emerald-100", iconText: "text-emerald-600",
    tagBg: "bg-emerald-100", tagText: "text-emerald-700",
  },
  "Khác": {
    label: "Khác",
    desc: "Mở rộng mạng lưới ánh sáng",
    countBg: "bg-violet-100", countText: "text-violet-700",
    cardBg: "bg-violet-50/60", cardBorder: "border-violet-100",
    iconBg: "bg-violet-100", iconText: "text-violet-600",
    tagBg: "bg-violet-100", tagText: "text-violet-700",
  },
};

const games: (Game & { group: GroupKey })[] = [
  { href: "/quest", title: "Daily Light Quest", desc: "5 nhiệm vụ ánh sáng mỗi ngày, streak ×1.0–2.0", icon: Sparkles, tag: "Streak ×1.0–2.0", group: "Mỗi ngày", featured: true },
  { href: "/inventory", title: "Mystery Box & NFT", desc: "Mở hộp bí ẩn, sưu tập NFT Light Spark / Lamp Keeper", icon: Package, tag: "Sưu tập", group: "Mỗi ngày" },
  { href: "/forge", title: "Light Forge", desc: "Gộp 3 NFT cùng tier → 1 NFT tier cao hơn, 5% drop Cosmic Box", icon: Flame, tag: "Forge", group: "Mỗi ngày" },
  { href: "/pet", title: "AI Companion Pet", desc: "Nuôi linh thú Angel AI, multiplier 1.0–1.20×", icon: PawPrint, tag: "Đồng hành", group: "Mỗi ngày" },
  { href: "/season", title: "Season Pass", desc: "Cosmic Summer 2026 — 30 level Free + Premium", icon: Ticket, tag: "Mùa", group: "Mỗi ngày" },
  { href: "/treasure", title: "Treasure Hunt", desc: "Săn kho báu theo mùa, co-op team chia jackpot", icon: Map, tag: "Team", group: "Co-op" },
  { href: "/raid", title: "Cùng thắp sáng", desc: "PvE thắp Ngọn đèn 50M ánh sáng cùng cộng đồng", icon: Sun, tag: "Tập thể", group: "Co-op" },
  { href: "/circle", title: "Vòng Sáng (Light Circle)", desc: "Co-op 2–20 người, ngọn đèn riêng + chat realtime", icon: Users2, tag: "2–20 người", group: "Co-op" },
  { href: "/connector", title: "Light Connector", desc: "Mời người mới on-chain, nhận SBT Connector", icon: Share2, tag: "Viral", group: "Khác" },
  { href: "/telegram", title: "Liên kết Telegram", desc: "Liên kết bot để nhận thông báo & chơi qua Telegram", icon: Send, tag: "Bot", group: "Bot" },
  { href: "/tg", title: "Telegram Mini App", desc: "Tóm tắt nhanh trong Telegram WebApp", icon: Smartphone, tag: "WebApp", group: "Mini App" },
];

const GROUP_ORDER: GroupKey[] = ["Mỗi ngày", "Co-op", "Bot", "Mini App", "Khác"];

export default function Games() {
  const navigate = useNavigate();
  const { pet } = usePet();

  useEffect(() => {
    setCanonical(`${getSeoOrigin()}/games`);
    document.title = "Mini Games — Angel AI";
    return () => cleanupSeo();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-5 py-5 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => smartBack(navigate)} className="min-h-11 -ml-2">
            <ChevronLeft className="h-4 w-4 mr-1" /> Quay lại
          </Button>
          <Badge className="bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold border-0">
            <Gamepad2 className="h-3.5 w-3.5 mr-1" /> Mini Games
          </Badge>
        </div>

        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-3.5 rounded-3xl bg-amber-50">
            <Gamepad2 className="h-9 w-9 text-amber-500" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Mini Games</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Tất cả trò chơi ánh sáng của Angel AI ở một nơi. Mọi phần thưởng đều cần
            bằng chứng và đi qua AI Scoring + Anti-Sybil.
          </p>
        </div>

        {/* Pet care widget — live snapshot + daily care */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">Thú cưng của bạn</h2>
              <span className="text-[11px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md">Daily Care</span>
            </div>
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Tương tác = XP</span>
          </div>
          <PetCareCard />
        </section>

        {/* Pet picker — chỉ hiện khi chưa có pet */}
        {!pet && (
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">Chọn nguyên tố Pet</h2>
                <span className="text-[11px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">Adopt</span>
              </div>
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">5 nguyên tố</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {PET_ELEMENT_OPTIONS.map((e) => (
                <button
                  key={e.v}
                  type="button"
                  onClick={() => navigate(`/pet?element=${e.v}`)}
                  className="group flex flex-col items-center gap-1 p-2 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-md active:scale-[0.97] transition"
                >
                    <div className="w-full aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-muted to-transparent">
                      <img
                        src={PET_IMAGES_BASE[e.v]}
                        alt={`Linh thú ${e.label}`}
                        loading="lazy"
                        className="w-full h-full object-contain drop-shadow"
                        draggable={false}
                      />
                    </div>
                  <div className="text-[11px] font-bold flex items-center gap-0.5">
                    <span>{e.emoji}</span>
                    <span>{e.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* NFT catalog — preview 4 bộ đầu tiên */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">NFT có thể sưu tập</h2>
              <span className="text-[11px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-md">Catalog</span>
            </div>
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Bấm để xem cách nhận</span>
          </div>
          <NftCatalogGrid compact limit={4} />
        </section>

        {/* Groups */}
        {GROUP_ORDER.map((group) => {
          const items = games.filter((g) => g.group === group);
          if (items.length === 0) return null;
          const theme = GROUP_THEME[group];
          const featured = items.find((g) => g.featured);
          const rest = items.filter((g) => !g.featured);

          return (
            <section key={group} className="space-y-3">
              <div className="flex items-baseline justify-between gap-3 px-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">{theme.label}</h2>
                  <span className={`text-[11px] font-bold ${theme.countBg} ${theme.countText} px-2 py-0.5 rounded-md`}>
                    {items.length}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                  {theme.desc}
                </span>
              </div>

              {/* Featured hero card (Gold 11) — only for Mỗi ngày */}
              {featured && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => navigate(featured.href)}
                  className="relative overflow-hidden rounded-3xl p-5 cursor-pointer shadow-lg shadow-amber-500/10 active:scale-[0.99] transition-transform"
                  style={{
                    background:
                      "linear-gradient(135deg, #b8860b 0%, #daa520 35%, #ffd700 70%, #ffec8b 100%)",
                  }}
                >
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div className="h-14 w-14 rounded-2xl bg-white/30 backdrop-blur-md flex items-center justify-center border border-white/40">
                        <featured.icon className="h-7 w-7 !text-black" />
                      </div>
                      {featured.tag && (
                        <span className="bg-white/90 !text-black text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wide">
                          {featured.tag}
                        </span>
                      )}
                    </div>
                    <h3 className="!text-black text-xl font-extrabold">{featured.title}</h3>
                    <p className="!text-black/75 text-sm mt-1 font-medium">{featured.desc}</p>
                  </div>
                  <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/25 blur-3xl rounded-full pointer-events-none" />
                </motion.div>
              )}

              {/* Sub cards */}
              <div className="space-y-3">
                {rest.map((g, i) => {
                  const Icon = g.icon;
                  return (
                    <motion.div
                      key={g.href}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.035 }}
                      onClick={() => navigate(g.href)}
                      className={`flex items-center gap-4 p-4 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} cursor-pointer hover:shadow-md active:scale-[0.99] transition-all min-h-[72px]`}
                    >
                      <div className={`h-12 w-12 shrink-0 rounded-2xl ${theme.iconBg} ${theme.iconText} flex items-center justify-center`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm text-foreground">{g.title}</h3>
                          {g.tag && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${theme.tagBg} ${theme.tagText}`}>
                              {g.tag}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {g.desc}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Footer */}
        <div className="p-5 bg-muted/40 rounded-3xl text-center space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Không có bảng xếp hạng cạnh tranh. Mọi ánh sáng tích lũy đều phục vụ cộng đồng.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/glossary")}
            className="rounded-full"
          >
            Không hiểu XP / Pet stage / Season Pass? Mở Từ điển →
          </Button>
        </div>
      </div>
    </div>
  );
}
