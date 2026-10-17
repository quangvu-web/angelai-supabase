import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2, ArrowUpRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface SyncResult {
  status: string;
  total: number;
  synced: number;
  failed: number;
  redirect_url?: string;
  errors?: string[];
  message?: string;
  code?: string;
}

export function SyncToFunRichButton() {
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  if (!user) return null;

  const handleSyncAndRedirect = async () => {
    setIsSyncing(true);
    setSyncResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Vui lòng đăng nhập lại");
        return;
      }

      const res = await supabase.functions.invoke("sync-to-fun-rich", {
        body: {},
      });

      if (res.error) throw res.error;
      const result = res.data as SyncResult;

      if (result.code === 'NO_FUN_LINK') {
        toast.error("Chưa liên kết FUN Profile. Vui lòng liên kết FUN ID trước.");
        return;
      }

      setSyncResult(result);

      if (result.status === 'no_actions') {
        toast.info("Không có hành động mới cần đồng bộ. Đang chuyển sang FUN.RICH...");
        setTimeout(() => {
          window.open('https://fun.rich/wallet/fun_money', '_blank');
        }, 1500);
        return;
      }

      if (result.synced > 0) {
        toast.success(`✨ Đã đồng bộ ${result.synced} hành động sang FUN.RICH!`);
        
        // Auto redirect after 2s
        setTimeout(() => {
          window.open(result.redirect_url || 'https://fun.rich/wallet/fun_money', '_blank');
        }, 2000);
      }

      if (result.failed > 0) {
        toast.warning(`${result.failed} hành động chưa đồng bộ được. Thử lại sau nhé.`);
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Có lỗi xảy ra";
      toast.error(`Đồng bộ thất bại: ${message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-blue-100 dark:bg-blue-900/50">
              <ArrowUpRight className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">Đồng bộ Light Actions về FUN.RICH</p>
              <p className="text-xs text-muted-foreground">
                Gửi các hành động đã chấm điểm về FUN.RICH — nơi duy nhất mint FUN Money chính thức
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {syncResult?.status === 'completed' && syncResult.synced > 0 ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Đã đồng bộ {syncResult.synced} hành động
              </Badge>
            ) : null}

            <Button
              size="sm"
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white gap-1.5"
              onClick={handleSyncAndRedirect}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Đang đồng bộ...
                </>
              ) : (
                <>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Đồng bộ về FUN.RICH
                </>
              )}
            </Button>
          </div>
        </div>

        {syncResult?.failed && syncResult.failed > 0 ? (
          <div className="mt-3 flex items-start gap-2 p-2 rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
            <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
            <p className="text-xs text-orange-700 dark:text-orange-400">
              {syncResult.failed} hành động chưa đồng bộ được. Bấm lại để thử lần nữa.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
