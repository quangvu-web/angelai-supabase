import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, History, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface AntiWhaleCapPanelProps {
  totalMintPool: number;
  configuredCapRatio: number; // e.g. 0.03
}

const USER_REWARD_RATIO = 0.70;
const EXPECTED_CAP_RATIO = 0.03;

interface ReportRow {
  id: string;
  cycle_number: number | null;
  period: string | null;
  status: string | null;
  total_pool: number;
  user_reward_pool: number;
  max_fun_per_user: number;
  ratio_match: boolean;
  verification: string;
  generated_at: string;
}

export function AntiWhaleCapPanel({ totalMintPool, configuredCapRatio }: AntiWhaleCapPanelProps) {
  const userRewardPool = totalMintPool * USER_REWARD_RATIO;
  const maxPerUser = userRewardPool * EXPECTED_CAP_RATIO;
  const ratioMatch = Math.abs(configuredCapRatio - EXPECTED_CAP_RATIO) < 1e-9;
  const pctOfTotal = ((maxPerUser / totalMintPool) * 100).toFixed(2);

  const [history, setHistory] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("anti_whale_cap_reports" as any)
      .select("id, cycle_number, period, status, total_pool, user_reward_pool, max_fun_per_user, ratio_match, verification, generated_at")
      .order("generated_at", { ascending: false })
      .limit(12);
    setHistory((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { loadHistory(); }, []);

  const runNow = async () => {
    setRunning(true);
    try {
      await supabase.functions.invoke("verify-anti-whale-cap", { body: { persist: true } });
      await loadHistory();
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-50/50 to-yellow-50/30 dark:from-amber-950/20 dark:to-yellow-950/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {ratioMatch ? (
            <ShieldCheck className="h-4 w-4 text-green-600" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-red-600" />
          )}
          <h4 className="text-sm font-semibold">Anti-Whale Cap 3% Verification</h4>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
            ratioMatch ? "bg-green-500/15 text-green-700" : "bg-red-500/15 text-red-700"
          }`}
        >
          {ratioMatch ? "PASS ✓" : "FAIL ✗"}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Total Pool</p>
          <p className="font-mono font-bold">{totalMintPool.toLocaleString()} FUN</p>
        </div>
        <div>
          <p className="text-muted-foreground">User Reward Pool (70%)</p>
          <p className="font-mono font-bold">{userRewardPool.toLocaleString()} FUN</p>
        </div>
        <div>
          <p className="text-muted-foreground">Cap Ratio (configured)</p>
          <p className="font-mono font-bold">{(configuredCapRatio * 100).toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-muted-foreground">Max FUN / user</p>
          <p className="font-mono font-bold text-amber-700 dark:text-amber-400">
            {maxPerUser.toLocaleString()} FUN
          </p>
          <p className="text-[10px] text-muted-foreground">({pctOfTotal}% of total pool)</p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground italic">
        Công thức: <code className="font-mono">3% × (70% × {totalMintPool.toLocaleString()})</code> ={" "}
        <code className="font-mono font-bold">{maxPerUser.toLocaleString()} FUN/user</code>. Áp lên{" "}
        <strong>userRewardPool</strong>, KHÔNG áp lên total_mint_pool.{" "}
        <a href="/docs/anti-whale-cap" className="text-primary underline">
          Xem tài liệu
        </a>
      </p>

      <div className="border-t border-amber-500/20 pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-3.5 w-3.5 text-muted-foreground" />
            <h5 className="text-xs font-semibold">Lịch sử kiểm tra (cron 1/tháng — 02:00 UTC)</h5>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={runNow} disabled={running}>
            <RefreshCw className={`h-3 w-3 mr-1 ${running ? "animate-spin" : ""}`} />
            Chạy ngay
          </Button>
        </div>

        {loading ? (
          <p className="text-[11px] text-muted-foreground">Đang tải…</p>
        ) : history.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">
            Chưa có báo cáo. Cron sẽ chạy lần đầu vào 1/5/2026 02:00 UTC, hoặc nhấn "Chạy ngay".
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="text-muted-foreground">
                <tr className="border-b border-amber-500/20">
                  <th className="text-left py-1 pr-2">Cycle</th>
                  <th className="text-left pr-2">Kỳ</th>
                  <th className="text-right pr-2">Total Pool</th>
                  <th className="text-right pr-2">Max/User</th>
                  <th className="text-center pr-2">Kết quả</th>
                  <th className="text-right">Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id} className="border-b border-amber-500/10">
                    <td className="py-1 pr-2 font-mono">#{r.cycle_number ?? "-"}</td>
                    <td className="pr-2">{r.period}</td>
                    <td className="text-right pr-2 font-mono">{Number(r.total_pool).toLocaleString()}</td>
                    <td className="text-right pr-2 font-mono font-bold text-amber-700 dark:text-amber-400">
                      {Number(r.max_fun_per_user).toLocaleString()}
                    </td>
                    <td className="text-center pr-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        r.ratio_match ? "bg-green-500/15 text-green-700" : "bg-red-500/15 text-red-700"
                      }`}>
                        {r.ratio_match ? "PASS" : "FAIL"}
                      </span>
                    </td>
                    <td className="text-right text-muted-foreground">
                      {new Date(r.generated_at).toLocaleString("vi-VN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
