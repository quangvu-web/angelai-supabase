import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useAdminSbtQueue,
  useSbtQueueStats,
  useMarkSbtMinted,
  type SbtQueueItem,
} from "@/hooks/useZkAndOnchain";
import { Coins, ExternalLink, CheckCircle2, Clock, XCircle, Layers, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  processing: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  minted: "bg-green-500/20 text-green-700 dark:text-green-400",
  failed: "bg-red-500/20 text-red-700 dark:text-red-400",
  cancelled: "bg-muted text-muted-foreground",
};

export function SbtOnchainQueuePanel() {
  const stats = useSbtQueueStats();
  const pending = useAdminSbtQueue("pending");
  const mintedQ = useAdminSbtQueue("minted");
  const failedQ = useAdminSbtQueue("failed");
  const mark = useMarkSbtMinted();
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  const runAutoMinter = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("sbt-auto-mint", { body: { limit: 10 } });
      if (error) throw error;
      const r = data as any;
      const minted = (r?.results || []).filter((x: any) => x.status === "minted").length;
      const failed = (r?.results || []).filter((x: any) => x.status === "failed").length;
      toast.success(
        `Auto-mint: ${minted} minted, ${failed} failed${r?.simulation_mode ? " (simulation)" : ""}`
      );
      qc.invalidateQueries({ queryKey: ["sbt-queue-admin"] });
      qc.invalidateQueries({ queryKey: ["sbt-queue-stats"] });
    } catch (e: any) {
      toast.error(e?.message || "Lỗi chạy auto-mint");
    } finally {
      setRunning(false);
    }
  };

  const [active, setActive] = useState<SbtQueueItem | null>(null);
  const [tx, setTx] = useState("");
  const [block, setBlock] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [contract, setContract] = useState("");

  const openMintDialog = (item: SbtQueueItem) => {
    setActive(item);
    setTx("");
    setBlock("");
    setTokenId("");
    setContract(item.contract_address || "");
  };

  const submit = () => {
    if (!active) return;
    mark.mutate(
      {
        queue_id: active.id,
        tx_hash: tx,
        block_number: Number(block) || 0,
        on_chain_token_id: tokenId,
        contract_address: contract,
      },
      {
        onSuccess: (r) => r?.success && setActive(null),
      }
    );
  };

  const s = stats.data || {};

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={runAutoMinter} disabled={running} size="sm" className="gap-2">
          <Zap className="h-4 w-4" />
          {running ? "Đang chạy..." : "Run Auto-Minter"}
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Pending" value={s.pending || 0} icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Processing" value={s.processing || 0} icon={<Layers className="h-4 w-4" />} />
        <StatCard label="Minted" value={s.minted || 0} icon={<CheckCircle2 className="h-4 w-4 text-green-500" />} />
        <StatCard label="Failed" value={s.failed || 0} icon={<XCircle className="h-4 w-4 text-red-500" />} />
        <StatCard label="Total" value={s.total || 0} icon={<Coins className="h-4 w-4" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> Pending mints
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pending.isLoading ? (
            <Skeleton className="h-32" />
          ) : (pending.data || []).length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Không có yêu cầu chờ mint</div>
          ) : (
            <div className="divide-y">
              {pending.data!.map((q) => (
                <QueueRow key={q.id} q={q} onMark={openMintDialog} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(failedQ.data || []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" /> Failed
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {failedQ.data!.map((q) => (
                <QueueRow key={q.id} q={q} onMark={openMintDialog} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" /> Minted gần đây
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(mintedQ.data || []).slice(0, 10).map((q) => (
            <div key={q.id} className="p-3 text-sm border-b last:border-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={statusColors.minted}>minted</Badge>
                <span className="text-xs font-mono truncate">{q.on_chain_token_id}</span>
                {q.tx_hash && (
                  <a
                    href={`https://testnet.bscscan.com/tx/${q.tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary inline-flex items-center gap-1"
                  >
                    BscScan <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {q.minted_at && formatDistanceToNow(new Date(q.minted_at), { addSuffix: true, locale: vi })}
                </span>
              </div>
            </div>
          ))}
          {(mintedQ.data || []).length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">Chưa có SBT nào được mint on-chain</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Đánh dấu đã mint on-chain</DialogTitle>
          </DialogHeader>
          {active && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border p-3 text-xs space-y-1">
                <div><span className="text-muted-foreground">SBT:</span> <span className="font-mono">{active.sbt_id.slice(0, 8)}…</span></div>
                <div><span className="text-muted-foreground">Wallet:</span> <span className="font-mono">{active.wallet_address}</span></div>
                <div><span className="text-muted-foreground">Network:</span> {active.network}</div>
              </div>
              <Input placeholder="Tx hash (0x…)" value={tx} onChange={(e) => setTx(e.target.value)} />
              <Input placeholder="Block number" value={block} onChange={(e) => setBlock(e.target.value)} />
              <Input placeholder="On-chain token ID" value={tokenId} onChange={(e) => setTokenId(e.target.value)} />
              <Input placeholder="Contract address" value={contract} onChange={(e) => setContract(e.target.value)} />
              <Button className="w-full" onClick={submit} disabled={mark.isPending || !tx || !tokenId}>
                {mark.isPending ? "Đang xử lý..." : "Xác nhận"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">{icon} {label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function QueueRow({ q, onMark }: { q: SbtQueueItem; onMark: (q: SbtQueueItem) => void }) {
  return (
    <div className="p-3 hover:bg-muted/40 transition-colors">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <Badge className={statusColors[q.status]}>{q.status}</Badge>
        <span className="text-xs">{q.network}</span>
        <span className="text-xs font-mono text-muted-foreground truncate">{q.wallet_address}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {formatDistanceToNow(new Date(q.enqueued_at), { addSuffix: true, locale: vi })}
        </span>
      </div>
      {q.error_message && <div className="text-xs text-red-500 mt-1">{q.error_message}</div>}
      <div className="flex justify-end mt-2">
        <Button size="sm" variant="outline" onClick={() => onMark(q)}>
          Đánh dấu Minted
        </Button>
      </div>
    </div>
  );
}
