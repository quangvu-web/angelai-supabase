import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FUNClaimHistory } from "@/components/mint/FUNClaimHistory";
import { useMintGate } from "@/hooks/useMintGate";
import {
  Coins,
  CheckCircle2,
  XCircle,
  Bell,
  ArrowRight,
  Clock,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

interface Allocation {
  id: string;
  cycle_id: string;
  fun_allocated: number;
  eligible: boolean;
  ineligibility_reason: string | null;
  status: string;
  created_at: string;
}

interface Cycle {
  id: string;
  cycle_number: number;
  cycle_type: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface NotifRecord {
  id: string;
  title: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

interface MintReq {
  id: string;
  amount: number;
  status: string;
  tx_hash: string | null;
  created_at: string;
  recipient_address: string | null;
}

export default function ClaimStatus() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState<(Allocation & { cycle?: Cycle })[]>([]);
  const [notifications, setNotifications] = useState<NotifRecord[]>([]);
  const [latestReq, setLatestReq] = useState<MintReq | null>(null);
  const [reqError, setReqError] = useState<string | null>(null);
  const { data: mintGate, isLoading: gateLoading, error: gateError } = useMintGate();

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      setReqError(null);
      const [allocRes, cycleRes, notifRes, reqRes] = await Promise.all([
        supabase
          .from("pplp_mint_allocations")
          .select("id, cycle_id, fun_allocated, eligible, ineligibility_reason, status, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("pplp_mint_cycles")
          .select("id, cycle_number, cycle_type, start_date, end_date, status")
          .order("cycle_number", { ascending: false })
          .limit(20),
        supabase
          .from("notifications")
          .select("id, title, content, created_at, read_at")
          .eq("user_id", user.id)
          .or("type.ilike.%mint%,type.ilike.%fun%,title.ilike.%FUN%")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("pplp_mint_requests")
          .select("id, amount, status, tx_hash, created_at, recipient_address")
          .eq("actor_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const cycleMap = new Map((cycleRes.data ?? []).map((c) => [c.id, c as Cycle]));
      const merged = (allocRes.data ?? []).map((a) => ({
        ...(a as Allocation),
        cycle: cycleMap.get(a.cycle_id),
      }));
      setAllocations(merged);
      setNotifications((notifRes.data ?? []) as NotifRecord[]);
      if (reqRes.error) setReqError(reqRes.error.message);
      setLatestReq((reqRes.data ?? null) as MintReq | null);
      setLoading(false);
    })();
  }, [user]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Vui lòng đăng nhập để xem trạng thái claim FUN.
          </CardContent>
        </Card>
      </div>
    );
  }

  const latest = allocations[0];
  const totalEligible = allocations
    .filter((a) => a.eligible && ["pending", "approved"].includes(a.status))
    .reduce((s, a) => s + (a.fun_allocated || 0), 0);

  // Readiness logic: claim available when there's a fresh mint request not yet minted/expired
  const claimableStatuses = ["pending_sig", "signed", "pending", "approved"];
  const onchainStatuses = ["minted", "confirmed"];
  const reqStatus = latestReq?.status ?? null;
  const hasClaimable = !!latestReq && claimableStatuses.includes(reqStatus || "");
  const alreadyOnchain = !!latestReq && (onchainStatuses.includes(reqStatus || "") || !!latestReq.tx_hash);
  const noRecipient = !!latestReq && !latestReq.recipient_address;
  const gateBlocking = mintGate?.tier === "T0";

  type Readiness = {
    kind: "ready" | "onchain" | "wait" | "blocked" | "error" | "loading";
    title: string;
    desc: string;
  };
  const readiness: Readiness = (() => {
    if (loading || gateLoading) return { kind: "loading", title: "Đang kiểm tra…", desc: "Đang tải trạng thái sẵn sàng claim." };
    if (gateError) return { kind: "error", title: "Không kiểm tra được Mint Gate", desc: (gateError as Error).message };
    if (reqError) return { kind: "error", title: "Không đọc được yêu cầu mint", desc: reqError };
    if (!latestReq) {
      return {
        kind: "wait",
        title: "Chưa có yêu cầu mint",
        desc: "Bạn chưa có mint request nào. Khi đợt phân bổ tiếp theo mở, hệ thống sẽ tự tạo yêu cầu cho bạn.",
      };
    }
    if (alreadyOnchain) {
      return {
        kind: "onchain",
        title: `Đã lock on-chain ${latestReq.amount.toLocaleString()} FUN`,
        desc: "Vào /mint để Activate & Claim FUN về ví của bạn.",
      };
    }
    if (noRecipient) {
      return {
        kind: "blocked",
        title: "Thiếu địa chỉ ví nhận",
        desc: "Yêu cầu mint chưa có recipient_address. Vào /mint để liên kết ví Web3 trước khi claim.",
      };
    }
    if (gateBlocking) {
      return {
        kind: "blocked",
        title: `Mint Gate T0 — giới hạn ${mintGate?.cap_pct ?? 50}%`,
        desc: mintGate?.warning || "Tài khoản chưa có DID. Hoàn tất Identity (T1+) để mở khoá toàn bộ FUN.",
      };
    }
    if (hasClaimable) {
      return {
        kind: "ready",
        title: `Sẵn sàng claim ${latestReq.amount.toLocaleString()} FUN`,
        desc: `Trạng thái yêu cầu: ${reqStatus?.toUpperCase()}. Nhấn /mint để hoàn tất.`,
      };
    }
    return {
      kind: "wait",
      title: `Yêu cầu đang ở trạng thái ${reqStatus?.toUpperCase()}`,
      desc: "Chưa đủ điều kiện claim. Theo dõi thông báo bên dưới hoặc xem chi tiết tại /mint.",
    };
  })();

  const readinessStyle = {
    ready: "border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30",
    onchain: "border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30",
    wait: "border-amber-300 bg-amber-50/70 dark:bg-amber-950/30",
    blocked: "border-orange-300 bg-orange-50/70 dark:bg-orange-950/30",
    error: "border-red-300 bg-red-50/70 dark:bg-red-950/30",
    loading: "border-muted bg-muted/30",
  }[readiness.kind];

  const ReadinessIcon =
    readiness.kind === "ready" || readiness.kind === "onchain"
      ? ShieldCheck
      : readiness.kind === "loading"
      ? Loader2
      : readiness.kind === "error" || readiness.kind === "blocked"
      ? ShieldAlert
      : Clock;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-amber-500" />
            Trạng thái Claim FUN
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Xem điều kiện, thông báo và lịch sử claim FUN Money của bạn.
          </p>
        </div>
        <Button
          asChild
          disabled={readiness.kind === "loading"}
          className="bg-gradient-to-r from-amber-500 to-orange-500 text-white disabled:opacity-60"
        >
          <Link to="/mint">
            {readiness.kind === "ready"
              ? "Claim ngay"
              : readiness.kind === "onchain"
              ? "Activate & Claim"
              : "Đi tới /mint"}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </div>

      {/* Readiness / sync status */}
      <Alert className={readinessStyle}>
        <ReadinessIcon
          className={`h-4 w-4 ${readiness.kind === "loading" ? "animate-spin" : ""}`}
        />
        <AlertTitle className="flex items-center gap-2 flex-wrap">
          {readiness.title}
          {mintGate?.tier && (
            <Badge variant="outline" className="text-[10px]">
              Tier {mintGate.tier}
            </Badge>
          )}
          {reqStatus && (
            <Badge variant="outline" className="text-[10px] uppercase">
              {reqStatus}
            </Badge>
          )}
        </AlertTitle>
        <AlertDescription className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="text-sm">{readiness.desc}</span>
          {(readiness.kind === "ready" || readiness.kind === "onchain" || readiness.kind === "blocked") && (
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link to="/mint">
                Mở /mint <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          )}
        </AlertDescription>
      </Alert>


      {/* Eligibility summary */}
      <Card className="border-amber-300/40 bg-gradient-to-r from-amber-50/60 to-orange-50/60 dark:from-amber-950/20 dark:to-orange-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            Đợt phân bổ gần nhất
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <Skeleton className="h-20 w-full" />
          ) : !latest ? (
            <p className="text-sm text-muted-foreground">
              Bạn chưa có phân bổ FUN nào. Hãy tiếp tục đóng góp Light để được xét vào chu kỳ tiếp theo.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {latest.fun_allocated.toLocaleString()} FUN
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Chu kỳ #{latest.cycle?.cycle_number ?? "—"} ({latest.cycle?.cycle_type ?? "—"}) ·{" "}
                    {format(new Date(latest.created_at), "dd/MM/yyyy")}
                  </p>
                </div>
                {latest.eligible ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Đủ điều kiện
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-red-600 border-red-300 gap-1">
                    <XCircle className="h-3.5 w-3.5" /> Không đủ điều kiện
                  </Badge>
                )}
              </div>
              {!latest.eligible && latest.ineligibility_reason && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  Lý do: {latest.ineligibility_reason}
                </p>
              )}
              <div className="text-xs text-muted-foreground">
                Trạng thái:{" "}
                <span className="font-medium uppercase">{latest.status}</span>
              </div>
              {totalEligible > 0 && (
                <div className="pt-2 border-t border-amber-200/50 dark:border-amber-800/50">
                  <p className="text-sm">
                    Tổng đang chờ claim:{" "}
                    <strong className="text-amber-600 dark:text-amber-400">
                      {totalEligible.toLocaleString()} FUN
                    </strong>
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-500" />
            Thông báo claim FUN
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Chưa có thông báo claim FUN nào được gửi cho bạn.
            </p>
          ) : (
            <ul className="space-y-2">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{n.content}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(n.created_at), {
                          addSuffix: true,
                          locale: vi,
                        })}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70">
                        {format(new Date(n.created_at), "dd/MM/yyyy HH:mm")}
                      </p>
                      {!n.read_at && (
                        <Badge variant="outline" className="mt-1 text-[10px] text-blue-600 border-blue-300">
                          Mới
                        </Badge>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* All allocations table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-500" />
            Lịch sử phân bổ (12 đợt gần nhất)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : allocations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Chưa có lịch sử phân bổ.
            </p>
          ) : (
            <div className="space-y-2">
              {allocations.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/40 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      Chu kỳ #{a.cycle?.cycle_number ?? "—"} ·{" "}
                      <span className="text-amber-600 dark:text-amber-400">
                        {a.fun_allocated.toLocaleString()} FUN
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(a.created_at), "dd/MM/yyyy")} · {a.cycle?.cycle_type ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.eligible ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-[10px]">
                        Đủ ĐK
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-600 border-red-300 text-[10px]">
                        Loại
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {a.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* On-chain claim history */}
      <FUNClaimHistory />

      <div className="text-center pt-2">
        <Button asChild size="lg" className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
          <Link to="/mint">
            Mở trang Claim FUN <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
