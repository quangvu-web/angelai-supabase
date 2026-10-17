import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShieldCheck, ShieldX, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { useAdminPendingRecovery, useResolveRecovery } from "@/hooks/useTrustAdmin";

export function RecoveryAdminPanel() {
  const { data, isLoading } = useAdminPendingRecovery();
  const resolve = useResolveRecovery();
  const [act, setAct] = useState<null | { id: string; decision: "approve" | "reject" }>(null);
  const [reason, setReason] = useState("");

  const submit = () => {
    if (!act) return;
    resolve.mutate({ request_id: act.id, decision: act.decision, reason }, {
      onSuccess: () => { setAct(null); setReason(""); },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Yêu cầu Recovery đang chờ
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-32 w-full" /> : (data || []).length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Không có yêu cầu nào đang chờ</div>
        ) : (
          <div className="space-y-2">
            {(data as any[]).map((r) => (
              <div key={r.id} className="border rounded-md p-3 flex flex-col md:flex-row md:items-center gap-3 hover:bg-muted/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium">{r.request_type}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: vi })}</span>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground truncate">user: {r.user_id}</div>
                  <div className="text-xs mt-1">Approvals: {r.approvals_count}/{r.required_approvals} · Rejects: {r.rejections_count}</div>
                  {r.reason && <div className="text-xs italic text-muted-foreground mt-1">"{r.reason}"</div>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAct({ id: r.id, decision: "approve" })}>
                    <ShieldCheck className="h-3 w-3 mr-1" /> Duyệt
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setAct({ id: r.id, decision: "reject" })}>
                    <ShieldX className="h-3 w-3 mr-1" /> Từ chối
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!act} onOpenChange={(o) => !o && setAct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{act?.decision === "approve" ? "Duyệt yêu cầu" : "Từ chối yêu cầu"} (admin override)</DialogTitle>
          </DialogHeader>
          <Input placeholder="Lý do (tuỳ chọn)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAct(null)}>Huỷ</Button>
            <Button variant={act?.decision === "approve" ? "default" : "destructive"} onClick={submit}>Xác nhận</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
