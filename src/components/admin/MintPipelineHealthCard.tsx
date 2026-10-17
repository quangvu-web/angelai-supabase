import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Clock, Coins, ArrowRight } from "lucide-react";
import { Link } from "@/lib/router-compat";

interface PipelineHealth {
  pending_sig_total: number;
  pending_sig_over_24h: number;
  total_stuck_fun: number;
  oldest_age_hours: number;
  scored_no_mint_backlog: number;
  is_critical: boolean;
}

export default function MintPipelineHealthCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["mint-pipeline-health"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_mint_pipeline_health");
      if (error) throw error;
      return data as unknown as PipelineHealth;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const critical = data?.is_critical;

  return (
    <Card className={critical ? "border-destructive" : ""}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          {critical ? (
            <AlertTriangle className="w-4 h-4 text-destructive" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          )}
          Mint Pipeline Health
        </CardTitle>
        <Link to="/admin/mint-stuck">
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            Mở panel <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Đang tải...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Kẹt &gt; 24h
                </span>
                <Badge variant={(data?.pending_sig_over_24h ?? 0) > 0 ? "destructive" : "secondary"}>
                  {data?.pending_sig_over_24h ?? 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                <span className="text-xs text-muted-foreground">Tổng pending_sig</span>
                <Badge variant={(data?.pending_sig_total ?? 0) > 5 ? "destructive" : "secondary"}>
                  {data?.pending_sig_total ?? 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Coins className="w-3 h-3" /> FUN kẹt
                </span>
                <span className="text-xs font-bold text-amber-500">
                  {Number(data?.total_stuck_fun ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                <span className="text-xs text-muted-foreground">Cũ nhất</span>
                <span className="text-xs font-bold">{Math.round((data?.oldest_age_hours ?? 0) / 24)}d</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-muted/50 mt-2">
              <span className="text-xs text-muted-foreground">Backlog (scored, no mint request)</span>
              <Badge variant={(data?.scored_no_mint_backlog ?? 0) > 1000 ? "destructive" : "outline"}>
                {(data?.scored_no_mint_backlog ?? 0).toLocaleString()}
              </Badge>
            </div>
            {critical && (
              <p className="text-xs text-destructive mt-2">
                ⚠️ Pipeline đang trong trạng thái cảnh báo. Mở Mint Stuck Panel để xử lý.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
