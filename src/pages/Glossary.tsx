import { useEffect, useState, useMemo } from "react";
import { smartBack } from "@/lib/smartBack";
import { useNavigate } from "@/lib/router-compat";
import { ChevronLeft, BookOpen, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { setCanonical, cleanupSeo, getSeoOrigin } from "@/lib/seoHelpers";

type Term = {
  id: string;
  term: string;
  short: string;
  long: string;
  category: "Chỉ số" | "Phần thưởng" | "Pet" | "Mùa" | "Cộng đồng" | "Tiền tệ";
};

const TERMS: Term[] = [
  {
    id: "xp",
    term: "XP (Experience Points)",
    short: "Điểm kinh nghiệm — đo mức độ tham gia, KHÔNG phải tiền.",
    long: "XP cộng vào hai nơi: (1) Pet companion để pet tiến hoá qua các stage và mở multiplier, (2) Season Pass để leo level mở quà mỗi mốc. XP không rút được, không quy đổi sang FUN Money hay Camly Coin.",
    category: "Chỉ số",
  },
  {
    id: "level",
    term: "Level (Cấp)",
    short: "Mốc tiến trình mở khoá quà / khả năng mới.",
    long: "Có 2 hệ Level chính: Pet Level (Egg → Hatchling → Adult → Elder, ảnh hưởng multiplier 1.0–1.20×) và Season Level (1–30, mở quà Free + Premium trong mùa hiện tại).",
    category: "Chỉ số",
  },
  {
    id: "pet-stage",
    term: "Pet Stage",
    short: "Giai đoạn tiến hoá của linh thú đồng hành.",
    long: "Pet trải qua 4 stage: Egg (mới nhận), Hatchling, Adult, Elder. Mỗi stage tăng multiplier (1.0× → 1.20×) áp lên phần thưởng claim quest. Khi tiến hoá, hệ thống tự enqueue NFT Pet Genesis (soulbound) tương ứng.",
    category: "Pet",
  },
  {
    id: "multiplier",
    term: "Multiplier",
    short: "Hệ số nhân áp lên phần thưởng.",
    long: "Có 2 nguồn multiplier cộng dồn: Streak (1.0×–2.0× theo chuỗi ngày liên tiếp) và Pet (1.0×–1.20× theo stage). Multiplier áp lên Camly + XP khi claim quest, không áp lên FUN Money.",
    category: "Chỉ số",
  },
  {
    id: "streak",
    term: "Streak (Chuỗi ngày)",
    short: "Số ngày liên tiếp claim quest.",
    long: "Streak tăng mỗi ngày bạn hoàn thành ít nhất 1 quest. Mất 1 ngày sẽ reset về 0. Mốc streak (7/14/30...) tự động trao Mystery Box bonus.",
    category: "Chỉ số",
  },
  {
    id: "season-pass",
    term: "Season Pass",
    short: "Thẻ mùa — tích XP để mở 30 mốc quà.",
    long: "Mỗi mùa (vd Cosmic Summer 2026) kéo dài ~3 tháng với 30 level. Track Free mở mặc định cho mọi người. Track Premium cần unlock 1 lần/mùa (Camly), mở thêm quà ở cùng level. XP từ mọi hoạt động (quest, pet, treasure, raid, circle) đều cộng vào Season XP.",
    category: "Mùa",
  },
  {
    id: "weekly-quest",
    term: "Weekly Quest",
    short: "5 nhiệm vụ tuần, reset thứ 2 (giờ VN).",
    long: "Bổ sung Daily Quest, đếm progress on-the-fly. Claim trao XP trực tiếp vào Season Pass.",
    category: "Mùa",
  },
  {
    id: "mystery-box",
    term: "Mystery Box",
    short: "Hộp bí ẩn chứa Camly / XP / NFT.",
    long: "Có 4 tier (common → cosmic). Bạn nhận vé qua streak, raid, lamp loot, hoặc claim quest. Mở bằng commit-reveal để đảm bảo công bằng. Một số phần là NFT Light Spark soulbound.",
    category: "Phần thưởng",
  },
  {
    id: "nft",
    term: "NFT (Soulbound)",
    short: "Vật phẩm sưu tập gắn vĩnh viễn với FUN ID.",
    long: "Angel AI dùng NFT soulbound (không chuyển nhượng) để ghi nhận thành tựu: Lighthouse Badge (streak), Light Spark (mở box), Pet Genesis (nhận pet), Lamp Keeper (góp ≥25% ngọn đèn), Light Connector (mời người mới on-chain).",
    category: "Phần thưởng",
  },
  {
    id: "light-pool",
    term: "Light Pool / Ngọn đèn",
    short: "Bể ánh sáng tập thể, mọi người cùng góp.",
    long: "Trong PvE 'Cùng thắp sáng' và Vòng Sáng, XP cá nhân được absorb ×5 vào light_pool. Khi đèn đầy, hệ thống tự chia loot theo share_pct (Camly + XP + vé hộp), không cắt phần ai cả.",
    category: "Cộng đồng",
  },
  {
    id: "loot-tier",
    term: "Loot Tier (Standard/Rare/Epic)",
    short: "Cấp phần thưởng officer chọn khi thắp đèn.",
    long: "Trong Vòng Sáng, officer chọn 1 trong 3 preset (standard/rare/epic) trước khi thắp đèn. Tier càng cao, loot càng nhiều nhưng cần nhiều ánh sáng hơn để hoàn thành.",
    category: "Cộng đồng",
  },
  {
    id: "fun-money",
    term: "FUN Money",
    short: "Token chính của FUN SuperApp (BSC).",
    long: "Mint qua quy trình PLP: 70% UserReward, 12% Eco, 10% Treasury, 5% Strategic, 3% Resilience. Mỗi đợt nhận: 25% instant + 75% locked vesting 28 ngày. Cap 3% mỗi user / mùa. Cần ký PLP charter + score ≥10 để đủ điều kiện.",
    category: "Tiền tệ",
  },
  {
    id: "camly",
    term: "Camly Coin",
    short: "Token tiện ích nội bộ (3 decimals).",
    long: "Camly là 'tiền tiêu vặt' trong app: dùng unlock Premium Season, gửi gift, mở chợ. Cap 250K Camly/user/ngày, reset 00:00 giờ VN. Gift nhận về (gift_received) không tính vào cap.",
    category: "Tiền tệ",
  },
  {
    id: "tls",
    term: "TLS / DisplayLS (Light Score)",
    short: "Chỉ số ánh sáng tổng — danh tiếng dài hạn.",
    long: "TLS = PLS (cá nhân) + NLS (mạng lưới) + LLS (legacy). DisplayLS = 100 × ln(1+TLS). Có 6 tier. Đây không phải xếp hạng cạnh tranh, mà là chỉ số minh bạch về đóng góp.",
    category: "Chỉ số",
  },
  {
    id: "ego-risk",
    term: "Ego Risk Penalty (ERP)",
    short: "Phạt nếu hành động nặng cái tôi (0.5–1.0).",
    long: "AI scoring chấm mọi đóng góp; nếu nội dung mang tính khoe mẽ / tổn thương người khác, ERP < 1.0 sẽ giảm phần thưởng tương ứng.",
    category: "Chỉ số",
  },
];

const CATEGORIES: Term["category"][] = [
  "Chỉ số", "Phần thưởng", "Pet", "Mùa", "Cộng đồng", "Tiền tệ",
];

export default function Glossary() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  useEffect(() => {
    setCanonical(`${getSeoOrigin()}/glossary`);
    document.title = "FAQ & Từ điển — Angel AI";
    return () => cleanupSeo();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return TERMS;
    return TERMS.filter(
      (t) =>
        t.term.toLowerCase().includes(s) ||
        t.short.toLowerCase().includes(s) ||
        t.long.toLowerCase().includes(s),
    );
  }, [q]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => smartBack(navigate)} className="min-h-11">
            <ChevronLeft className="h-4 w-4 mr-1" /> Quay lại
          </Button>
          <Badge className="bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold border-0">
            <BookOpen className="h-3.5 w-3.5 mr-1" /> Từ điển
          </Badge>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />
            FAQ & Từ điển
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Định nghĩa nhanh các chỉ số trong Angel AI: XP, Level, Pet stage, Season Pass,
            Multiplier, NFT, FUN Money, Camly...
          </p>
        </div>

        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm thuật ngữ (vd: XP, pet, season...)"
            className="pl-9"
          />
        </div>

        {CATEGORIES.map((cat) => {
          const items = filtered.filter((t) => t.category === cat);
          if (items.length === 0) return null;
          return (
            <section key={cat} className="space-y-2">
              <div className="flex items-baseline gap-2 px-1">
                <h2 className="text-lg font-bold">{cat}</h2>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-semibold">
                  {items.length}
                </Badge>
              </div>
              <Card className="p-2">
                <Accordion type="multiple" className="w-full">
                  {items.map((t) => (
                    <AccordionItem key={t.id} value={t.id}>
                      <AccordionTrigger className="text-left hover:no-underline px-2">
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="font-semibold text-sm">{t.term}</span>
                          <span className="text-xs text-muted-foreground font-normal">
                            {t.short}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-2 text-sm text-muted-foreground leading-relaxed">
                        {t.long}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Card>
            </section>
          );
        })}

        {filtered.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Không tìm thấy thuật ngữ nào khớp "{q}".
          </Card>
        )}

        <Card className="p-4 bg-muted/30 text-xs text-muted-foreground text-center">
          Từ điển này sẽ tiếp tục được mở rộng. Cần thêm thuật ngữ? Báo cho Angel AI nhé.
        </Card>
      </div>
    </div>
  );
}
