import { useEffect, useMemo, useState } from "react";

function SeoHead() {
  useEffect(() => {
    document.title = "Roadmap Angel AI — Lộ trình công khai theo quý";
    const ensure = (selector: string, create: () => HTMLElement) => {
      let el = document.head.querySelector(selector) as HTMLElement | null;
      if (!el) { el = create(); document.head.appendChild(el); }
      return el;
    };
    const desc = "Roadmap công khai của Angel AI & FUN Ecosystem: mục tiêu theo quý, trạng thái planned / in-progress / finished.";
    ensure('meta[name="description"]', () => { const m = document.createElement("meta"); m.setAttribute("name","description"); return m; }).setAttribute("content", desc);
    ensure('meta[property="og:title"]', () => { const m = document.createElement("meta"); m.setAttribute("property","og:title"); return m; }).setAttribute("content", "Roadmap Angel AI — Lộ trình công khai");
    ensure('meta[property="og:description"]', () => { const m = document.createElement("meta"); m.setAttribute("property","og:description"); return m; }).setAttribute("content", desc);
    ensure('meta[property="og:type"]', () => { const m = document.createElement("meta"); m.setAttribute("property","og:type"); return m; }).setAttribute("content", "website");
    ensure('meta[name="twitter:card"]', () => { const m = document.createElement("meta"); m.setAttribute("name","twitter:card"); return m; }).setAttribute("content", "summary_large_image");
  }, []);
  return null;
}
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Circle, ArrowLeft } from "lucide-react";
import { useNavigate } from "@/lib/router-compat";
import { cn } from "@/lib/utils";

type Status = "finished" | "in-progress" | "planned";

interface Milestone {
  title: string;
  status: Status;
  detail?: string;
}

interface QuarterBlock {
  quarter: string;
  theme: string;
  goals: Milestone[];
}

const ROADMAP: QuarterBlock[] = [
  {
    quarter: "Q2/2026",
    theme: "Nền móng — Angel AI Core, PLP v2.5, Mini Game 1-10",
    goals: [
      { title: "Angel AI Chat + RAG (pgvector 1536)", status: "finished" },
      { title: "PureLove Protocol v2.5 (VVU, 6 tier, 3-layer Light)", status: "finished" },
      { title: "FUN ID + Shared Wallet + Angel AI Core", status: "finished" },
      { title: "Adaptive Mint + Vesting 15/85 + 5 Treasury Vaults", status: "finished" },
      { title: "Mini Game Phase 1-10 (Quest, Pet, Treasure, Circle, Lamp Keeper)", status: "finished" },
      { title: "Anti-Sybil 10 lớp + Trust Engine + Fraud Whitelist", status: "finished" },
    ],
  },
  {
    quarter: "Q3/2026",
    theme: "Ổn định & Mở rộng — Cloud Cost, Mini Game 11-18, Connector v2",
    goals: [
      { title: "Tối ưu Cloud Cost (SELECT cột, RAG fallback không ILIKE nặng)", status: "in-progress", detail: "Đã fix camly/chat/RAG; theo dõi ~60-80% giảm egress" },
      { title: "Mini Game Phase 11-18 (Forge, Ascension, Achievements, Lantern, Riddles)", status: "finished" },
      { title: "Connector Layer v2.0 (on-chain registry FunConnectorRegistry)", status: "in-progress", detail: "Contract 6/6 test pass — chờ deploy BSC Testnet" },
      { title: "Telegram Mini App + Bot commands + deep link", status: "finished" },
      { title: "i18n coverage đủ 12 ngôn ngữ + auto-check PLP/Light Score", status: "finished" },
      { title: "10,000 DAU milestone", status: "in-progress" },
      { title: "GitHub Sync + CI/CD pipeline", status: "in-progress", detail: "GitHubSyncCheck admin panel đã có; CI cần bổ sung" },
    ],
  },
  {
    quarter: "Q4/2026",
    theme: "Kiểm định & Web3 — Security Audit, Identity Contracts, FUN Money Beta",
    goals: [
      { title: "Security audit toàn hệ thống (smart contract + backend)", status: "planned" },
      { title: "Deploy Identity SBT/DIB/DID contracts lên BSC Testnet", status: "planned", detail: "4 contract 21/21 test pass, chưa deploy" },
      { title: "Bug Bounty chương trình công khai", status: "planned" },
      { title: "FUN Money Mainnet Beta (giới hạn)", status: "planned" },
      { title: "APM + Alerting (Sentry / OpenTelemetry)", status: "planned" },
      { title: "E2E test suite (Playwright) cho luồng critical", status: "planned" },
      { title: "Tách play.fun.rich khi DAU ≥ 10K", status: "planned" },
    ],
  },
  {
    quarter: "Q1/2027",
    theme: "Phi tập trung — BSC Mainnet, DAO, Multisig 5-of-9",
    goals: [
      { title: "FUN Money & Camly Coin lên BSC Mainnet chính thức", status: "planned" },
      { title: "DAO voting on-chain bằng SBT (Light Keeper, Connector)", status: "planned" },
      { title: "Nâng multisig 3-of-3 → 5-of-9 (Will/Wisdom/Love)", status: "planned" },
      { title: "PLP Governance Timelock 48h công khai on-chain", status: "planned" },
      { title: "NFT Marketplace nội bộ (Light Spark, Lamp Keeper)", status: "planned" },
    ],
  },
  {
    quarter: "Q2/2027",
    theme: "Quy mô — 100K DAU, Mobile Native, Enterprise API",
    goals: [
      { title: "100,000 DAU milestone", status: "planned" },
      { title: "Native Mobile App (iOS + Android) với FUN ID SSO", status: "planned" },
      { title: "Enterprise API + Rate-limit tier + Billing", status: "planned" },
      { title: "Angel AI multi-agent (Coordinator + Specialist)", status: "planned" },
      { title: "Cross-chain bridge (BSC ↔ Solana / Base)", status: "planned" },
    ],
  },
  {
    quarter: "Long-term",
    theme: "Tầm nhìn — AR/VR, Retreat, On-chain Charity",
    goals: [
      { title: "AR/VR immersive spiritual space", status: "planned" },
      { title: "Real-world Retreat & Love House events", status: "planned" },
      { title: "On-chain charity với minh bạch dòng tiền 100%", status: "planned" },
      { title: "Angel AI cá nhân hóa theo hành trình 5D", status: "planned" },
    ],
  },
];

