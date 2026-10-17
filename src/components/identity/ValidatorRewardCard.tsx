import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useValidatorPendingRewards, useValidatorRewardHistory, useClaimValidatorRewards } from "@/hooks/useValidatorRewards";
import { Coins, Sparkles, Clock, Check, X } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const SOURCE_LABEL: Record<string, string> = {
  attestation: "Chứng thực",
  curation: "Curation",
  governance: "Governance",
  protocol_grant: "Protocol Grant",
};

const STATUS_META: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", icon: <Clock className="h-3 w-3" />, label: "Pending" },
  claimed: { color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: <Check className="h-3 w-3" />, label: "Claimed" },
  forfeited: { color: "bg-red-500/10 text-red-600 dark:text-red-400", icon: <X className="h-3 w-3" />, label: "Forfeited" },
};

export function ValidatorRewardCard() {
  const { data: pending, isLoading } = useValidatorPendingRewards();
  const { data: history = [] } = useValidatorRewardHistory(20);
  const claim = useClaimValidatorRewards();

  const handleClaim = () => {
    claim.mutate(undefined, {
      onSuccess: (res: any) => {
        if (res?.success) toast.success(`Đã claim ${Number(res.amount).toLocaleString()} CLY`);
        else toast.error(res?.error || "Không có reward để claim");
      },
      onError: (e: any) => toast.error(e?.message),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" /> Validator Rewards
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="rounded-lg border bg-gradient-to-br from-amber-500/5 to-yellow-500/5 p-4">
            <div className="text-xs text-muted-foreground">Pending Rewards</div>
            <div className="flex items-end justify-between mt-1">
              <div className="flex items-center gap-2">
                <Coins className="h-6 w-6 text-amber-500" />
                <span className="text-3xl font-bold font-mono">
                  {Number(pending?.total ?? 0).toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">CLY</span>
              </div>
              <Button
                size="sm"
                onClick={handleClaim}
                disabled={claim.isPending || !pending?.total}
                className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white"
              >
                {claim.isPending ? "Claiming..." : "Claim Now"}
              </Button>
            </div>
            {pending?.by_source && Object.keys(pending.by_source).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {Object.entries(pending.by_source).map(([k, v]) => (
                  <Badge key={k} variant="outline" className="text-xs">
                    {SOURCE_LABEL[k] || k}: {Number(v).toLocaleString()}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Lịch sử (20 gần nhất)</div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {history.map((r: any) => {
                const meta = STATUS_META[r.status];
                return (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="font-mono">+{Number(r.amount).toLocaleString()} CLY</div>
                      <div className="text-xs text-muted-foreground">
                        {SOURCE_LABEL[r.source_type] || r.source_type} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-xs ${meta.color}`}>
                      {meta.icon} <span className="ml-1">{meta.label}</span>
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
