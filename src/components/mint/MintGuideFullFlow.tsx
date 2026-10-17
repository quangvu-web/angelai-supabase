import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ChevronDown,
  UserPlus,
  Wallet,
  Download,
  Save,
  Sparkles,
  TrendingUp,
  CalendarClock,
  Clock,
  Zap,
  ExternalLink,
  Copy,
  Shield,
  BarChart3,
  Settings,
  Flame,
  Gift,
} from "lucide-react";
import { toast } from "sonner";
import { AddFUNToWalletButton } from "@/components/mint/AddFUNToWalletButton";
import { useIsMobile } from "@/hooks/use-mobile";

const CONTRACT_ADDRESS = "0x39A1b047D5d143f8874888cfa1d30Fb2AE6F0CD6";

interface Step {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  tips?: React.ReactNode;
}

interface Phase {
  id: string;
  label: string;
  icon: React.ReactNode;
  headerGradient: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  accentColor: string;
  steps: Step[];
}

const copyContract = () => {
  navigator.clipboard.writeText(CONTRACT_ADDRESS);
  toast.success("Đã sao chép địa chỉ contract!");
};

const phases: Phase[] = [
  {
    id: "setup",
    label: "Thiết lập",
    icon: <Settings className="h-4 w-4" />,
    headerGradient: "bg-gradient-to-br from-blue-500 to-blue-700",
    borderColor: "border-blue-200 dark:border-blue-800",
    badgeBg: "bg-blue-100 dark:bg-blue-900/40",
    badgeText: "text-blue-700 dark:text-blue-300",
    accentColor: "text-blue-600 dark:text-blue-400",
    steps: [
      {
        number: 1,
        title: "Đăng ký & đăng nhập",
        description: "Tạo tài khoản bằng email hoặc Google để bắt đầu hành trình.",
        icon: <UserPlus className="h-3.5 w-3.5" />,
        tips: (
          <Link to="/auth" className="text-blue-600 dark:text-blue-400 text-xs underline">
            Đi tới trang Đăng nhập →
          </Link>
        ),
      },
      {
        number: 2,
        title: "Cài MetaMask & thêm BSC Testnet",
        description: "Cài ví MetaMask, sau đó thêm mạng BSC Testnet (Chain ID: 97).",
        icon: <Wallet className="h-3.5 w-3.5" />,
        tips: (
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => window.open("https://metamask.io/download/", "_blank")}
          >
            Tải MetaMask <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        ),
      },
      {
        number: 3,
        title: "Lấy tBNB miễn phí",
        description: "Bạn cần tBNB (testnet BNB) để trả phí gas cho giao dịch on-chain.",
        icon: <Download className="h-3.5 w-3.5" />,
        tips: (
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => window.open("https://testnet.bnbchain.org/faucet-smart", "_blank")}
          >
            <Download className="h-3 w-3 mr-1" />
            Lấy tBNB miễn phí
          </Button>
        ),
      },
      {
        number: 4,
        title: "Lưu ví vào Profile",
        description: "Vào trang Profile, dán địa chỉ ví MetaMask để hệ thống biết gửi FUN cho ai.",
        icon: <Save className="h-3.5 w-3.5" />,
        tips: (
          <Link to="/profile" className="text-blue-600 dark:text-blue-400 text-xs underline">
            Đi tới Profile →
          </Link>
        ),
      },
    ],
  },
  {
    id: "earn",
    label: "Tích lũy",
    icon: <Flame className="h-4 w-4" />,
    headerGradient: "bg-gradient-to-br from-amber-500 to-orange-600",
    borderColor: "border-amber-200 dark:border-amber-800",
    badgeBg: "bg-amber-100 dark:bg-amber-900/40",
    badgeText: "text-amber-700 dark:text-amber-300",
    accentColor: "text-amber-600 dark:text-amber-400",
    steps: [
      {
        number: 5,
        title: "Thực hiện Light Actions",
        description: "Chat AI, đăng bài cộng đồng, viết nhật ký, giúp bạn bè... Mỗi hành động được chấm điểm theo 5 trụ cột PLP (S·T·H·C·U).",
        icon: <Sparkles className="h-3.5 w-3.5" />,
        tips: (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-2">
              <Link to="/chat" className="text-xs text-amber-700 dark:text-amber-400 underline">Chat AI</Link>
              <Link to="/community" className="text-xs text-amber-700 dark:text-amber-400 underline">Cộng đồng</Link>
              <Link to="/earn" className="text-xs text-amber-700 dark:text-amber-400 underline">Kiếm điểm</Link>
            </div>
            <p className="text-[11px] text-muted-foreground">
              💡 Chất lượng {'>'} Số lượng. Hành động đều đặn tăng Consistency Multiplier.
            </p>
          </div>
        ),
      },
      {
        number: 6,
        title: "Tích lũy Light Score trong Epoch",
        description: "Mỗi tháng = 1 Epoch. LS = (Base×0.4 + Content×0.6 + Sequence) × Reputation × Consistency – Penalty. Cần ≥ 10 LS.",
        icon: <TrendingUp className="h-3.5 w-3.5" />,
        tips: (
          <div className="space-y-1">
            <div className="grid grid-cols-5 gap-1 text-[10px] text-center">
              <span className="bg-amber-100 dark:bg-amber-900/30 rounded px-1 py-0.5">Cấp 1<br />0-199</span>
              <span className="bg-amber-100 dark:bg-amber-900/30 rounded px-1 py-0.5">Cấp 2<br />200-499</span>
              <span className="bg-amber-100 dark:bg-amber-900/30 rounded px-1 py-0.5">Cấp 3<br />500-999</span>
              <span className="bg-amber-100 dark:bg-amber-900/30 rounded px-1 py-0.5">Cấp 4<br />1K-2K</span>
              <span className="bg-amber-100 dark:bg-amber-900/30 rounded px-1 py-0.5">Cấp 5<br />2000+</span>
            </div>
            <p className="text-[11px] text-muted-foreground">⚡ LS càng cao → FUN càng lớn.</p>
          </div>
        ),
      },
    ],
  },
  {
    id: "claim",
    label: "Nhận FUN",
    icon: <Gift className="h-4 w-4" />,
    headerGradient: "bg-gradient-to-br from-green-500 to-emerald-700",
    borderColor: "border-green-200 dark:border-green-800",
    badgeBg: "bg-green-100 dark:bg-green-900/40",
    badgeText: "text-green-700 dark:text-green-300",
    accentColor: "text-green-600 dark:text-green-400",
    steps: [
      {
        number: 7,
        title: "Cuối Epoch: Phân bổ FUN tự động",
        description: "Mint Pool (tối đa 5M FUN) phân bổ theo: FUN = Pool × (LS của bạn ÷ Tổng LS). Giới hạn 3% pool/người.",
        icon: <CalendarClock className="h-3.5 w-3.5" />,
        tips: (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[11px]">
              <Shield className="h-3 w-3 text-green-600" />
              <span className="text-muted-foreground">LS ≥ 10 + PLP + Không fraud</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <BarChart3 className="h-3 w-3 text-blue-600" />
              <span className="text-muted-foreground">Anti-whale: tối đa 3% (150K FUN)</span>
            </div>
          </div>
        ),
      },
      {
        number: 8,
        title: "Admin ký duyệt (EIP-712)",
        description: "Admin ký chữ ký EIP-712 → FUN được lock on-chain cho bạn.",
        icon: <Clock className="h-3.5 w-3.5" />,
        tips: (
          <p className="text-[11px] text-muted-foreground">
            Thời gian duyệt tùy admin. Số Locked sẽ tăng ở Token Lifecycle.
          </p>
        ),
      },
      {
        number: 9,
        title: "Activate → Claim ✨",
        description: "Activate All (Locked→Activated), rồi Claim All (Activated→Flowing). FUN thuộc về bạn!",
        icon: <Zap className="h-3.5 w-3.5" />,
        tips: (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">Mỗi bước cần 1 giao dịch MetaMask (tốn tBNB gas).</p>
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">
                {CONTRACT_ADDRESS.slice(0, 6)}...{CONTRACT_ADDRESS.slice(-4)}
              </code>
              <button onClick={copyContract} className="text-muted-foreground hover:text-foreground">
                <Copy className="h-3 w-3" />
              </button>
              <a
                href={`https://testnet.bscscan.com/address/${CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline text-[11px]"
              >
                BscScan <ExternalLink className="h-3 w-3 inline" />
              </a>
            </div>
            <AddFUNToWalletButton />
          </div>
        ),
      },
    ],
  },
];

function StepItem({ step, accentColor }: { step: Step; accentColor: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors text-left"
      >
        <span className={`shrink-0 ${accentColor}`}>{step.icon}</span>
        <span className="text-sm font-medium flex-1">{step.title}</span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="pl-8 pr-2 pb-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="text-xs text-muted-foreground">{step.description}</p>
          {step.tips && <div>{step.tips}</div>}
        </div>
      )}
    </div>
  );
}

function PhaseCard({ phase }: { phase: Phase }) {
  return (
    <Card className={`overflow-hidden ${phase.borderColor}`}>
      <div className={`${phase.headerGradient} px-4 py-3 flex items-center gap-2`}>
        <div className="text-white">{phase.icon}</div>
        <h4 className="font-bold text-white text-sm flex-1">{phase.label}</h4>
        <span className="bg-white/20 text-white text-[11px] font-semibold rounded-full px-2 py-0.5">
          {phase.steps.length} bước
        </span>
      </div>
      <div className="p-2 space-y-0.5">
        {phase.steps.map((step) => (
          <StepItem key={step.number} step={step} accentColor={phase.accentColor} />
        ))}
      </div>
    </Card>
  );
}

export function MintGuideFullFlow() {
  const isMobile = useIsMobile();

  return (
    <div className="space-y-3">
      {/* Epoch info banner */}
      <div className="rounded-lg bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200 dark:border-amber-800 px-3 py-2">
        <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
          🔄 <strong>Epoch:</strong> FUN phân bổ theo tháng dựa trên Light Score — không mint từng hành động. Đều đặn + chất lượng = phần thưởng lớn.
        </p>
      </div>

      {/* Desktop: 3 columns grid */}
      {!isMobile ? (
        <div className="grid grid-cols-3 gap-3">
          {phases.map((phase) => (
            <PhaseCard key={phase.id} phase={phase} />
          ))}
        </div>
      ) : (
        /* Mobile: Tabs */
        <Tabs defaultValue="setup">
          <TabsList className="w-full">
            {phases.map((phase) => (
              <TabsTrigger key={phase.id} value={phase.id} className="flex-1 text-xs gap-1">
                {phase.icon}
                {phase.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {phases.map((phase) => (
            <TabsContent key={phase.id} value={phase.id}>
              <PhaseCard phase={phase} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