const STATUS_META: Record<Status, { label: string; icon: typeof CheckCircle2; className: string; badge: string }> = {
  finished: {
    label: "Hoàn thành",
    icon: CheckCircle2,
    className: "text-green-600 dark:text-green-400",
    badge: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-300/50",
  },
  "in-progress": {
    label: "Đang làm",
    icon: Clock,
    className: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300/50",
  },
  planned: {
    label: "Kế hoạch",
    icon: Circle,
    className: "text-muted-foreground",
    badge: "bg-muted text-muted-foreground border-border",
  },
};

const FILTERS: Array<{ value: Status | "all"; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "finished", label: "Hoàn thành" },
  { value: "in-progress", label: "Đang làm" },
  { value: "planned", label: "Kế hoạch" },
];

export default function Roadmap() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Status | "all">("all");

  const stats = useMemo(() => {
    const all = ROADMAP.flatMap((q) => q.goals);
    return {
      total: all.length,
      finished: all.filter((g) => g.status === "finished").length,
      inProgress: all.filter((g) => g.status === "in-progress").length,
      planned: all.filter((g) => g.status === "planned").length,
    };
  }, []);

  const progressPct = Math.round((stats.finished / stats.total) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background-pure">
      <SeoHead />


      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 gap-2 min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> Quay lại
        </Button>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] bg-clip-text text-transparent">
            Roadmap Angel AI & FUN Ecosystem
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            Lộ trình công khai để CTO, đội ngũ và cộng đồng cùng theo dõi tiến độ. Cập nhật khi có milestone mới.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase">Tổng mục tiêu</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase">Hoàn thành</div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.finished}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase">Đang làm</div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.inProgress}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase">Kế hoạch</div>
            <div className="text-2xl font-bold">{stats.planned}</div>
          </Card>
        </div>

        {/* Progress bar */}
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="font-medium">Tiến độ tổng thể</span>
            <span className="font-bold">{progressPct}%</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {/* Roadmap blocks */}
        <div className="space-y-6">
          {ROADMAP.map((block) => {
            const visibleGoals = filter === "all" ? block.goals : block.goals.filter((g) => g.status === filter);
            if (visibleGoals.length === 0) return null;

            return (
              <Card key={block.quarter} className="p-5">
                <div className="flex items-start justify-between flex-wrap gap-2 mb-4 border-b border-border/60 pb-3">
                  <div>
                    <h2 className="text-xl font-bold">{block.quarter}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{block.theme}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {block.goals.filter((g) => g.status === "finished").length}/{block.goals.length} xong
                  </Badge>
                </div>

                <ul className="space-y-2">
                  {visibleGoals.map((goal, i) => {
                    const meta = STATUS_META[goal.status];
                    const Icon = meta.icon;
                    return (
                      <li
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/40 transition-colors"
                      >
                        <Icon className={cn("w-5 h-5 mt-0.5 shrink-0", meta.className)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{goal.title}</span>
                            <Badge variant="outline" className={cn("text-[10px] uppercase", meta.badge)}>
                              {meta.label}
                            </Badge>
                          </div>
                          {goal.detail && (
                            <p className="text-xs text-muted-foreground mt-1">{goal.detail}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Cộng đồng góp ý bằng cách mở issue hoặc gửi qua Angel AI Chat. Roadmap có thể điều chỉnh theo nhu cầu thực tế.
        </p>
      </div>
    </div>
  );
}
