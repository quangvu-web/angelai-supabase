import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Zap, Clock, BarChart3, PlayCircle } from "lucide-react";
import { toast } from "sonner";

interface BatchMinterResult {
  success: boolean;
  dry_run?: boolean;
  epoch_info?: {
    cap: string;
    minted_before: string;
    minted_this_run: string;
    remaining_after: string;
  };
  processed: number;
  success_count: number;
  fail_count: number;
  total_fun_minted: number;
  pending_remaining: number;
  message?: string;
}

export function EpochBatchProgress() {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<BatchMinterResult | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [signedCount, setSignedCount] = useState(0);
  const [signedFun, setSignedFun] = useState(0);

  const fetchCounts = useCallback(async () => {
    const { data } = await supabase.rpc("get_mint_request_stats");
    if (data) {
      const stats = data as Record<string, number>;
      setPendingCount(stats.pending || 0);
      setSignedCount(stats.signed || 0);
      setSignedFun(stats.signed_fun || 0);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const handleRunBatchMinter = async (dryRun = false) => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("pplp-epoch-batch-minter", {
        body: { dry_run: dryRun },
      });
      if (error) throw error;
      setLastResult(data);
      if (data?.success) {
        toast.success(
          dryRun
            ? `🔍 Dry run: ${data.processed} users sẽ được xử lý`
            : `⚡ Batch mint: ${data.success_count} thành công, ${data.total_fun_minted?.toLocaleString()} FUN`
        );
        fetchCounts();
      }
    } catch (err: any) {
      toast.error(`Batch minter error: ${err?.message || err}`);
    } finally {
      setIsRunning(false);
    }
  };

  const epochCap = lastResult?.epoch_info?.cap ? Number(BigInt(lastResult.epoch_info.cap) / BigInt(10 ** 18)) : null;
  const epochMinted = lastResult?.epoch_info?.minted_before ? Number(BigInt(lastResult.epoch_info.minted_before) / BigInt(10 ** 18)) : null;
  const epochRemaining = lastResult?.epoch_info?.remaining_after ? Number(BigInt(lastResult.epoch_info.remaining_after) / BigInt(10 ** 18)) : null;
  const epochProgress = epochCap && epochMinted ? Math.min((epochMinted / epochCap) * 100, 100) : 0;

  return (
    <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          Auto-Batch Minter — On-chain Epoch
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Counts */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="text-center p-2 rounded bg-muted/50">
            <div className="font-bold text-lg">{pendingCount}</div>
            <div className="text-muted-foreground text-xs">Pending</div>
          </div>
          <div className="text-center p-2 rounded bg-muted/50">
            <div className="font-bold text-lg">{signedCount}</div>
            <div className="text-muted-foreground text-xs">Signed (chờ mint)</div>
          </div>
          <div className="text-center p-2 rounded bg-muted/50">
            <div className="font-bold text-lg">{signedFun.toLocaleString()}</div>
            <div className="text-muted-foreground text-xs">FUN chờ mint</div>
          </div>
        </div>

        {/* Epoch cap progress */}
        {epochCap !== null && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>On-chain Epoch Cap</span>
              <span>{epochMinted?.toLocaleString()} / {epochCap.toLocaleString()} FUN</span>
            </div>
            <Progress value={epochProgress} className="h-2" />
            {epochRemaining !== null && (
              <div className="text-xs text-muted-foreground">
                Còn lại: <span className="font-medium text-foreground">{epochRemaining.toLocaleString()} FUN</span>
              </div>
            )}
          </div>
        )}

        {/* Last run result */}
        {lastResult && (
          <div className="text-xs space-y-1 p-2 rounded bg-muted/30">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Lần chạy gần nhất:</span>
              {lastResult.dry_run && <Badge variant="outline" className="text-[10px] px-1">DRY RUN</Badge>}
            </div>
            {lastResult.message ? (
              <div>{lastResult.message}</div>
            ) : (
              <div>
                ✓ {lastResult.success_count} thành công, ✗ {lastResult.fail_count} thất bại, 
                {" "}{lastResult.total_fun_minted?.toLocaleString()} FUN minted
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleRunBatchMinter(true)}
            disabled={isRunning}
          >
            {isRunning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <BarChart3 className="h-3 w-3 mr-1" />}
            Dry Run
          </Button>
          <Button
            size="sm"
            onClick={() => handleRunBatchMinter(false)}
            disabled={isRunning || signedCount === 0}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isRunning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <PlayCircle className="h-3 w-3 mr-1" />}
            Run Batch Mint
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Cron tự động chạy mỗi 4 giờ. Mint theo dung lượng epoch on-chain, tự dừng khi hết cap.
        </p>
      </CardContent>
    </Card>
  );
}
